import { ElasticacheReplicationGroup } from '@cdktf/provider-aws/lib/elasticache-replication-group';
import { ElasticacheSubnetGroup } from '@cdktf/provider-aws/lib/elasticache-subnet-group';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { Token } from 'cdktf';
import { Construct } from 'constructs';
import { Vpc } from '../../.gen/modules/vpc';

export interface RedisProps {
  vpc: Vpc;
}

export class RedisConstruct extends Construct {
  readonly subnetGroup: ElasticacheSubnetGroup;
  readonly securityGroup: SecurityGroup;
  readonly replicationGroup: ElasticacheReplicationGroup;

  constructor(scope: Construct, id: string, props: RedisProps) {
    super(scope, id);

    const { vpc } = props;

    this.subnetGroup = new ElasticacheSubnetGroup(this, 'RedisSubnetGroup', {
      name: 'redis-subnet-group',
      subnetIds: Token.asList(vpc.databaseSubnetsOutput),
    });

    this.securityGroup = new SecurityGroup(this, 'RedisSecurityGroup', {
      vpcId: vpc.vpcIdOutput,
      ingress: [
        // Grants ingress to Redis from resources within the VPC.
        // TODO: Update the CIDR block to allow only the resources that need access to Redis.
        {
          protocol: 'tcp',
          fromPort: 6379,
          toPort: 6379,
          cidrBlocks: [vpc.vpcCidrBlockOutput],
        },
      ],
    });

    this.replicationGroup = new ElasticacheReplicationGroup(this, 'Redis', {
      replicationGroupId: 'redis-replication-group',
      description: 'Redis replication group',
      engine: 'redis',
      subnetGroupName: this.subnetGroup.name,
      nodeType: 'cache.t3.micro',

      parameterGroupName: 'default.redis7',
      securityGroupIds: [this.securityGroup.id],
      port: 6379,
    });
  }
}
