import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { SesDomainIdentity } from '@cdktf/provider-aws/lib/ses-domain-identity';
import { Construct } from 'constructs';

import { DNSZone } from './dns-zone';

export interface SESProps {
  zone: DNSZone;
  domainName: string;
}

export class SESConstruct extends Construct {
  readonly identity: SesDomainIdentity;

  constructor(scope: Construct, id: string, props: SESProps) {
    super(scope, id);

    const { domainName } = props;

    this.identity = new SesDomainIdentity(this, 'DomainIdentity', {
      domain: domainName,
    });

    new Route53Record(this, 'SESVerificationRecord', {
      name: `_amazonses.${domainName}`,
      zoneId: props.zone.zone.zoneId,
      type: 'TXT',
      records: [this.identity.verificationToken],
      ttl: 60,
    });
  }
}
