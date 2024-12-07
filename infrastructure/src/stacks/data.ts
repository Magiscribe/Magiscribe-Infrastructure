import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { S3Bucket } from '@cdktf/provider-aws/lib/s3-bucket';
import { S3BucketLifecycleConfiguration } from '@cdktf/provider-aws/lib/s3-bucket-lifecycle-configuration';
import { SsmParameter } from '@cdktf/provider-aws/lib/ssm-parameter';
import * as mongodb from '@cdktf/provider-mongodbatlas';
import { Repository } from '@constructs/ecs-repository';
import { TagsAddingAspect } from 'aspects/tag-aspect';
import { Aspects, S3Backend, TerraformStack } from 'cdktf';
import { Construct } from 'constructs';

import config from '../../bin/config';
import NetworkStack from './network';

interface DataStackProps {
  network: NetworkStack;
}

export default class DataStack extends TerraformStack {
  readonly s3Bucket: S3Bucket;

  readonly repositoryPythonExecutor: Repository;
  readonly repositoryApp: Repository;

  readonly database: mongodb.serverlessInstance.ServerlessInstance;
  readonly databaseParameters: {
    connectionString: SsmParameter;
    user: SsmParameter;
    password: SsmParameter;
  };

  readonly elevenLabsParameter: SsmParameter;

  constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id);

    const { network } = props;

    /*================= PROVIDERS =================*/

    new AwsProvider(this, 'aws', {
      region: config.region,
    });

    new mongodb.provider.MongodbatlasProvider(this, 'mongodb', {
      publicKey: config.data.db.publicKey,
      privateKey: config.data.db.privateKey,
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

    /*================= PARAMETERS =================*/

    this.databaseParameters = {
      connectionString: new SsmParameter(this, 'MongoDBConnectionString', {
        name: 'MONGODB_CONNECTION_STRING',
        type: 'SecureString',
        value: 'mongodb+srv://mongodb-instance.pdodhhx.mongodb.net',
        description: 'The connection string to the MongoDB instance.',
        lifecycle: {
          ignoreChanges: ['value'],
        },
      }),
      user: new SsmParameter(this, 'MongoDBUser', {
        name: 'MONGODB_USER',
        type: 'SecureString',
        value: 'admin',
        description: 'The user to access the MongoDB instance.',
        lifecycle: {
          ignoreChanges: ['value'],
        },
      }),
      password: new SsmParameter(this, 'MongoDBPassword', {
        name: 'MONGODB_PASSWORD',
        type: 'SecureString',
        value: 'adminadmin',
        description: 'The password to access the MongoDB instance.',
        lifecycle: {
          ignoreChanges: ['value'],
        },
      }),
    };

    this.elevenLabsParameter = new SsmParameter(this, 'ElevenLabsParameter', {
      name: 'ELEVEN_LABS',
      type: 'SecureString',
      value: 'elevenlabs',
      description: 'The password to access the Eleven Labs API.',
      lifecycle: {
        ignoreChanges: ['value'],
      },
    });

    /*================= S3 =================*/

    this.s3Bucket = new S3Bucket(this, 'MediaAssets', {
      bucketPrefix: 'media-assets-',
      corsRule: config.data.media.cors.map((origin) => ({
        allowedHeaders: ['*'],
        allowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
        allowedOrigins: [origin],
        exposeHeaders: ['ETag'],
        maxAgeSeconds: 3000,
      })),
    });

    // Add lifecycle rules to the bucket.
    new S3BucketLifecycleConfiguration(this, 'MediaAssetsLifecycle', {
      bucket: this.s3Bucket.bucket,
      rule: [
        {
          id: 'ExpireOldAudioFiles',
          status: 'Enabled',
          expiration: [{
            days: 30,
          }],
          filter: [{
            prefix: 'audio/',
          }],
        },
      ],
    });

    /*================= ECR =================*/

    this.repositoryPythonExecutor = new Repository(this, 'PythonExecutor', {
      name: 'python-executor',
    });

    this.repositoryApp = new Repository(this, 'App', {
      name: 'magiscribe-api',
    });

    /*================= MONGODB =================*/

    this.database = new mongodb.serverlessInstance.ServerlessInstance(
      this,
      'MongoDBInstance',
      {
        name: 'mongodb-instance',
        projectId: config.data.db.projectId,
        providerSettingsBackingProviderName: 'AWS',
        providerSettingsProviderName: 'SERVERLESS',
        providerSettingsRegionName: 'US_EAST_1',
        continuousBackupEnabled: config.data.db.backupsEnabled ?? false,
      },
    );

    // Whitelist the NAT Gateway IP.
    new mongodb.projectIpAccessList.ProjectIpAccessList(this, 'WhitelistNAT', {
      projectId: config.data.db.projectId,
      ipAddress: network.vpc.natIp.publicIp,
      comment: 'Allow the NAT Gateway IP to access the database',
    });
  }
}
