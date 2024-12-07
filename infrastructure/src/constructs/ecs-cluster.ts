import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group';
import { EcsCluster } from '@cdktf/provider-aws/lib/ecs-cluster';
import { EcsClusterCapacityProviders } from '@cdktf/provider-aws/lib/ecs-cluster-capacity-providers';
import { EcsTaskDefinition } from '@cdktf/provider-aws/lib/ecs-task-definition';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { Construct } from 'constructs';
import config from '../../bin/config';

export class Cluster extends Construct {
  readonly cluster: EcsCluster;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.cluster = new EcsCluster(this, 'Cluster', {
      name: `magiscribe-cluster`,
    });

    new EcsClusterCapacityProviders(this, `ClusterCapacityProviders`, {
      clusterName: this.cluster.name,
      capacityProviders: ['FARGATE'],
    });
  }

  public runDockerImage({
    name,
    image,
    env,
    secrets,
    executionRole,
    taskRole,
  }: {
    name: string;
    image: string;
    env: Record<string, string> | undefined;
    secrets?: Record<string, string> | undefined;
    executionRole: IamRole;
    taskRole: IamRole;
  }) {
    // Creates a log group for the task
    const logGroup = new CloudwatchLogGroup(this, `LogGroup`, {
      name: `${this.cluster.name}/${name}`,
      retentionInDays: 30,
    });

    // Creates a task that runs the docker container
    const task = new EcsTaskDefinition(this, `Task`, {
      family: 'magiscribe-api',
      cpu: '256',
      memory: '512',
      networkMode: 'awsvpc',
      executionRoleArn: executionRole.arn,
      taskRoleArn: taskRole.arn,
      containerDefinitions: JSON.stringify([
        {
          name,
          image,
          cpu: 256,
          memory: 512,
          environment: env
            ? Object.entries(env).map(([name, value]) => ({
                name,
                value,
              }))
            : undefined,
          secrets: secrets
            ? Object.entries(secrets).map(([name, valueFrom]) => ({
                name,
                valueFrom,
              }))
            : undefined,
          portMappings: [
            {
              containerPort: 80,
            },
          ],

          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              // Defines the log
              'awslogs-group': logGroup.name,
              'awslogs-region': config.region,
              'awslogs-stream-prefix': name,
            },
          },
        },
      ]),
      runtimePlatform: {
        cpuArchitecture: 'ARM64',
      },
    });

    return task;
  }
}
