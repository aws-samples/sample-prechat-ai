# Project Structure & Organization

## Root Directory Structure
```
mte-pre-consultation-chatbot/
├── .kiro/                          # Kiro AI assistant configuration
├── .aws-sam/                       # SAM build artifacts (generated)
├── packages/                       # Yarn workspace packages
│   ├── backend/                    # Python Lambda functions
│   └── web-app/                    # React frontend application
├── node_modules/                   # Dependencies (generated)
├── template.yaml                   # AWS SAM infrastructure template
├── samconfig.toml                  # SAM deployment configuration
├── package.json                    # Root package.json with workspace config
├── yarn.lock                       # Yarn dependency lock file
├── tsconfig.json                   # Root TypeScript configuration
├── .eslintrc.js                    # ESLint configuration
├── .prettierrc                     # Prettier formatting rules
└── README.md                       # Project documentation
```

## Backend Structure (`packages/backend/`)
```
packages/backend/
├── __pycache__/                    # Python cache (generated)
├── admin_handler.py                # Admin dashboard API endpoints
├── agent_handler.py                # Bedrock Agents management endpoints
├── auth_handler.py                 # Cognito authentication endpoints
├── chat_handler.py                 # Customer chat API endpoints
├── session_handler.py              # Session management endpoints
├── stream_handler.py               # DynamoDB Streams processing
├── utils.py                        # Shared utility functions
└── requirements.txt                # Python dependencies
```

### Backend Handler Responsibilities
- **admin_handler.py**: Session listing, reports, inactivation, deletion
- **agent_handler.py**: CRUD operations for Bedrock Agents
- **auth_handler.py**: User signup, signin, confirmation, token verification
- **chat_handler.py**: Message processing and AI response generation
- **session_handler.py**: Session creation and retrieval
- **stream_handler.py**: DynamoDB change stream processing
- **utils.py**: Common functions (responses, parsing, timestamps, IDs)

## Frontend Structure (`packages/web-app/`)
```
packages/web-app/
├── src/
│   ├── components/                 # Reusable UI components
│   │   ├── AnimatedButton.tsx
│   │   ├── Layout.tsx
│   │   ├── PageHeader.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── SuccessToast.tsx
│   │   ├── TopNavigation.tsx
│   │   ├── TypewriterText.tsx
│   │   └── WelcomeScreen.tsx
│   ├── pages/                      # Route-based page components
│   │   ├── admin/                  # Admin dashboard pages
│   │   ├── auth/                   # Authentication pages
│   │   └── customer/               # Customer-facing pages
│   ├── services/                   # API service layers
│   │   ├── api.ts                  # HTTP client and API methods
│   │   └── auth.ts                 # Authentication service
│   ├── styles/                     # Global styles and animations
│   │   ├── animations.css
│   │   └── global.css
│   ├── types/                      # TypeScript type definitions
│   │   └── index.ts
│   ├── utils/                      # Frontend utility functions
│   ├── assets/                     # Static assets
│   │   └── prechat-agent-prompt.md
│   ├── App.tsx                     # Main application component
│   ├── main.tsx                    # Application entry point
│   └── vite-env.d.ts              # Vite environment types
├── node_modules/                   # Package dependencies
├── index.html                      # HTML template
├── package.json                    # Package configuration
├── vite.config.ts                  # Vite build configuration
├── tsconfig.json                   # TypeScript configuration
├── tsconfig.node.json              # Node-specific TypeScript config
└── .env.development                # Development environment variables
```

## Page Organization Patterns

### Admin Pages (`src/pages/admin/`)
- **AdminDashboard.tsx**: Main admin landing page with session overview
- **AdminSessionDetails.tsx**: Detailed session view with conversation history
- **CreateSession.tsx**: Form for creating new customer sessions
- **AgentsDashboard.tsx**: Bedrock Agents management interface
- **CreateAgent.tsx**: Form for creating new Bedrock Agents
- **EditAgent.tsx**: Form for editing existing Bedrock Agents

### Customer Pages (`src/pages/customer/`)
- **CustomerChat.tsx**: Main chat interface for customer conversations

### Auth Pages (`src/pages/auth/`)
- Authentication and user management pages

## Component Architecture Patterns

### Layout Components
- **Layout.tsx**: Main application layout wrapper
- **TopNavigation.tsx**: Global navigation header
- **PageHeader.tsx**: Consistent page header component

### Functional Components
- **ProtectedRoute.tsx**: Route protection for authenticated users
- **AnimatedButton.tsx**: Reusable button with animations
- **TypewriterText.tsx**: Text animation component
- **SuccessToast.tsx**: Success notification component

## API Service Organization

### Service Layer Pattern
- **api.ts**: Centralized HTTP client with axios configuration
- **auth.ts**: Authentication-specific service methods
- Separate API namespaces: `chatApi`, `adminApi` for logical grouping

## Configuration Files

### Build & Development
- **vite.config.ts**: Vite bundler configuration
- **tsconfig.json**: TypeScript compiler options
- **.eslintrc.js**: Code linting rules
- **.prettierrc**: Code formatting configuration

### AWS Infrastructure
- **template.yaml**: SAM template defining all AWS resources
- **samconfig.toml**: SAM deployment parameters and configuration

## Naming Conventions

### Files & Directories
- **PascalCase**: React components (`AdminDashboard.tsx`)
- **camelCase**: Utility files and services (`api.ts`, `auth.ts`)
- **kebab-case**: Configuration files (`.eslintrc.js`)
- **snake_case**: Python files (`chat_handler.py`)

### Code Structure
- **Components**: One component per file, named exports preferred
- **Services**: Grouped by functionality with named exports
- **Types**: Centralized in `types/index.ts` with clear interfaces
- **Handlers**: One Lambda function per file with descriptive names

## Import Organization
1. External libraries (React, AWS SDK, etc.)
2. Internal services and utilities
3. Component imports
4. Type imports (using `import type`)
5. Relative imports last

## Development Workflow Patterns
- **Feature-based development**: Group related functionality together
- **Component composition**: Build complex UIs from smaller, reusable components
- **Service abstraction**: Separate API logic from UI components
- **Type safety**: Comprehensive TypeScript usage throughout