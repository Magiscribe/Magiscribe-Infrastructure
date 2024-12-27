enum Environment {
  Development = 'dev',
  Production = 'prod',
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

const config: Record<Environment, Config> = {
  dev: {
    region: 'us-east-1',
    terraformBackend: {
      bucket: 'remote-terraform-state20240520152449090900000001',
      dynamodbTable: 'remote-terraform-state-lock',
      region: 'us-east-1',
    },
    auth: {
      publishableKey:
        'pk_test_cm9tYW50aWMtaW5zZWN0LTUxLmNsZXJrLmFjY291bnRzLmRldiQ',
      secretKey: 'sk_test_sPR7HV6vs4y71XdEUFhq00LpNfLizrEXAmfntQsrUn',
    },
    dns: {
      apexDomainName: 'dev.magiscribe.com',
      records: [
        {
          name: 'magiscribe.com',
          records: [
            'v=spf1 include:amazonses.com -all', // We can send emails from SES
          ],
          type: 'TXT',
        },
      ],
    },
    data: {
      media: {
        cors: ['http://localhost:*'],
      },
      db: {
        backupsEnabled: false,
        publicKey: 'tywsqgup',
        privateKey: '62e2857c-72bf-43b7-abb4-c6a2c8fea359',
        projectId: '665caf78bdea6c1a9ef26d7c',
      },
    },
  },
  prod: {
    region: 'us-east-1',
    terraformBackend: {
      bucket: 'remote-terraform-state20240516031320666400000001',
      dynamodbTable: 'remote-terraform-state-lock',
      region: 'us-east-1',
    },
    auth: {
      publishableKey: 'pk_live_Y2xlcmsubWFnaXNjcmliZS5jb20k',
      secretKey: 'sk_live_UCIF9TxfUrNqnb2mUZR8pZL773GtSbeQqS8TRbBczE',
    },
    dns: {
      apexDomainName: 'magiscribe.com',
      records: [
        // Zoho
        {
          name: '5d9t1nn3h9',
          records: ['zmverify.zoho.com'],
          type: 'CNAME',
        },
        {
          name: 'magiscribe.com',
          records: ['10 mx.zoho.com', '20 mx2.zoho.com', '50 mx3.zoho.com'],
          type: 'MX',
        },
        {
          name: 'zb34522179',
          records: ['zmverify.zoho.com'],
          type: 'CNAME',
        },
        {
          name: 'magiscribe.com',
          records: [
            'v=spf1 include:amazonses.com -all', // We can send emails from SES
            'v=spf1 include:zohomail.com -all', // We can send emails from Zoho
            'google-site-verification=bMiMG1u450oTAqbFF0yBsd_czh6QyRGGCndMkEDFIpU' // Google Search Console (setup through liererkt@gmail.com)
          ],
          type: 'TXT',
        },
        {
          name: 'zmail._domainkey',
          records: [
            'v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCGtPphJ3um+g5eozujCFObJPrmUHtn+vKCj6K+XZRVtigLKwdlf5DYrsqX2cddAO65SJxc0OBzur++xFi8lf6+iC3ZQHLNggjJGcj2qt3xUvJKJcHG/Eo+y//sh1BWyL3ZIvm+c7Qqxcv7pqr/Qspbinq0M9rcLzlqXeBR2rFzFQIDAQAB',
          ],
          type: 'TXT',
        },

        // Clerk
        {
          name: 'clerk',
          records: ['frontend-api.clerk.services'],
          type: 'CNAME',
        },
        {
          name: 'clk2._domainkey',
          records: ['dkim2.ykui03l9x0ov.clerk.services'],
          type: 'CNAME',
        },
        {
          name: 'clk._domainkey',
          records: ['dkim1.ykui03l9x0ov.clerk.services'],
          type: 'CNAME',
        },
        {
          name: 'clkmail',
          records: ['mail.ykui03l9x0ov.clerk.services'],
          type: 'CNAME',
        },
        {
          name: 'accounts',
          records: ['accounts.clerk.services'],
          type: 'CNAME',
        },

        // dev.magiscribe.com
        {
          name: 'dev',
          records: [
            'ns-187.awsdns-23.com.',
            'ns-919.awsdns-50.net.',
            'ns-1664.awsdns-16.co.uk.',
            'ns-1113.awsdns-11.org.',
          ],
          type: 'NS',
        },
      ],
    },
    data: {
      media: {
        cors: ['https://magiscribe.com'],
      },
      db: {
        backupsEnabled: true,
        publicKey: 'aoajfedt',
        privateKey: '1ff1b1ab-3d43-461f-80ae-1b5fa61904b8',
        projectId: '665fbb59b0b7bf7406fc2b0e',
      },
    },
  },
};

export default config[(process.env.NODE_ENV || 'dev') as Environment];
