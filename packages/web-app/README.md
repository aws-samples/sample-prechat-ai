# MTE Pre-consultation Web App

React SPA built with Vite and AWS CloudScape Design System.

## Features

- **Customer Interface** (`/customer/:sessionId`): Chat interface with Bedrock model selection
- **Admin Interface** (`/admin`): Session management dashboard
- **CloudScape Design System**: Consistent AWS UI components
- **TypeScript**: Full type safety

## Development

```bash
# Install dependencies
yarn install

# Start development server
yarn dev

# Build for production
yarn build
```

## Routes

- `/customer/:sessionId` - Customer chat interface
- `/admin` - Admin dashboard
- `/admin/sessions/create` - Create new session
- `/admin/sessions/:sessionId` - Session details

## Bedrock Models

The app supports Amazon Bedrock models eligible for cross-region inference from ap-northeast-2:
- Claude 3 Sonnet
- Claude 3 Haiku  
- Claude 3.5 Sonnet