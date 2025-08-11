# Technology Stack & Build System

## Architecture
- **Serverless Architecture**: Built on AWS serverless services for scalability and cost-effectiveness
- **Monorepo Structure**: Yarn workspaces with separate packages for frontend and backend
- **Infrastructure as Code**: AWS SAM (Serverless Application Model) for deployment

## Frontend Stack
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 4.x for fast development and building
- **UI Library**: AWS Cloudscape Design System components
- **Routing**: React Router DOM v6
- **HTTP Client**: Axios for API communication
- **Styling**: CSS with Cloudscape design tokens

## Backend Stack
- **Runtime**: Python 3.13 on AWS Lambda
- **Database**: Amazon DynamoDB with single-table design pattern
- **AI/ML**: Amazon Bedrock with cross-inference profiles (ap-northeast-2 region)
- **Authentication**: Amazon Cognito User Pools
- **API**: Amazon API Gateway with REST endpoints

## Development Tools
- **Package Manager**: Yarn v1.22.22 (workspaces enabled)
- **Node.js**: v20.18.1 LTS
- **Linting**: ESLint with TypeScript and Prettier integration
- **Code Formatting**: Prettier with consistent configuration

## AWS Services Used
- **Compute**: AWS Lambda functions
- **Storage**: Amazon DynamoDB, Amazon S3
- **AI/ML**: Amazon Bedrock Agents and Models
- **Auth**: Amazon Cognito
- **API**: Amazon API Gateway
- **Monitoring**: AWS CloudWatch
- **CDN**: Amazon CloudFront (for production)

## Common Commands

### Development Setup
```bash
# Install dependencies
yarn install

# Start local development (frontend only)
yarn dev

# Build all packages
yarn build

# Run linting
yarn lint

# Run tests
yarn test
```

### AWS SAM Commands
```bash
# Build SAM application
yarn sam:build
# or
sam build --profile default

# Deploy to AWS
yarn sam:deploy
# or
sam deploy --profile default

# Local API development
yarn sam:local
# or
sam local start-api --profile default
```

### Package-specific Commands
```bash
# Frontend development
yarn workspace @mte-prechat/web-app dev

# Frontend build
yarn workspace @mte-prechat/web-app build

# Frontend preview
yarn workspace @mte-prechat/web-app preview
```

## Environment Configuration
- **AWS Profile**: `default` (required for all AWS operations)
- **AWS Region**: `ap-northeast-2` (primary region for Bedrock)
- **Node Environment**: Development uses Vite dev server, production uses built assets

## Code Quality Standards
- **TypeScript**: Strict mode enabled with comprehensive type checking
- **ESLint**: Enforces code quality and consistency rules
- **Prettier**: Automatic code formatting with 80-character line width
- **Import Organization**: Consistent import ordering and structure