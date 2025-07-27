# MTE Pre-consultation Chatbot

A conversational AI web system designed to streamline the pre-meeting preparation process between AWS sales teams and customers. The system replaces traditional Excel-based forms with an intuitive chatbot interface that guides customers through a structured conversation to collect business requirements, technical constraints, and project timelines.

## Overview

The MTE Pre-consultation Chatbot consists of:

- **Customer Interface**: A conversational chatbot that guides customers through a 5-stage conversation flow
- **Admin Interface**: A dashboard for AWS sales representatives to create sessions and view results
- **AI-Powered Analysis**: Amazon Bedrock integration for intelligent conversation management and summary generation
- **Serverless Architecture**: Built on AWS serverless services for scalability and cost-effectiveness

## Prerequisites

Before starting development, ensure you have the following tools and configurations set up on your system:

### Required Software

#### 1. Node.js and Package Manager
- **Node.js**: v20.18.1 (LTS)
- **Yarn**: v1.22.22
- **npm**: Latest version (comes with Node.js)

```bash
# Verify installations
node --version  # Should show v20.18.1
yarn --version  # Should show 1.22.22
npm --version   # Should show latest version
```

#### 2. AWS CLI and SAM CLI
- **AWS CLI**: v2.x (latest)
- **AWS SAM CLI**: v1.x (latest)

```bash
# Verify installations
aws --version     # Should show AWS CLI 2.x
sam --version     # Should show SAM CLI 1.x
```

#### 3. Development Tools
- **Git**: Latest version
- **TypeScript**: v5.x (will be installed via npm)
- **Docker**: Latest version (required for SAM local development)

```bash
# Verify installations
git --version
docker --version
```

### AWS Configuration

#### 1. AWS Profile Setup
Configure your AWS credentials with the profile name `terraform`:

```bash
# Configure AWS profile
aws configure --profile terraform

# You'll be prompted to enter:
# AWS Access Key ID: [Your Access Key]
# AWS Secret Access Key: [Your Secret Key]
# Default region name: ap-northeast-2
# Default output format: json
```

#### 2. Verify AWS Profile
```bash
# Test AWS profile configuration
aws sts get-caller-identity --profile terraform

# Should return your AWS account information
```

#### 3. Required AWS Services Access
Ensure your AWS account has access to the following services in the `ap-northeast-2` region:
- **Amazon Bedrock** (with cross-inference profile eligible models)
- **AWS Lambda**
- **Amazon DynamoDB**
- **Amazon API Gateway**
- **Amazon S3**
- **Amazon CloudFront**
- **AWS CloudWatch**
- **AWS IAM**

#### 4. Amazon Bedrock Model Access
Enable access to cross-inference profile eligible models in Amazon Bedrock:

1. Go to AWS Console → Amazon Bedrock → Model access
2. Request access to foundation models (e.g., Claude 3, Claude 3.5)
3. Ensure cross-inference profiles are enabled for ap-northeast-2 region

### Development Environment Setup

#### 1. IDE/Editor (Recommended)
- **Visual Studio Code** with extensions:
  - TypeScript and JavaScript Language Features
  - AWS Toolkit
  - ESLint
  - Prettier
  - Jest

#### 2. Browser for Testing
- **Chrome** or **Firefox** (latest versions)
- Browser developer tools enabled

### Project Structure

Once prerequisites are met, the project will be organized as follows:

```
mte-pre-consultation-chatbot/
├── README.md
├── package.json
├── yarn.lock
├── template.yaml                 # AWS SAM template
├── samconfig.toml               # SAM configuration
├── packages/
│   ├── customer-app/            # Customer-facing React SPA
│   ├── admin-app/               # Admin interface React SPA
│   ├── backend/                 # Lambda functions and shared code
│   └── shared/                  # Shared TypeScript interfaces
├── infrastructure/              # Additional infrastructure code
└── docs/                       # Documentation
```

### Environment Variables

The following environment variables will be configured during development:

```bash
# AWS Configuration
AWS_PROFILE=terraform
AWS_REGION=ap-northeast-2

# Application Configuration
NODE_ENV=development
BEDROCK_REGION=ap-northeast-2
DYNAMODB_TABLE_PREFIX=mte-chatbot

# Frontend Configuration
REACT_APP_API_BASE_URL=https://api.example.com
REACT_APP_ENVIRONMENT=development
```

### Verification Checklist

Before starting development, verify all prerequisites:

- [ ] Node.js v20.18.1 installed
- [ ] Yarn v1.22.22 installed
- [ ] AWS CLI v2.x installed and configured
- [ ] SAM CLI v1.x installed
- [ ] Docker installed and running
- [ ] AWS profile `terraform` configured
- [ ] AWS account access to required services in ap-northeast-2
- [ ] Amazon Bedrock model access enabled
- [ ] Development IDE/editor set up

### Getting Started

Once all prerequisites are met:

1. **Clone the repository** (when available)
2. **Install dependencies**: `yarn install`
3. **Set up AWS resources**: `sam build && sam deploy --profile terraform`
4. **Start local development**: `yarn dev`

### Troubleshooting

#### Common Issues

**AWS Profile Issues**:
```bash
# If AWS profile is not working
aws configure list-profiles
aws configure --profile terraform
```

**SAM CLI Issues**:
```bash
# If SAM commands fail
sam --info
docker ps  # Ensure Docker is running
```

**Node.js Version Issues**:
```bash
# Use nvm to manage Node.js versions
nvm install 20.18.1
nvm use 20.18.1
```

**Yarn Issues**:
```bash
# Clear Yarn cache if needed
yarn cache clean
```

### Support

For development support and questions:
- Check the project documentation in the `docs/` folder
- Review AWS SAM documentation: https://docs.aws.amazon.com/serverless-application-model/
- Review Amazon Bedrock documentation: https://docs.aws.amazon.com/bedrock/

## Architecture

The system uses a serverless architecture built on AWS services:

- **Frontend**: React SPAs with AWS Cloudscape Design System
- **Backend**: AWS Lambda functions with Node.js/TypeScript
- **Database**: Amazon DynamoDB
- **AI**: Amazon Bedrock (ap-northeast-2 region with cross-inference profiles)
- **API**: Amazon API Gateway
- **Hosting**: Amazon S3 + CloudFront
- **Infrastructure**: AWS SAM for Infrastructure as Code

## Development Workflow

1. **Requirements**: Defined in `.kiro/specs/mte-pre-consultation-chatbot/requirements.md`
2. **Design**: Detailed in `.kiro/specs/mte-pre-consultation-chatbot/design.md`
3. **Implementation**: Task list in `.kiro/specs/mte-pre-consultation-chatbot/tasks.md`

## License

[Add your license information here]