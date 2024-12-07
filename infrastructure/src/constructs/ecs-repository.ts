import { EcrLifecyclePolicy } from '@cdktf/provider-aws/lib/ecr-lifecycle-policy';
import { EcrRepository } from '@cdktf/provider-aws/lib/ecr-repository';
import { Construct } from 'constructs';

interface RepositoryProps {
  name: string;
}

export class Repository extends Construct {
  readonly repository: EcrRepository;

  constructor(scope: Construct, id: string, props: RepositoryProps) {
    super(scope, id);

    this.repository = new EcrRepository(this, 'Repository', {
      name: props.name,
      imageTagMutability: 'MUTABLE',
      forceDelete: true,
    });

    // Lifecycle policy to keep the latest 5 images
    new EcrLifecyclePolicy(this, 'LifecyclePolicy', {
      repository: this.repository.name,
      policy: JSON.stringify({
        rules: [
          {
            rulePriority: 1,
            description: 'Keep only the latest 5 images',
            selection: {
              tagStatus: 'any',
              countType: 'imageCountMoreThan',
              countNumber: 5,
            },
            action: {
              type: 'expire',
            },
          },
        ],
      }),
    });
  }
}
