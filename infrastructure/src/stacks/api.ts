import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { Cluster } from '@constructs/ecs-cluster';
import { PythonFunction } from '@constructs/function/docker-function';
import { LoadBalancer } from '@constructs/loadbalancer';
import { TagsAddingAspect } from 'aspects/tag-aspect';
import { Aspects, S3Backend, TerraformStack } from 'cdktf';
import { Construct } from 'constructs';

import { SnsTopic } from '@cdktf/provider-aws/lib/sns-topic';
import { SnsTopicSubscription } from '@cdktf/provider-aws/lib/sns-topic-subscription';
import { NodejsFunction } from '@constructs/function/node-function';
import config from '../../bin/config';
import DataStack from './data';
import NetworkStack from './network';

interface ApiStackProps {
  /**
   * The network stack.
   */
  network: NetworkStack;

  /**
   * The domain name for the API (e.g., api.example.com).
   */
  domainName: string;

  /**
   * The allowed CORS origins.
   */
  corsOrigins: string[];

  /**
   * The data stack.
   */
  data: DataStack;
}

export default class ApiStack extends TerraformStack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id);

    const { network, domainName, data } = props;

    /*================= PROVIDERS =================*/

    new AwsProvider(this, 'aws', {
      region: config.region,
    });

    Aspects.of(this).add(
      new TagsAddingAspect({
        stack: id,
      }),
    );

    new S3Backend(this, {
      ...config.terraformBackend,
      key: `${id}.tfstate`,
    });

        
    /*================= SNS =================*/
    
    const contactSns = new SnsTopic(this, 'ContactSns', {
      name: 'contact',
    });

    /*================= LAMBDAS =================*/

    const executorFn = new PythonFunction(this, 'PythonExecutor', {
      imageUri: `${data.repositoryPythonExecutor.repository.repositoryUrl}:latest`,
      timeout: 10,
      memorySize: 1024,
    });

    const snsLambda = new NodejsFunction(this, 'SnsContactLambda', {
      path: `${__dirname}/../lambdas/webhook/index.ts`,
      environment: {
        // TODO: Move to config
        WEBHOOK_DISCORD: 'https://discord.com/api/webhooks/1325889134052638851/JPIiI5hsKmJNIPAy7IUlRBpGPcv4f3e9JFpWHsV4nNttlo_J1zNE6Zlm3NIvDSAIuxc3'
      },
    });
    snsLambda.grantInvoke({ principal: 'sns.amazonaws.com', sourceArn: contactSns.arn });
    new SnsTopicSubscription(this, 'sns-lambda', {
      topicArn: contactSns.arn,
      protocol: 'lambda',
      endpoint: snsLambda.function.arn,
    });

    /*================= REDIS =================*/

    // Note: Redis is being kept in the application stack since it is only used for session management.
    //       If Redis is used for other purposes, it should be moved to a separate stack for better isolation.

    // TODO: Enable this once we scale beyond a single container.
    // const redis = new RedisConstruct(this, 'Redis', {
    //   vpc: network.vpc.vpc,
    // });

    /*================= ECS =================*/

    // Role that allows us to get the Docker image
    const executionRole = new IamRole(this, `ExecutionRole`, {
      namePrefix: `execution-role-`,
      // this role shall only be used by an ECS task
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com',
            },
          },
        ],
      }),
      inlinePolicy: [
        // Grants access to ECR
        {
          name: 'allow-ecr-pull',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'ecr:GetAuthorizationToken',
                  'ecr:BatchCheckLayerAvailability',
                  'ecr:GetDownloadUrlForLayer',
                  'ecr:BatchGetImage',
                  'logs:CreateLogStream',
                  'logs:PutLogEvents',
                ],
                Resource: '*',
              },
            ],
          }),
        },
        // Grants access to SSM
        {
          name: 'ssm-policy',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['ssm:*'],
                Resource: '*',
              },
            ],
          }),
        },
      ],
    });

    // Role that allows us to push logs
    const taskRole = new IamRole(this, `TaskRole`, {
      namePrefix: `task-role-`,
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Sid: '',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com',
            },
          },
        ],
      }),
      inlinePolicy: [
        // Grants access to push logs to CloudWatch.
        {
          name: 'allow-logs',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
                Resource: '*',
              },
            ],
          }),
        },
        // Grants access to SES.
        {
          name: 'ses-policy',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['ses:SendEmail', 'ses:SendRawEmail'],
                Resource: '*',
              },
            ],
          }),
        },
        // Grants access to SNS.
        {
          name: 'sns-policy',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['sns:Publish'],
                Resource: contactSns.arn
              },
            ],
          }),
        },
        // Grants access to call Bedrock APIs.
        // TODO: Remove this once we have a more fine-grained policy.
        {
          name: 'bedrock-policy',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['bedrock:*'],
                Resource: '*',
              },
            ],
          }),
        },
        // Grants execution of the Lambda function for the Python executor.
        {
          name: 'invoke-policy',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'lambda:InvokeFunction',
                  'lambda:GetFunction',
                  'lambda:DescribeFunction',
                ],
                Resource: [executorFn.function.arn],
              },
            ],
          }),
        },
        // Grants access to upload and retrieve files from S3.
        {
          name: 's3-policy',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['s3:GetObject', 's3:PutObject'],
                Resource: [
                  `arn:aws:s3:::${data.s3Bucket.bucket}`,
                  `arn:aws:s3:::${data.s3Bucket.bucket}/*`,
                ],
              },
            ],
          }),
        },
      ],
    });

    const cluster = new Cluster(this, 'Cluster');

    const task = cluster.runDockerImage({
      name: 'magiscribe-api',
      image: `${data.repositoryApp.repository.repositoryUrl}:ee7da55fdeb9a6e3def186447d48e68204dd3604`,
      env: {
        PORT: '80',
        LOG_LEVEL: 'INFO',

        LAMBDA_PYTHON_EXECUTOR_NAME: executorFn.function.functionName,
        CLERK_PUBLISHABLE_KEY: config.auth.publishableKey,
        CLERK_SECRET_KEY: config.auth.secretKey,
        CORS_ORIGINS: props.corsOrigins.join(','),

        // TODO: Enable this once we scale beyond a single container.
        // REDIS_HOST: redis.replicationGroup.primaryEndpointAddress,
        // REDIS_PORT: redis.replicationGroup.port.toString(),

        EMAIL_BASE_URL: `https://${config.dns.apexDomainName}`,
        EMAIL_FROM_EMAIL: `no-reply@${config.dns.apexDomainName}`,
        EMAIL_FROM_NAME: 'Magiscribe',

        CONTACT_SNS_TOPIC_ARN: contactSns.arn,

        // TODO: Remove the fucking secrets
        NEW_RELIC_APP_NAME: 'magiscribe',
        NEW_RELIC_DISTRIBUTED_TRACING_ENABLED: 'true',
        NEW_RELIC_LICENSE_KEY: '3a603d0ce9a9f66822a4977c85dc875fFFFFNRAL',
        NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLE: 'true',

        MEDIA_ASSETS_BUCKET_NAME: data.s3Bucket.bucket,
      },
      secrets: {
        // Database
        MONGODB_URL: data.databaseParameters.connectionString.arn,
        MONGODB_USER: data.databaseParameters.user.arn,
        MONGODB_PASSWORD: data.databaseParameters.password.arn,

        // ElevenLabs
        ELEVENLABS_API_KEY: data.elevenLabsParameter.arn,
      },
      executionRole,
      taskRole,
    });

    const loadBalancer = new LoadBalancer(this, 'LoadBalancer', {
      vpc: network.vpc.vpc,
      cluster: cluster.cluster,
      certificate: network.dns.defaultCertificate,
    });

    const serviceSecurityGroup = new SecurityGroup(
      this,
      `service-security-group`,
      {
        vpcId: network.vpc.vpc.vpcIdOutput,
        // Only allow incoming traffic from our load balancer
        ingress: [
          {
            protocol: 'TCP',
            fromPort: 80,
            toPort: 80,
            securityGroups: loadBalancer.lb.securityGroups,
          },
        ],
        // Allow all outgoing traffic
        egress: [
          {
            fromPort: 0,
            toPort: 0,
            protocol: '-1',
            cidrBlocks: ['0.0.0.0/0'],
            ipv6CidrBlocks: ['::/0'],
          },
        ],
      },
    );

    loadBalancer.exposeService({
      name: 'magiscribe-api',
      task,
      serviceSecurityGroup,
      path: '/',
    });

    new Route53Record(this, 'FrontendRecord', {
      name: domainName,
      zoneId: network.dns.zone.zoneId,
      type: 'CNAME',
      records: [loadBalancer.lb.dnsName],
      ttl: 60,
    });
  }
}
