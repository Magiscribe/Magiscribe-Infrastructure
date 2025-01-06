// source: https://github.com/skorfmann/cdktf-nodejs-function/blob/main/src/index.ts
// inlined because esbuild is compiled natively and only works on linux for the
// currently published packages of skorfmann/cdktf-nodejs-function
import * as path from "path";
import { TerraformAsset, AssetType } from "cdktf";
import { Construct } from "constructs";
import { buildSync } from "esbuild";
import { LambdaFunction } from "@cdktf/provider-aws/lib/lambda-function";
import { IamRole } from "@cdktf/provider-aws/lib/iam-role";
import { IamRolePolicyAttachment } from "@cdktf/provider-aws/lib/iam-role-policy-attachment";
import { LambdaPermission } from "@cdktf/provider-aws/lib/lambda-permission";

export interface NodejsFunctionProps {
  readonly path: string;
  readonly environment?: { [key: string]: string };
}

const bundle = (workingDirectory: string, entryPoint: string) => {
  buildSync({
    entryPoints: [entryPoint],
    platform: "node",
    target: "es2018",
    bundle: true,
    format: "cjs",
    sourcemap: "external",
    outdir: "dist",
    absWorkingDir: workingDirectory,
  });

  return path.join(workingDirectory, "dist");
};

export class NodejsFunction extends Construct {
  public readonly asset: TerraformAsset;
  public readonly function: LambdaFunction;
  public readonly role: IamRole;
  public readonly bundledPath: string;

  constructor(scope: Construct, id: string, props: NodejsFunctionProps) {
    super(scope, id);

    const workingDirectory = path.resolve(path.dirname(props.path));
    const distPath = bundle(workingDirectory, path.basename(props.path));

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

    this.bundledPath = path.join(
      distPath,
      `${path.basename(props.path, ".ts")}.js`
    );

    this.asset = new TerraformAsset(this, "lambda-asset", {
      path: distPath,
      type: AssetType.ARCHIVE,
    });

    this.function = new LambdaFunction(this, id, {
        functionName: id,
        handler: `index.handler`,
        runtime: "nodejs20.x",
        filename: this.asset.path,
        environment: {
            variables: props.environment,
        },
        role: this.role.arn,
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