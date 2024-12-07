import { Construct } from 'constructs';
import ApiStack from 'stacks/api';
import FrontendStack from 'stacks/client';
import DataStack from 'stacks/data';
import NetworkStack from 'stacks/network';

import config from '../bin/config';

export default class Stage {
  constructor(scope: Construct) {
    const network = new NetworkStack(scope, 'network', {
      apexDomainName: config.dns.apexDomainName,
      records: config.dns.records,
    });

    const data = new DataStack(scope, 'data', {
      network,
    });

    new ApiStack(scope, 'api', {
      domainName: `api.${config.dns.apexDomainName}`,
      corsOrigins: [`https://${config.dns.apexDomainName}`],
      network,
      data,
    });

    new FrontendStack(scope, 'client-dashboard', {
      domainName: `${config.dns.apexDomainName}`,
      network,
    });
  }
}
