import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate';
import { EcsCluster } from '@cdktf/provider-aws/lib/ecs-cluster';
import { EcsService } from '@cdktf/provider-aws/lib/ecs-service';
import { EcsTaskDefinition } from '@cdktf/provider-aws/lib/ecs-task-definition';
import { Lb } from '@cdktf/provider-aws/lib/lb';
import { LbListener } from '@cdktf/provider-aws/lib/lb-listener';
import { LbListenerRule } from '@cdktf/provider-aws/lib/lb-listener-rule';
import { LbTargetGroup } from '@cdktf/provider-aws/lib/lb-target-group';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { Token } from 'cdktf';
import { Construct } from 'constructs';
import { Vpc } from '../../.gen/modules/vpc';

interface LoadBalancerProps {
  vpc: Vpc;
  cluster: EcsCluster;
  certificate: AcmCertificate;
}

export class LoadBalancer extends Construct {
  lb: Lb;
  httpListener: LbListener;
  httpsListener: LbListener;
  vpc: Vpc;
  cluster: EcsCluster;

  constructor(scope: Construct, name: string, props: LoadBalancerProps) {
    super(scope, name);

    this.vpc = props.vpc;
    this.cluster = props.cluster;

    const lbSecurityGroup = new SecurityGroup(this, `SecurityGroup`, {
      vpcId: this.vpc.vpcIdOutput,
      ingress: [
        // Allow HTTP traffic from everywhere
        {
          protocol: 'TCP',
          fromPort: 80,
          toPort: 80,
          cidrBlocks: ['0.0.0.0/0'],
          ipv6CidrBlocks: ['::/0'],
        },
        // Allow HTTPS traffic from everywhere
        {
          protocol: 'TCP',
          fromPort: 443,
          toPort: 443,
          cidrBlocks: ['0.0.0.0/0'],
          ipv6CidrBlocks: ['::/0'],
        },
      ],
      egress: [
        // Allow all traffic to every destination
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: ['0.0.0.0/0'],
          ipv6CidrBlocks: ['::/0'],
        },
      ],
    });

    this.lb = new Lb(this, `LoadBalancer`, {
      name,
      internal: false,
      loadBalancerType: 'application',
      securityGroups: [lbSecurityGroup.id],
      subnets: Token.asList(this.vpc.publicSubnetsOutput),
    });

    this.httpListener = new LbListener(this, `HttpListener`, {
      loadBalancerArn: this.lb.arn,
      port: 80,
      protocol: 'HTTP',
      defaultAction: [
        // Redirect HTTP to HTTPS
        {
          type: 'redirect',
          redirect: {
            protocol: 'HTTPS',
            port: '443',
            statusCode: 'HTTP_301',
          },
        },
      ],
    });

    this.httpsListener = new LbListener(this, `HttpsListener`, {
      loadBalancerArn: this.lb.arn,
      port: 443,
      protocol: 'HTTPS',
      sslPolicy: 'ELBSecurityPolicy-2016-08',
      certificateArn: props.certificate.arn,
      defaultAction: [
        // We define a fixed 404 message, just in case
        {
          type: 'fixed-response',
          fixedResponse: {
            contentType: 'text/plain',
            statusCode: '404',
            messageBody: 'Could not find the resource you are looking for',
          },
        },
      ],
    });
  }

  exposeService({
    name,
    task,
    serviceSecurityGroup,
    path,
  }: {
    name: string;
    task: EcsTaskDefinition;
    serviceSecurityGroup: SecurityGroup;
    path: string;
  }) {
    // Define Load Balancer target group with a health check on /ready
    const targetGroup = new LbTargetGroup(this, `TargetGroup`, {
      dependsOn: [this.httpsListener],
      name: `${name}-target-group`,
      port: 80,
      protocol: 'HTTP',
      targetType: 'ip',
      vpcId: this.vpc.vpcIdOutput,
      healthCheck: {
        enabled: true,
        path: '/health',
      },
    });

    // Makes the listener forward requests from subpath to the target group
    new LbListenerRule(this, `Rule`, {
      listenerArn: this.httpsListener.arn,
      priority: 100,
      action: [
        {
          type: 'forward',
          targetGroupArn: targetGroup.arn,
        },
      ],

      condition: [
        {
          pathPattern: { values: [`${path}*`] },
        },
      ],
    });

    // Ensure the task is running and wired to the target group, within the right security group
    new EcsService(this, `Service`, {
      dependsOn: [this.httpListener],
      name,
      launchType: 'FARGATE',
      cluster: this.cluster.id,
      desiredCount: 1,
      taskDefinition: task.arn,
      networkConfiguration: {
        subnets: Token.asList(this.vpc.privateSubnetsOutput),
        securityGroups: [serviceSecurityGroup.id],
      },
      loadBalancer: [
        {
          containerPort: 80,
          containerName: name,
          targetGroupArn: targetGroup.arn,
        },
      ],
    });
  }
}
