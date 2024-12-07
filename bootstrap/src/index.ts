import { DynamodbTable } from '@cdktf/provider-aws/lib/dynamodb-table';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { S3Bucket } from '@cdktf/provider-aws/lib/s3-bucket';
import { App, TerraformOutput, TerraformStack } from 'cdktf';
import { Construct } from 'constructs';

/**
 * The StateStack class is a Terraform stack that defines the
 * infrastructure necessary for remote Terraform state management.
 */
class StateStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // AWS Provider
    new AwsProvider(this, 'aws', {
      region: 'us-east-1',
    });

    // State Bucket
    const stateBucket = new S3Bucket(this, 'StateBucket', {
      bucketPrefix: 'remote-terraform-state',
    });

    // State Table
    const stateTable = new DynamodbTable(this, 'StateTable', {
      name: `remote-terraform-state-lock`,
      hashKey: 'LockID',
      attribute: [
        {
          name: 'LockID',
          type: 'S',
        },
      ],
      billingMode: 'PAY_PER_REQUEST',
    });

    new TerraformOutput(this, 'OutputStateBucket', {
      value: stateBucket.bucket,
    });

    new TerraformOutput(this, 'OutputStateTable', {
      value: stateTable.name,
    });
  }
}

const app = new App();
new StateStack(app, 'state');

app.synth();
