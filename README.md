# ![Magiscribe Infrastructure](./docs/imgs/banner.png) <!-- omit in toc -->

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Terraform](https://img.shields.io/badge/-Terraform-623CE4?style=for-the-badge&logo=terraform&logoColor=white)
![AWS](https://img.shields.io/badge/-AWS-232F3E?style=for-the-badge&logo=amazon-aws&logoColor=white)

---

# Table of Contents <!-- omit in toc -->

- [Overview](#overview)
  - [Architecture](#architecture)
- [Zero to Hero](#zero-to-hero)
    - [Pre-requisites](#pre-requisites)
    - [Infrastructure Deployment](#infrastructure-deployment)
      - [Bootstrap Deployment](#bootstrap-deployment)
      - [Infrastructure Deployment](#infrastructure-deployment-1)

# Overview

This repository contains the CDKTF projects for provisioning the infrastructure for Magiscribe project, including but not limited to the API and client applications.

## Architecture

![Architecture](docs/diagrams/architecture.svg)

# Zero to Hero

### Pre-requisites

- [ ] [Node.js](https://nodejs.org/en) (version 20.x or later)
- [ ] [AWS CLI](https://aws.amazon.com/cli)
- [ ] [Terraform CDKTF](https://learn.hashicorp.com/tutorials/terraform/cdktf-install)
- [ ] [Docker](https://www.docker.com/get-started)

### Infrastructure Deployment
> The following steps are required to setup the project for deployment to AWS.
>
> ! IMPORTANT ! As of writing, the both the bootstrap and infrastructure stacks are on Node 20.x. This is because the CDKTF project has not been updated to support Node 22.x. This will be updated in the future. See [here](https://github.com/cdktf/node-pty-prebuilt-multiarch/blob/prebuilt-multiarch/.prebuild/buildify.js) for the build targets supported by the CDKTF project.

#### Bootstrap Deployment
The bootstrap setup is a one-time setup that will create the necessary resources in AWS to manage the remote state of the Terraform projects. For more information on this, see [Terraform Remote State](https://developer.hashicorp.com/terraform/language/state/remote).

1. Check into `/bootstrap` directory

```bash
cd bootstrap
```

2. Specify the environment you want to deploy to. This can be done by setting the `NODE_ENV` environment variable. The default value is `development`.

```bash
export NODE_ENV=production
```

3. Deploy the bootstrap stack

```bash
cdktf deploy
```

#### Infrastructure Deployment

1. Check into `/infrastructure` directory

```bash
cd infrastructure
```

2. Specify the environment you want to deploy to. This can be done by setting the `NODE_ENV` environment variable. The default value is `development`.

```bash
export NODE_ENV=production
```

3. Deploy the networking stack. Note, the first time you run this, it will create a new Hosted Zone in Route 53. You will need to point your domain registrar to the name servers provided by Route 53 so that it can manage the DNS records and auto-verify the SSL certificates created by this project.

```bash
cdktf deploy network
```

2. Deploy the database stack

```bash
cdktf deploy network data
```

3. Deploy the app stack

```bash
cdktf deploy network data app
```

4. Deploy the client stacks

```bash
cdktf deploy network data app client-app client-dashboard
```
