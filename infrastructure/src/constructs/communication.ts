import { IamRolePolicy } from '@cdktf/provider-aws/lib/iam-role-policy';
import { LambdaEventSourceMapping } from '@cdktf/provider-aws/lib/lambda-event-source-mapping';
import { SqsQueue } from '@cdktf/provider-aws/lib/sqs-queue';
import { Construct } from 'constructs';

import { NodejsFunction } from './function/node-function';

/**
 * CommunicationConstruct manages the AWS infrastructure for handling contact form submissions
 * through a serverless architecture using SQS queues and Lambda functions.
 *
 * Architecture Flow:
 * 1. Contact form data -> SQS Queue
 * 2. Lambda processes queue messages
 * 3. Lambda sends data to Discord webhook
 * 4. Failed messages go to DLQ after 3 retries
 */
export class CommunicationConstruct extends Construct {
  /** Main SQS queue for processing contact form submissions */
  readonly discordContactSqs: SqsQueue;

  /**
   * Creates a new instance of CommunicationConstruct
   * @param scope - The scope in which to define this construct
   * @param id - The scoped construct ID
   */
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create Dead Letter Queue for failed message handling
    const discordContactDlq = new SqsQueue(this, 'DiscordContactDlq', {
      name: 'magiscribe-discord-contact-dlq.fifo',
      fifoQueue: true,
    });

    // Initialize main SQS queue with DLQ redrive policy
    this.discordContactSqs = new SqsQueue(this, 'DiscordContactSqs', {
      name: 'magiscribe-discord-contact.fifo',
      fifoQueue: true,
      contentBasedDeduplication: true,
      redrivePolicy: JSON.stringify({
        deadLetterTargetArn: discordContactDlq.arn,
        maxReceiveCount: 3,
      }),
    });

    /**
     * Lambda function that processes messages from the SQS queue
     * and forwards them to Discord webhook
     */
    const discordContactLambda = new NodejsFunction(
      this,
      'DiscordContactLambda',
      {
        path: `${__dirname}/../lambdas/webhook/index.ts`,
        environment: {
          QUEUE_URL: this.discordContactSqs.url,
          // TODO: Move to AWS Secrets Manager or Parameter Store
          WEBHOOK_DISCORD:
            'https://discord.com/api/webhooks/1325889134052638851/JPIiI5hsKmJNIPAy7IUlRBpGPcv4f3e9JFpWHsV4nNttlo_J1zNE6Zlm3NIvDSAIuxc3',
        },
      },
    );

    // Grant SQS permission to invoke the Lambda
    discordContactLambda.grantInvoke({
      principal: 'sqs.amazonaws.com',
      sourceArn: this.discordContactSqs.arn,
    });

    // Set up IAM permissions for Lambda to interact with SQS
    this.createLambdaSqsPolicy(
      discordContactLambda,
      this.discordContactSqs,
      discordContactDlq,
    );

    // Configure Lambda to process messages from SQS
    new LambdaEventSourceMapping(
      this,
      'DiscordContactLambdaEventSourceMapping',
      {
        eventSourceArn: this.discordContactSqs.arn,
        functionName: discordContactLambda.function.functionName,
      },
    );
  }

  /**
   * Creates IAM policy allowing Lambda to interact with SQS queues
   * @param lambda - The Lambda function requiring SQS permissions
   * @param mainQueue - The main SQS queue
   * @param dlq - The Dead Letter Queue
   */
  private createLambdaSqsPolicy(
    lambda: NodejsFunction,
    mainQueue: SqsQueue,
    dlq: SqsQueue,
  ): void {
    new IamRolePolicy(this, 'discord-contact-lambda-policy', {
      name: 'discord-contact-lambda-policy',
      policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Action: [
              'sqs:ReceiveMessage',
              'sqs:DeleteMessage',
              'sqs:GetQueueAttributes',
              'sqs:ChangeMessageVisibility',
            ],
            Resource: [mainQueue.arn, dlq.arn],
          },
        ],
      }),
      role: lambda.role.name,
    });
  }
}
