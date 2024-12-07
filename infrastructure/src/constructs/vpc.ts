import { DataAwsAvailabilityZones } from '@cdktf/provider-aws/lib/data-aws-availability-zones';
import { Eip } from '@cdktf/provider-aws/lib/eip';
import { Fn, Token } from 'cdktf';
import { Construct } from 'constructs';
import { FckNat } from '../../.gen/modules/FckNat';
import { Vpc } from '../../.gen/modules/vpc';

export interface VPCProps {
  vpcCidrMask: number;
  publicCidrMask: number;
  privateCidrMask: number;
  isolatedCidrMask: number;
}

export class VPCConstruct extends Construct {
  readonly vpc: Vpc;
  readonly natIp: Eip;
  readonly nat: FckNat;

  constructor(scope: Construct, id: string, props: VPCProps) {
    super(scope, id);

    // Get all AZs in the region
    const data = new DataAwsAvailabilityZones(this, 'AZs', {
      state: 'available',
    });

    const azs = ['us-east-1a', 'us-east-1b', 'us-east-1c'];

    const cidr = `10.0.0.0/${props.vpcCidrMask}`;

    this.vpc = new Vpc(this, 'VPC', {
      name: 'vpc',
      cidr,
      azs: data.names,

      publicSubnetNames: azs.map((az) => `public-${az}`),
      privateSubnetNames: azs.map((az) => `private-${az}`),
      databaseSubnetNames: azs.map((az) => `isolated-${az}`),

      databaseSubnetGroupName: 'database',

      createDatabaseSubnetRouteTable: true,

      manageDefaultRouteTable: false,
      publicRouteTableTags: {
        Name: 'public',
      },
      privateRouteTableTags: {
        Name: 'private',
      },
      databaseRouteTableTags: {
        Name: 'isolated',
      },

      publicSubnets: azs.map((_az, i) => `10.0.${i * 16}.0/20`),
      privateSubnets: azs.map(
        (_az, i) => `10.0.${i * 16 + 16 * azs.length}.0/20`,
      ),
      databaseSubnets: azs.map(
        (_az, i) => `10.0.${i * 16 + 32 * azs.length}.0/20`,
      ),

      mapPublicIpOnLaunch: false,

      // Forces using one route table for each subnet group.
      // If we were using multiple NAT gateways, we would need to set this to false
      // so each AZ could route to its own NAT gateway.
      singleNatGateway: true,
      enableNatGateway: false, // Using FckNat instead.
    });

    this.natIp = new Eip(this, 'NatEip', {
      tags: {
        Name: 'NatEip',
      },
    });

    this.nat = new FckNat(this, 'FckNat', {
      name: 'FckNat',
      instanceType: 't4g.nano',
      vpcId: this.vpc.vpcIdOutput,
      eipAllocationIds: [this.natIp.allocationId],
      attachSsmPolicy: true,
      dependsOn: [this.natIp],
      subnetId: Fn.element(Token.asList(this.vpc.publicSubnetsOutput), 1),
      updateRouteTable: true,
      routeTableId: Fn.element(
        Token.asList(this.vpc.privateRouteTableIdsOutput),
        1,
      ),
    });
  }
}
