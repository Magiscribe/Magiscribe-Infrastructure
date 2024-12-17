import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { SesDomainDkim } from '@cdktf/provider-aws/lib/ses-domain-dkim';
import { SesDomainIdentity } from '@cdktf/provider-aws/lib/ses-domain-identity';
import { Fn, TerraformCount, Token } from 'cdktf';
import { Construct } from 'constructs';

import { DNSZone } from './dns-zone';
import { SesDomainMailFrom } from '@cdktf/provider-aws/lib/ses-domain-mail-from';

export interface SESProps {
  zone: DNSZone;
  domainName: string;
}

export class SESConstruct extends Construct {
  readonly identity: SesDomainIdentity;

  constructor(scope: Construct, id: string, props: SESProps) {
    super(scope, id);

    const { domainName } = props;

    this.identity = new SesDomainIdentity(this, 'domain-identity', {
      domain: domainName,
    });

    const mailFrom = new SesDomainMailFrom(this, 'mail-from', {
      domain: domainName,
      mailFromDomain: `bounce.${domainName}`,
    });

    // Verification Record
    // Prove we own the domain by adding a TXT record to the domain's DNS settings.
    new Route53Record(this, 'ses-verification-record', {
      name: `_amazonses.${domainName}`,
      zoneId: props.zone.zone.zoneId,
      type: 'TXT',
      records: [this.identity.verificationToken],
      ttl: 60,
    });

    // MX record - Mail Exchange
    // The MX record tells email servers where to send email messages.
    new Route53Record(this, 'mx-record', {
      name: mailFrom.mailFromDomain,
      zoneId: props.zone.zone.zoneId,
      type: 'MX',
      records: ['10 feedback-smtp.us-east-1.amazonses.com'],
      ttl: 600,
    });

    // DKIM record - DomainKeys Identified Mail
    // DKIM is a standard that allows senders to sign their email messages with a cryptographic key.
    const mailDkim = new SesDomainDkim(this, 'dkim', {
      domain: this.identity.domain,
    });
    const dkimRecordCount = TerraformCount.of(Token.asNumber('3'));
    new Route53Record(this, 'dkim-record', {
      name:
        Token.asString(
          Fn.lookupNested(mailDkim.dkimTokens, [dkimRecordCount.index]),
        ) + '._domainkey',
      records: [
        Token.asString(
          Fn.lookupNested(mailDkim.dkimTokens, [dkimRecordCount.index]),
        ) + '.dkim.amazonses.com',
      ],
      ttl: Token.asNumber('600'),
      type: 'CNAME',
      zoneId: props.zone.zone.zoneId,
      count: dkimRecordCount,
    });

    // DMARC record - Domain-based Message Authentication, Reporting & Conformance
    // The DMARC record contains instructions for email providers on how to handle unauthenticated mail.
    new Route53Record(this, 'dmarc-record', {
      name: `_dmarc.${domainName}`,
      zoneId: props.zone.zone.zoneId,
      type: 'TXT',
      records: ['v=DMARC1; p=none;'],
      ttl: 60,
    });
  }
}
