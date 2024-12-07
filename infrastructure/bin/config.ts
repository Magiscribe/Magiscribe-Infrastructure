import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

enum Environment {
  Demo = 'demo',
}

interface Config {
  /**
   * The AWS region the CDKTF stack will be deployed to (e.g. us-east-1)
   */
  region: string;

  /**
   * The Terraform backend configuration.
   * This is used to store the Terraform state file.
   */
  terraformBackend: {
    /**
     * The S3 bucket name to store the Terraform state file.
     */
    bucket: string;

    /**
     * The DynamoDB table name to store the Terraform state lock.
     */
    dynamodbTable: string;

    /**
     * The AWS region the S3 bucket and DynamoDB table will be created in.
     * @default 'us-east-1'
     */
    region: string;
  };

  auth: {
    /**
     * The Clerk publishable key.
     */
    publishableKey: string;

    /**
     * The Clerk secret key.
     */
    secretKey: string;
  };

  dns: {
    apexDomainName: string;

    records?: {
      name: string;
      type: string;
      records: string[];
    }[];
  };

  data: {
    media: {
      cors: string[];
    };
    db: {
      backupsEnabled?: boolean;

      publicKey: string;
      privateKey: string;
      projectId: string;
    };
  };
}

/**
 * Gets a required environment variable or throws an error if it's not set
 * @param key The environment variable name
 * @param description Optional description for the error message
 * @returns The environment variable value
 */
function getRequiredEnv(key: string, description?: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set${description ? ` - ${description}` : ''}`);
  }
  return value;
}

const config: Record<Environment, Config> = {
  demo: {
    region: 'us-east-1',
    terraformBackend: {
      bucket: getRequiredEnv('TF_BACKEND_BUCKET', 'The S3 bucket for Terraform state'),
      dynamodbTable: getRequiredEnv('TF_BACKEND_DYNAMODB_TABLE', 'The DynamoDB table for Terraform state lock'),
      region: process.env.TF_BACKEND_REGION || 'us-east-1',
    },
    auth: {
      publishableKey: getRequiredEnv('CLERK_PUBLISHABLE_KEY', 'Clerk publishable key'),
      secretKey: getRequiredEnv('CLERK_SECRET_KEY', 'Clerk secret key'),
    },
    dns: {
      apexDomainName: getRequiredEnv('DOMAIN_NAME', 'The apex domain name'),
      records: [],
    },
    data: {
      media: {
        cors: [getRequiredEnv('MEDIA_CORS', 'CORS origin for media')],
      },
      db: {
        backupsEnabled: process.env.DB_BACKUPS_ENABLED === 'true',
        publicKey: getRequiredEnv('DB_PUBLIC_KEY', 'MongoDB public key'),
        privateKey: getRequiredEnv('DB_PRIVATE_KEY', 'MongoDB private key'),
        projectId: getRequiredEnv('DB_PROJECT_ID', 'MongoDB project ID'),
      },
    },
  },
};

export default config[(process.env.NODE_ENV || 'demo') as Environment];
