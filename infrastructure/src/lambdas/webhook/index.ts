import * as https from 'https';
import { SQSClient, DeleteMessageCommand } from '@aws-sdk/client-sqs';

interface SqsEvent {
  Records: [
    {
      body: string;
      attributes: {
        ApproximateReceiveCount: string;
        SentTimestamp: string;
        SenderId: string;
        ApproximateFirstReceiveTimestamp: string;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messageAttributes: Record<string, any>;
      messageId: string;
      receiptHandle: string;
      eventSourceARN: string;
    },
  ];
}

interface DiscordMessage {
  embeds: [
    {
      title: string;
      description: string;
      color: number;
      timestamp: string;
    },
  ];
}

const webhookUrl: string = process.env.WEBHOOK_DISCORD || '';
const url = new URL(webhookUrl);
const sqsClient = new SQSClient({});

export const handler = async (event: SqsEvent): Promise<void> => {
  console.log('Received event:', JSON.stringify(event, null, 2));
  await Promise.all(
    event.Records.map(async (record) => {
      try {
        const result = await sqsClient.send(
          new DeleteMessageCommand({
            QueueUrl: process.env.QUEUE_URL,
            ReceiptHandle: record.receiptHandle,
          }),
        );
        await send_message(record);
        console.log('Message deleted:', JSON.stringify(result, null, 2));
      } catch (error) {
        console.error('Error processing message:', error);
        throw error;
      }
    }),
  );
};

async function send_message(record: SqsEvent['Records'][0]): Promise<void> {
  const body = create_message(record);
  const options: https.RequestOptions = {
    host: url.host,
    path: url.pathname,
    port: url.port || undefined,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(body)),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      res.on('error', reject);
      res.on('end', resolve);
    });

    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

function create_message(record: SqsEvent['Records'][0]): DiscordMessage {
  const messageData = JSON.parse(record.body);

  const name = messageData.name;
  const email = messageData.email;
  const message = messageData.message;

  return {
    embeds: [
      {
        title: `New message from ${name} (${email})`,
        description: message,
        color: 0xff0000,
        timestamp: new Date(
          parseInt(record.attributes.SentTimestamp),
        ).toISOString(),
      },
    ],
  };
}
