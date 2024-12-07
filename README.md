# ![GraphQL API](./docs/imgs/banner.png) <!-- omit in toc -->

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![GraphQL](https://img.shields.io/badge/-GraphQL-E10098?style=for-the-badge&logo=graphql&logoColor=white)
![Apollo Server](https://img.shields.io/badge/-Apollo%20Server-311C87?style=for-the-badge&logo=apollo-graphql)
![Express](https://img.shields.io/badge/-Express-000000?style=for-the-badge&logo=express&logoColor=white)
![Docker](https://img.shields.io/badge/-Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![Terraform](https://img.shields.io/badge/-Terraform-623CE4?style=for-the-badge&logo=terraform&logoColor=white)
![AWS](https://img.shields.io/badge/-AWS-232F3E?style=for-the-badge&logo=amazon-aws&logoColor=white)

---

# Table of Contents <!-- omit in toc -->

- [Overview](#overview)
  - [Short Demos](#short-demos)
  - [Architecture](#architecture)
- [Zero to Hero](#zero-to-hero)
    - [Pre-requisites](#pre-requisites)
    - [General Setup](#general-setup)
    - [API Development Setup](#api-development-setup)
      - [Docker Build and Run](#docker-build-and-run)
    - [Infrastructure Deployment](#infrastructure-deployment)
      - [Bootstrap Deployment](#bootstrap-deployment)
      - [Infrastructure Deployment](#infrastructure-deployment-1)

# Overview

This repository contains a Node.js application that uses Expresses and Apollo Server to create a GraphQL API.

## Short Demos

**Agent Lab:**
The following video demonstrates the GraphQL API in action. The API is used to query the database for agents, capabilities, and their related prompts. It allows easy creation of new agents, capabilities, and prompts as well as additional features like per-organization authorization through Clerk.

https://github.com/user-attachments/assets/1dac0771-db65-4cf1-ad5e-aa70c54a8c4e

**Inquiry Builder:**
The following video demonstrates the GraphQL API in action. The API is used to query the database for inquiry graphs. An inquiry graph is a dictated conversation flows that can be used to generate a conversation between an agent and a user. It allows for stakeholders to get a dynamic conversation flow between a user and an agent to probe for information or insights, while ensuring that the agent stays on tasks, asks the right questions in the right order, and does not miss any important information while still allowing the user and conversation to go off script at certain times depending on the graph.

https://github.com/user-attachments/assets/908ae6d8-e7e9-4fb1-8964-90411095353e

## Architecture

![Architecture](docs/diagrams/architecture.svg)

# Zero to Hero

### Pre-requisites

- [ ] [Node.js](https://nodejs.org/en) (version 20.x or later)
- [ ] [AWS CLI](https://aws.amazon.com/cli)
- [ ] [Terraform CDKTF](https://learn.hashicorp.com/tutorials/terraform/cdktf-install)
- [ ] [Docker](https://www.docker.com/get-started)

### General Setup
> The following steps are required to setup the project for local development and deployment.

1. Configure AWS CLI. You can do this with `aws configure`. If the environment you working with is managed by AWS SSO, you can run `aws configure sso`. For more on this see [AWS CLI Configuration](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html).

2. Enable `corepack` for `pnpm` to install the dependencies. You can do this by running the following command:

```bash
corepack enable pnpm
corepack use pnpm@latest
```

3. Download the repository

```bash
git clone git@github.com:Magiscribe/Apollo-GraphQL-API.git
```

4. Change directory to the project root

```bash
cd Apollo-GraphQL-API
```

5. Run the install script. This will install the dependencies for the API and Infrastructure projects.

```bash
pnpm i
```

### API Development Setup
> The following steps are required for local development of the API.

1. Check into `/app` directory

```bash
cd app
```

2. Copy the `.env.example` file to `.env` and update the values as needed.

```bash
cp .env.example .env
```

2. Install the dependencies

```bash
pnpm install
```

3. Start the Docker container for the database and Python execution environment.

```bash
pnpm docker:up
```

4. Run the seed script to populate the database with sample data.

```bash
pnpm db:import
```

4. Start the application in development mode

```bash
pnpm dev
```

5. Open the browser and navigate to `http://localhost:3000/graphql` to access the GraphQL playground.
  - Important Note: To bypass Clerk authentication, you can use the following header in the GraphQL playground:
    ```json
    {
      "Authorization": "Sandbox"
    }
    ```

#### Docker Build and Run

To run the application using Docker, you can run the following command:

```bash
docker build -t graphql-api .
docker run -p 3000:3000 graphql-api -e PORT=3000 -d
```

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
