import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { DNSZone } from '@constructs/dns-zone';
import { VPCConstruct } from '@constructs/vpc';
import { TagsAddingAspect } from 'aspects/tag-aspect';
import { Aspects, S3Backend, TerraformStack } from 'cdktf';
import { Construct } from 'constructs';
import config from '../../bin/config';

interface NetworkStackProps {
  apexDomainName: string;
  records?: {
    name: string;
    type: string;
    records: string[];
  }[];
}

export default class NetworkStack extends TerraformStack {
  readonly dns: DNSZone;
  readonly vpc: VPCConstruct;

  constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id);

    const { apexDomainName: domainName, records } = props;

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

    this.dns = new DNSZone(this, 'Zone', {
      domainName,
      records,
    });

    this.vpc = new VPCConstruct(this, 'VPC', {
      vpcCidrMask: 16,
      publicCidrMask: 20,
      privateCidrMask: 20,
      isolatedCidrMask: 20,
    });
  }
}
