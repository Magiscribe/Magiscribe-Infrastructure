import { SnsTopic } from '@cdktf/provider-aws/lib/sns-topic';
import { Construct } from 'constructs';

export class CommunicationConstruct extends Construct {
  readonly contactSns: SnsTopic;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.contactSns = new SnsTopic(this, 'ContactSns', {
      name: 'contact',
      fifoTopic: true,
    });
  }
}
