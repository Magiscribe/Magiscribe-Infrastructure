import * as https from 'https';

interface SnsEvent {
  Records: [
    {
      Sns: {
        Subject: string;
        Message: string;
        Timestamp: string;
      };
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

export const handler = (
  event: SnsEvent,
): void => {
  send_message(event);
};

function send_message(events: SnsEvent): void {
  const body = create_message(events);
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

  const req = https.request(options, (res) => {
    res.on('error', (e: Error) => {
      console.log('problem with request: ' + e.message);
    });
  });

  req.write(JSON.stringify(body));
  req.end();
}

function create_message(events: SnsEvent): DiscordMessage {
  const sns = events.Records[0].Sns;

  const event = JSON.parse(sns.Message);
  const name = event.name;
  const email = event.email;
  const message = event.message;

  return {
    embeds: [
      {
        title: `New message from ${name} (${email})`,
        description: message,
        color: 0xff0000,
        timestamp: sns.Timestamp,
      },
    ],
  };
}
