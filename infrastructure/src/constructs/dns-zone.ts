import { AcmCertificate } from '@cdktf/provider-aws/lib/acm-certificate';
import { AcmCertificateValidation } from '@cdktf/provider-aws/lib/acm-certificate-validation';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { Route53Zone } from '@cdktf/provider-aws/lib/route53-zone';
import { Construct } from 'constructs';

export interface DNSZoneProps {
  domainName: string;
  subjectAlternativeNames?: string[];
  records?: {
    name: string;
    type: string;
    records: string[];
  }[];
}

export class DNSZone extends Construct {
  readonly zone: Route53Zone;
  readonly defaultCertificate: AcmCertificate;

  constructor(scope: Construct, id: string, props: DNSZoneProps) {
    super(scope, id);

    const { domainName, subjectAlternativeNames, records } = props;

    // Certificate
    this.defaultCertificate = new AcmCertificate(this, 'certificate', {
      domainName,
      subjectAlternativeNames: [
        `*.${domainName}`,
        ...(subjectAlternativeNames ?? []),
      ],
      validationMethod: 'DNS',
    });

    // Route53 Zone
    this.zone = new Route53Zone(this, 'zone', {
      name: domainName,
    });

    const record = new Route53Record(this, 'validation-record', {
      name: '${each.value.name}',
      type: '${each.value.type}',
      records: ['${each.value.record}'],
      zoneId: this.zone.zoneId,
      ttl: 60,
      allowOverwrite: true,
    });

    record.addOverride(
      'for_each',
      `\${{
              for dvo in aws_acm_certificate.${this.defaultCertificate.friendlyUniqueId}.domain_validation_options : dvo.domain_name => {
                name   = dvo.resource_record_name
                record = dvo.resource_record_value
                type   = dvo.resource_record_type
              }
            }
          }`,
    );

    records?.forEach((staticRecord, i) => {
      new Route53Record(
        this,
        `static-record-${staticRecord.name}-${staticRecord.type}-${i}`,
        {
          name: staticRecord.name,
          type: staticRecord.type,
          records: staticRecord.records,
          zoneId: this.zone.zoneId,
          ttl: 60,
          allowOverwrite: true,
        },
      );
    });

    const certValidation = new AcmCertificateValidation(
      this,
      'certvalidation',
      {
        certificateArn: this.defaultCertificate.arn,
      },
    );
    certValidation.addOverride(
      'validation_record_fqdns',
      `\${[for record in aws_route53_record.${record.friendlyUniqueId} : record.fqdn]}`,
    );
  }
}
