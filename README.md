<<<<<<< HEAD
# PreChat: sample consultation AI on AWS

> **An AWS Sample Project** - Learn how to build a chat-based consultation system using Amazon Bedrock Agents for intelligent customer interactions and automated data collection.

[![License: MIT-0](https://img.shields.io/badge/License-MIT--0-blue.svg)](LICENSE)
[![AWS](https://img.shields.io/badge/AWS-Serverless-orange.svg)](https://aws.amazon.com/serverless/)
[![Node.js](https://img.shields.io/badge/Node.js-20.18.1-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)

## 🎯 Overview

This sample project demonstrates how to build an intelligent consultation system that replaces traditional forms with an AI-powered chatbot interface. It showcases how to use Amazon Bedrock Agents to guide users through structured conversations, collect business requirements, and generate comprehensive reports - perfect for consultation services, lead qualification, or customer onboarding processes.

### What You'll Learn

- **🤖 Bedrock Agents Integration**: How to create and manage Amazon Bedrock Agents for conversational AI
- **📊 Serverless Architecture**: Building scalable chat systems with AWS Lambda and DynamoDB
- **🧠 AI-Powered Conversations**: Implementing structured dialogue flows with intelligent responses
- **📈 Session Management**: Creating secure, PIN-protected consultation sessions
- **☁️ Full-Stack Development**: React frontend with AWS serverless backend

## ✨ Features

### Client Interface
- **Interactive Chatbot**: Multi-stage guided conversation flow
- **Real-time AI Responses**: Powered by Amazon Bedrock foundation models
- **Mobile-Responsive**: Works seamlessly across all devices
- **Secure Sessions**: PIN-protected consultation sessions

### Admin Dashboard
- **Session Management**: Create, view, inactivate, and delete consultation sessions
- **AI-Generated Reports**: Comprehensive session summaries and insights
- **Conversation History**: Complete chat transcripts and client profiles
- **Analytics**: Track consultation effectiveness and user engagement

### Amazon Bedrock Agents Features
- **Agent Creation & Management**: Learn to create and configure Bedrock Agents
- **Multi-Model Support**: Work with Claude 3, Claude 3.5, and Amazon Nova models
- **Custom Instructions**: Design conversation flows and agent behavior
- **Agent Deployment**: Understand the agent preparation and deployment process
- **Prompt Engineering**: Implement effective prompts for consultation scenarios

## 📱 Website Sections After Deployment

The following table shows the main sections of the deployed application with visual previews:

| Section | Description | Preview |
|---------|-------------|---------|
| **Customer Chat Interface** | Interactive chatbot interface where customers engage in guided conversations. Features real-time AI responses, mobile-responsive design, and secure PIN-protected sessions. | ![Customer Chat](repo/images/customer_chat.png) |
| **Admin Dashboard** | Comprehensive management interface for consultation sessions. Includes session creation, monitoring, and analytics with AI-generated reports and conversation history. | ![Admin Dashboard](repo/images/admin_dashboard.png) |
| **Meeting Log Analysis** | AI-powered analysis and reporting system that generates comprehensive session summaries, insights, and consultation effectiveness metrics from conversation data. | ![Meeting Log Analysis](repo/images/meetlog_analysis.png) |

## 🏗️ Architecture

Built on AWS serverless services for scalability, security, and cost-effectiveness:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React SPA     │    │   API Gateway    │    │  Lambda Functions│
│  (CloudFront)   │◄──►│   (REST API)     │◄──►│    (Python)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Amazon Cognito │    │   Amazon S3      │    │   DynamoDB      │
│ (Authentication)│    │ (Static Hosting) │    │  (Database)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                       ┌──────────────────┐    ┌─────────────────┐
                       │ Amazon Bedrock   │    │   CloudWatch    │
                       │ (AI/ML Models)   │    │   (Monitoring)  │
                       └──────────────────┘    └─────────────────┘
```

### Technology Stack
- **Frontend**: React with AWS Cloudscape Design System
- **Backend**: AWS Lambda (Python 3.13)
- **Database**: Amazon DynamoDB with KMS encryption
- **AI/ML**: Amazon Bedrock (Claude, Nova models)
- **Authentication**: Amazon Cognito
- **API**: Amazon API Gateway with caching
- **Hosting**: Amazon S3 + CloudFront
- **Infrastructure**: AWS SAM (Infrastructure as Code)
- **Security**: VPC, KMS encryption, IAM roles

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed:

- **Node.js**: v20.18.1+ ([Download](https://nodejs.org/))
- **Yarn**: v1.22.22+ (`npm install -g yarn`)
- **AWS CLI**: v2.x ([Installation Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html))
- **SAM CLI**: v1.x ([Installation Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html))

### AWS Setup

1. **Configure AWS CLI**:
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and region (ap-northeast-2)
   ```

### Installation & Deployment

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd sample-prechat-ai
   ```

2. **Install dependencies**:
   ```bash
   yarn install
   ```

3. **Deploy to AWS**:
   ```bash
   # Make scripts executable
   chmod +x deploy-full.sh deploy-website.sh update-env-vars.sh
   
   # Deploy with default settings (dev environment)
   ./deploy-full.sh
   
   # Or deploy to production
   ./deploy-full.sh default prod ap-northeast-2 ap-northeast-2
   ```

4. **Access your application**:
   After successful deployment, you'll receive URLs for:
   - **Client Interface**: `https://[cloudfront-domain].cloudfront.net`
   - **Admin Dashboard**: `https://[cloudfront-domain].cloudfront.net/admin`

## 📖 Deployment Guide

### Deployment Parameters

The deployment script accepts the following parameters:

```bash
./deploy-full.sh [AWS_PROFILE] [STAGE] [REGION] [BEDROCK_REGION] [STACK_NAME]
```

| Parameter | Default | Description | Example |
|-----------|---------|-------------|---------|
| `AWS_PROFILE` | `default` | AWS CLI profile name | `default`, `production` |
| `STAGE` | `dev` | Deployment environment | `dev`, `prod` |
| `REGION` | `ap-northeast-2` | AWS region for infrastructure | `us-east-1`, `eu-west-1` |
| `BEDROCK_REGION` | Same as REGION | Region for Bedrock models | `ap-northeast-2` |
| `STACK_NAME` | `prechat-sample` | CloudFormation stack name | `my-company-consultation` |

### Deployment Examples

```bash
# Development environment (default)
./deploy-full.sh

# Production environment with custom stack name
./deploy-full.sh default prod ap-northeast-2 ap-northeast-2 company-consultation-prod

# Different AWS profile
./deploy-full.sh my-profile dev us-east-1 us-east-1
```

### Post-Deployment Steps

1. **Verify Bedrock Model Access**:
   - Go to AWS Console → Amazon Bedrock → Model access
   - Request access to Anthropic Cluade and Amazon Nova models
   - Ensure cross-inference profiles are enabled for your deployment region
   - Wait for model access approval (may take a few minutes to hours)

2. **Verify S3 bucket policies** for CloudFront OAC access
3. **Sign up** for an admin account at `/admin`
4. **Create your first Bedrock Agent** in the admin dashboard
5. **Create consultation sessions** and start testing the chatbot

For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md).

## 🛠️ Development

### Project Structure

```
sample-prechat-ai/
├── README.md                    # This file
├── DEPLOYMENT_GUIDE.md          # Detailed deployment instructions
├── LICENSE                      # MIT-0 license
├── package.json                 # Root package configuration
├── template.yaml                # AWS SAM template
├── samconfig.toml              # SAM deployment configuration
├── deploy-full.sh              # Full deployment script
├── deploy-website.sh           # Website-only deployment
├── update-env-vars.sh          # Environment variables update
├── packages/
│   ├── backend/                # Lambda functions (Python)
│   └── web-app/               # React frontend application
└── aws/                       # AWS service examples and samples
```

### AWS SAM Commands

```bash
# Build SAM application
sam build

# Deploy to AWS
sam deploy --guided
```

### � Cusrtomizing Privacy & Terms Documents

When adapting this sample for your own business model, you'll need to customize the Privacy Policy and Terms of Service documents to comply with your business requirements and local regulations.

#### 1. Locate the Privacy & Terms Component

The privacy and terms content is defined in:
```
packages/web-app/src/components/PrivacyTermsModal.tsx
```

#### 2. Update Privacy Policy Content

Replace the `PRIVACY_POLICY` constant with your organization's privacy policy:

```typescript
const PRIVACY_POLICY = `
# Your Company Privacy Policy

## Information We Collect
- [Specify what data you collect]
- [How you collect it]
- [Why you collect it]

## How We Use Information
- [Describe your data usage]
- [Third-party integrations]
- [Data retention policies]

## Your Rights
- [User rights under GDPR/CCPA/local laws]
- [How to request data deletion]
- [Contact information for privacy concerns]

## Contact Information
- Email: privacy@yourcompany.com
- Address: [Your business address]
`
```

#### 3. Update Terms of Service

Replace the `TERMS_OF_SERVICE` constant with your terms:

```typescript
const TERMS_OF_SERVICE = `
# Terms of Service

## Acceptance of Terms
[Your terms acceptance language]

## Service Description
[Describe your consultation service]

## User Responsibilities
[What users must/cannot do]

## Limitation of Liability
[Your liability limitations]

## Governing Law
[Applicable jurisdiction and laws]

## Contact Information
- Email: legal@yourcompany.com
- Address: [Your business address]
`
```

#### 4. Legal Compliance Considerations

**Important**: Ensure your Privacy Policy and Terms comply with:

- **GDPR** (EU users): Right to be forgotten, data portability, consent mechanisms
- **CCPA** (California users): Data disclosure, opt-out rights, non-discrimination
- **Local Laws**: Check requirements in your jurisdiction
- **Industry Standards**: Healthcare (HIPAA), Financial (SOX), etc.

#### 5. Data Collection Alignment

Update the privacy policy to reflect the actual data collected by the system:

```typescript
// Data collected by the consultation system:
interface SessionData {
  customerName: string;
  customerEmail: string;
  customerCompany: string;
  conversationHistory: Message[];
  sessionMetadata: {
    ipAddress: string;
    userAgent: string;
    timestamp: string;
  };
}
```

#### 6. Consent Mechanism

The system includes privacy consent checkboxes. Ensure your privacy policy explains:
- What happens when users consent
- How to withdraw consent
- Data retention after consent withdrawal

## 🔒 Security Features

- **VPC Isolation**: Lambda functions run in private subnets
- **KMS Encryption**: All data encrypted at rest and in transit
- **IAM Roles**: Least-privilege access controls
- **Cognito Authentication**: Secure admin access
- **API Gateway**: Rate limiting and request validation
- **CloudWatch**: Comprehensive logging and monitoring

## 📊 Monitoring & Observability

- **CloudWatch Logs**: Centralized logging for all components
- **CloudWatch Metrics**: Performance and usage metrics
- **X-Ray Tracing**: Distributed request tracing
- **API Gateway Caching**: Improved performance and cost optimization
- **DynamoDB Point-in-Time Recovery**: Data protection and backup

## 🤝 Contributing

This AWS sample project demonstrates best practices for building chat-based consultation systems using Amazon Bedrock Agents. You're encouraged to:

1. **Fork the repository** and customize it for your consultation use cases
2. **Adapt the conversation flows** to your specific business requirements
3. **Extend the functionality** with additional AWS services
4. **Share your improvements** and use cases with the community
5. **Report issues** if you find bugs or have suggestions for improvements

## 📄 License

This project is licensed under the **MIT No Attribution License (MIT-0)**.

### What this means:
- ✅ **Commercial use allowed** - Use in commercial products and services
- ✅ **Modification allowed** - Modify and adapt the code freely
- ✅ **Distribution allowed** - Redistribute original or modified versions
- ✅ **Private use allowed** - Use for personal or internal projects
- ✅ **No attribution required** - No need to credit the original authors

### Key Benefits:
- **Maximum freedom** - No restrictions on usage
- **No legal obligations** - No attribution or license notices required
- **Commercial friendly** - Perfect for consultation services, SaaS, or enterprise use
- **Risk minimization** - Minimal legal complexity

For the complete license text, see the [LICENSE](LICENSE) file.

## 🆘 Support & Resources

### Documentation
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [AWS Cloudscape Design System](https://cloudscape.design/)

### AWS Services Used
- [Amazon Bedrock](https://aws.amazon.com/bedrock/) - AI/ML foundation models
- [AWS Lambda](https://aws.amazon.com/lambda/) - Serverless compute
- [Amazon DynamoDB](https://aws.amazon.com/dynamodb/) - NoSQL database
- [Amazon API Gateway](https://aws.amazon.com/api-gateway/) - API management
- [Amazon Cognito](https://aws.amazon.com/cognito/) - Authentication
- [Amazon S3](https://aws.amazon.com/s3/) - Object storage
- [Amazon CloudFront](https://aws.amazon.com/cloudfront/) - Content delivery

### Getting Help
For questions, support, or feedback about this project, please contact:

📧 **aws-prechat@amazon.com** or jaebin@amazon.com
=======
# MTE Pre-consultation Chatbot

A conversational AI web system designed to streamline the pre-meeting preparation process between AWS sales teams and customers. The system replaces traditional Excel-based forms with an intuitive chatbot interface that guides customers through a structured conversation to collect business requirements, technical constraints, and project timelines.

## Overview

The MTE Pre-consultation Chatbot consists of:

- **Customer Interface**: A conversational chatbot that guides customers through a 5-stage conversation flow
- **Admin Interface**: A dashboard for AWS sales representatives to create sessions and view results
- **Bedrock Agents Management**: Create, configure, and deploy Amazon Bedrock Agents for enhanced AI capabilities
- **AI-Powered Analysis**: Amazon Bedrock integration for intelligent conversation management and summary generation
- **Serverless Architecture**: Built on AWS serverless services for scalability and cost-effectiveness

## Features

### Customer Experience
- Interactive chatbot interface with 5-stage conversation flow
- Real-time conversation with AI-powered responses
- Mobile-responsive design

### Admin Dashboard
- Session management (create, view, inactivate, delete)
- Detailed session reports with AI-generated summaries
- Customer profile and conversation history
- AWS documentation recommendations

### Bedrock Agents Management
- **Agent Creation**: Create new Bedrock agents with custom instructions
- **Agent Editing**: Update agent name, foundation model, and instructions
- **Default Prompt Template**: Pre-loaded agent instructions from prechat-agent-prompt.md
- **Model Selection**: Choose from various foundation models (Claude, Nova)
- **Agent Deployment**: Prepare and deploy agents for production use
- **Agent Management**: View, update, and delete existing agents
- **Status Management**: Track agent status (Creating, Prepared, Not Prepared, etc.)
- **Prompt Management**: Load default prompt template or customize instructions

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
Configure your AWS credentials with the default profile:

```bash
# Configure AWS profile
aws configure

# You'll be prompted to enter:
# AWS Access Key ID: [Your Access Key]
# AWS Secret Access Key: [Your Secret Key]
# Default region name: ap-northeast-2
# Default output format: json
```

#### 2. Verify AWS Profile
```bash
# Test AWS profile configuration
aws sts get-caller-identity

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
AWS_PROFILE=default
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
- [ ] AWS profile configured (default)
- [ ] AWS account access to required services in ap-northeast-2
- [ ] Amazon Bedrock model access enabled
- [ ] Development IDE/editor set up

### Getting Started

Once all prerequisites are met:

1. **Clone the repository** (when available)
2. **Install dependencies**: `yarn install`
3. **Set up AWS resources**: `sam build && sam deploy`
4. **Start local development**: `yarn dev`

### Troubleshooting

#### Common Issues

**AWS Profile Issues**:
```bash
# If AWS profile is not working
aws configure list-profiles
aws configure
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
>>>>>>> dev
