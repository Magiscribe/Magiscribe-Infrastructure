import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment';
import { LambdaFunction } from '@cdktf/provider-aws/lib/lambda-function';
import { LambdaPermission } from '@cdktf/provider-aws/lib/lambda-permission';
import { Construct } from 'constructs';

export interface PythonFunctionProps {
  imageUri: string;
  timeout?: number;
  environmentVariables?: { [key: string]: string };
  memorySize?: number;
}

export class PythonFunction extends Construct {
  public readonly function: LambdaFunction;
  public readonly role: IamRole;

  constructor(scope: Construct, id: string, props: PythonFunctionProps) {
    super(scope, id);

    this.role = new IamRole(this, 'lambda-role', {
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'lambda.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      }),
    });

    this.function = new LambdaFunction(this, id, {
      functionName: id,
      role: this.role.arn,
      packageType: 'Image',
      imageUri: props.imageUri,
      timeout: props.timeout,
      memorySize: props.memorySize,
      tracingConfig: {
        mode: 'Active', // Enable X-Ray tracing
      },
      environment: {
        variables: props.environmentVariables,
      },
      architectures: ['arm64'],
    });

    // Add AWSLambdaBasicExecutionRole
    this.attachPolicy(
      'lambda-basic-policy',
      'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    );

    // Add X-Ray tracing to the Lambda function
    this.attachPolicy(
      'lambda-xray-policy',
      'arn:aws:iam::aws:policy/AWSXrayWriteOnlyAccess',
    );
  }

  public attachPolicy(id: string, policyArn: string) {
    new IamRolePolicyAttachment(this, `${id}-policy-attachment`, {
      policyArn,
      role: this.role.name,
    });
  }

  // GrantInvoke is a method that allows the Lambda function to be invoked by another AWS service
  public grantInvoke({
    principal,
    sourceArn,
  }: {
    principal: string;
    sourceArn: string;
  }) {
    new LambdaPermission(this, 'lambda-permission', {
      action: 'lambda:InvokeFunction',
      functionName: this.function.functionName,
      principal,
      sourceArn,
    });
  }
}
