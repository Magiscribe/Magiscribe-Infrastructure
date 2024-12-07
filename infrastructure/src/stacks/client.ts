import { CloudfrontDistribution } from '@cdktf/provider-aws/lib/cloudfront-distribution';
import { CloudfrontOriginAccessControl } from '@cdktf/provider-aws/lib/cloudfront-origin-access-control';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { Route53Record } from '@cdktf/provider-aws/lib/route53-record';
import { S3Bucket } from '@cdktf/provider-aws/lib/s3-bucket';
import { S3BucketPolicy } from '@cdktf/provider-aws/lib/s3-bucket-policy';
import { TagsAddingAspect } from 'aspects/tag-aspect';
import { Aspects, S3Backend, TerraformStack } from 'cdktf';
import { Construct } from 'constructs';
import config from '../../bin/config';
import NetworkStack from './network';

interface FrontendStackProps {
  domainName: string;
  network: NetworkStack;
}

export default class FrontendStack extends TerraformStack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id);

    const { network, domainName } = props;

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

    const cloudfrontOAC = new CloudfrontOriginAccessControl(
      this,
      'CloudFrontOAC',
      {
        name: `${id}-oac`,
        description: 'Allow CloudFront to access the bucket',
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    );

    const frontendBucket = new S3Bucket(this, 'FrontendBucket', {
      bucketPrefix: `${id}-bucket-`,
    });

    const cloudfrontDistribution = new CloudfrontDistribution(
      this,
      'CloudFront',
      {
        enabled: true,
        defaultRootObject: 'index.html',
        defaultCacheBehavior: {
          allowedMethods: [
            'DELETE',
            'GET',
            'HEAD',
            'OPTIONS',
            'PATCH',
            'POST',
            'PUT',
          ],
          cachedMethods: ['GET', 'HEAD'],
          targetOriginId: frontendBucket.bucketDomainName,
          viewerProtocolPolicy: 'redirect-to-https',
          compress: true,
          forwardedValues: {
            queryString: false,
            cookies: {
              forward: 'none',
            },
          },
        },

        origin: [
          {
            originId: frontendBucket.bucketDomainName,
            domainName: frontendBucket.bucketRegionalDomainName,
            originAccessControlId: cloudfrontOAC.id,
          },
        ],

        // Redirect to index.html on 403 for React routing.
        customErrorResponse: [
          {
            errorCode: 403,
            responseCode: 200,
            responsePagePath: '/index.html',
          },
        ],

        aliases: [domainName],

        viewerCertificate: {
          acmCertificateArn: network.dns.defaultCertificate.arn,
          sslSupportMethod: 'sni-only',
          minimumProtocolVersion: 'TLSv1.2_2019',
        },

        restrictions: {
          geoRestriction: {
            restrictionType: 'none',
          },
        },
      },
    );

    new S3BucketPolicy(this, 'FrontendBucketPolicy', {
      bucket: frontendBucket.bucket,
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'cloudfront.amazonaws.com',
            },
            Action: 's3:GetObject',
            Resource: `${frontendBucket.arn}/*`,
            Condition: {
              StringEquals: {
                'AWS:SourceArn': cloudfrontDistribution.arn,
              },
            },
          },
        ],
      }),
    });

    new Route53Record(this, 'FrontendRecord', {
      name: domainName,
      zoneId: network.dns.zone.zoneId,
      type: 'A',
      alias: {
        name: cloudfrontDistribution.domainName,
        zoneId: cloudfrontDistribution.hostedZoneId,
        evaluateTargetHealth: true,
      },
    });
  }
}
