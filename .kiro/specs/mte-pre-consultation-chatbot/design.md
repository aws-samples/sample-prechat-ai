# Design Document

## Overview

The MTE Pre-consultation Chatbot is a serverless web application that facilitates structured conversations between AWS customers and an AI-powered chatbot to collect business requirements before sales meetings. The system consists of two main interfaces: a customer-facing chatbot interface and an admin interface for AWS sales representatives. The architecture leverages AWS serverless services including API Gateway, Lambda, DynamoDB, Amazon Bedrock for AI capabilities, and AWS Cognito for authentication. The system is designed to replace traditional Excel-based forms with an intuitive conversational interface that adapts to the customer's technical level and provides comprehensive reporting for AWS sales teams and engineers.

## Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        CW[Customer Web App<br/>React SPA]
        AW[Admin Web App<br/>React SPA]
    end
    
    subgraph "API Layer"
        AG[API Gateway]
    end
    
    subgraph "Application Layer"
        CL[Chat Lambda]
        AL[Admin Lambda]
        SL[Session Lambda]
        RL[Report Lambda]
    end
    
    subgraph "AI Layer"
        BR[Amazon Bedrock]
    end
    
    subgraph "Authentication Layer"
        COG[AWS Cognito]
    end
    
    subgraph "Data Layer"
        DB[(DynamoDB)]
    end
    
    subgraph "Static Hosting"
        S3[S3 + CloudFront]
    end
    
    CW --> AG
    AW --> AG
    AG --> CL
    AG --> AL
    AG --> SL
    AG --> RL
    CL --> BR
    CL --> DB
    AL --> DB
    SL --> DB
    RL --> DB
    RL --> BR
    AW --> COG
    COG --> AL
    
    S3 --> CW
    S3 --> AW
```

### Technology Stack

**Frontend:**
- Node.js v20.18.1 with Yarn 1.22.22
- React 18+ for SPA development
- AWS Cloudscape Design System components
- TypeScript for type safety
- React Router for navigation
- Axios for API communication

**Backend:**
- AWS API Gateway for REST API endpoints
- AWS Lambda (Python3.13 runtime) for serverless functions
- Amazon DynamoDB for data persistence
- Amazon Bedrock (Claude 3 or similar) for conversational AI
- AWS Cognito for admin authentication with @amazon.com domain restriction
- AWS CloudWatch for logging and monitoring

**Infrastructure:**
- AWS S3 + CloudFront for static web hosting
- AWS IAM for security and access control
- AWS Systems Manager Parameter Store for configuration

## Components and Interfaces

### Frontend Components

#### Customer Interface Components

**ChatInterface**
- Main conversation component with message history
- Input field for customer responses
- Typing indicators and loading states
- Progress indicator showing conversation stage
- Cloudscape Chat UI components

**ConversationFlow**
- State management for 5-stage conversation flow (Authority, Business, AWS Services, Technical Requirements, Next Steps)
- Dynamic question generation based on customer responses
- Context preservation across conversation stages
- Adaptive questioning based on technical level detection
- Cross-stage information handling and conversation flow adaptation

**SessionManager**
- URL parameter parsing for session ID
- Session validation and error handling
- Connection state management with backend
- Automatic session cleanup on completion

#### Admin Interface Components

**SessionDashboard**
- Table view of all pre-consultation sessions
- Filtering and sorting capabilities
- Status indicators (active, completed, closed)
- Quick actions for session management

**SessionDetails**
- Complete Q&A transcript display organized by stages
- Customer information and session metadata
- Action buttons for session closure/archival

**ReportViewer**
- Markdown rendering for 1-page summaries
- AWS documentation recommendations display
- Export capabilities for reports

**SessionCreator**
- Form for creating new pre-consultation sessions
- Customer contact information input
- Authority target specification
- URL generation and sharing

### Backend API Endpoints

#### Chat API (`/api/chat`)

**POST /api/chat/message**
```typescript
interface ChatMessageRequest {
  sessionId: string;
  message: string;
  messageId: string;
}

interface ChatMessageResponse {
  response: string;
  stage: ConversationStage;
  isComplete: boolean;
  nextQuestions?: string[];
  salesRepInfo?: SalesRepresentative;
}
```

**GET /api/chat/session/{sessionId}**
```typescript
interface SessionResponse {
  sessionId: string;
  status: 'active' | 'completed' | 'expired';
  currentStage: ConversationStage;
  conversationHistory: Message[];
  customerInfo: CustomerInfo;
}
```

#### Admin API (`/api/admin`)

**POST /api/admin/sessions**
```typescript
interface CreateSessionRequest {
  customerName: string;
  customerEmail: string;
  customerCompany: string;
  targetAuthority: string;
  salesRepId: string;
  expirationDate?: string;
}

interface CreateSessionResponse {
  sessionId: string;
  sessionUrl: string;
  expirationDate: string;
}
```

**GET /api/admin/sessions**
```typescript
interface SessionListResponse {
  sessions: SessionSummary[];
  pagination: PaginationInfo;
}
```

**GET /api/admin/sessions/{sessionId}/report**
```typescript
interface SessionReportResponse {
  sessionId: string;
  summary: string; // AI-generated markdown summary using Bedrock
  qnaTranscript: ConversationStage[];
  awsDocumentation: DocumentationRecommendation[];
  customerProfile: CustomerProfile;
}
```

## Data Models

### DynamoDB Table Design

#### Sessions Table
```typescript
interface SessionRecord {
  PK: string; // SESSION#{sessionId}
  SK: string; // METADATA
  sessionId: string;
  status: 'active' | 'completed' | 'closed' | 'expired';
  customerInfo: {
    name: string;
    email: string;
    company: string;
    targetAuthority: string;
  };
  salesRepId: string;
  createdAt: string;
  expirationDate: string;
  completedAt?: string;
  currentStage: ConversationStage;
  GSI1PK: string; // SALESREP#{salesRepId}
  GSI1SK: string; // SESSION#{createdAt}
}
```

#### Conversation Messages Table
```typescript
interface MessageRecord {
  PK: string; // SESSION#{sessionId}
  SK: string; // MESSAGE#{timestamp}#{messageId}
  sessionId: string;
  messageId: string;
  timestamp: string;
  sender: 'customer' | 'bot';
  content: string;
  stage: ConversationStage;
  metadata?: {
    technicalLevel?: 'beginner' | 'intermediate' | 'advanced';
    extractedInfo?: ExtractedInformation;
  };
}
```

#### Session Analysis Table
```typescript
interface AnalysisRecord {
  PK: string; // SESSION#{sessionId}
  SK: string; // ANALYSIS
  sessionId: string;
  summary: string; // AI-generated markdown summary
  extractedRequirements: {
    authority: AuthorityInfo;
    business: BusinessInfo;
    awsServices: AWSServiceInterest[];
    technical: TechnicalRequirements;
    timeline: TimelineInfo;
  };
  awsDocumentationRecommendations: DocumentationRecommendation[];
  generatedAt: string;
}
```

### TypeScript Interfaces

```typescript
enum ConversationStage {
  AUTHORITY = 'authority',
  BUSINESS = 'business', 
  AWS_SERVICES = 'aws_services',
  TECHNICAL = 'technical',
  NEXT_STEPS = 'next_steps',
  COMPLETED = 'completed'
}

interface AuthorityInfo {
  role: string;
  decisionMakers: string[];
  budgetApprover: string;
  technicalDecisionMaker: string;
}

interface BusinessInfo {
  industry: string;
  mainServices: string[];
  businessProblems: string[];
  awsGoals: string[];
  itChallenges: string[];
  expansionPlans?: string;
}

interface TechnicalRequirements {
  currentTechStack: string[];
  expectedUsers: number;
  trafficScale: string;
  availabilityRequirements: string;
  backupRequirements: string;
  performanceRequirements: string[];
  complianceRequirements: string[];
}

interface TimelineInfo {
  projectDeadline: string;
  meetingPreference: string;
  pocInterest: boolean;
  budgetApprovalTimeline: string;
  additionalParticipants: string[];
}

interface DocumentationRecommendation {
  title: string;
  url: string;
  category: 'service' | 'architecture' | 'compliance' | 'best-practices';
  relevanceScore: number;
  description: string;
}

interface SalesRepresentative {
  name: string;
  email: string;
  phone?: string;
  region: string;
}
```

## Error Handling

### Frontend Error Handling

**Network Errors**
- Implement retry logic with exponential backoff
- Display user-friendly error messages
- Maintain conversation state during temporary failures
- Provide offline indicators when appropriate

**Session Errors**
- Handle expired or invalid session URLs gracefully
- Redirect to appropriate error pages with clear messaging
- Provide contact information for manual assistance

**Validation Errors**
- Real-time input validation with clear feedback
- Prevent submission of incomplete required fields
- Guide users to correct input format issues

### Backend Error Handling

**Lambda Function Errors**
- Structured error responses with appropriate HTTP status codes
- Comprehensive logging for debugging and monitoring
- Graceful degradation when external services are unavailable

**DynamoDB Errors**
- Retry logic for throttling and temporary failures
- Proper handling of conditional write failures
- Data consistency checks and recovery procedures

**Bedrock API Errors**
- Fallback responses when AI service is unavailable
- Rate limiting and quota management
- Content filtering and safety checks

## Security and Data Protection

### Data Security

**Encryption and Transport Security**
- All data transmission uses HTTPS/TLS encryption (Requirement 10.1)
- DynamoDB encryption at rest using AWS managed keys
- Secure API Gateway endpoints with proper SSL/TLS configuration
- Content Security Policy (CSP) headers for web applications

**Authentication and Authorization**
- AWS Cognito User Pool for admin authentication with @amazon.com domain restriction
- JWT token-based authentication for admin API access
- Session-based access control for customer conversations
- Proper IAM roles and policies with least privilege principle

**Input Validation and Sanitization**
- Server-side input validation for all API endpoints
- Content filtering and safety checks for customer messages
- SQL injection and XSS prevention measures
- Rate limiting and abuse prevention mechanisms

### Data Management

**Data Retention and Privacy**
- Configurable data retention policies for conversation data (Requirement 10.2)
- Secure data deletion when sessions are closed/archived (Requirement 10.3)
- Customer data anonymization options for long-term analytics
- GDPR and privacy compliance considerations

**Access Control**
- Role-based access control for admin users (Requirement 10.4)
- Session isolation to prevent cross-customer data access
- Audit logging for all data access and modifications
- Secure session management with proper expiration handling

**Monitoring and Compliance**
- CloudWatch logging for security events and access patterns
- Automated alerts for suspicious activities or security violations
- Regular security assessments and penetration testing
- Compliance with AWS security best practices and standards

## Testing Strategy

### Unit Testing

**Frontend Testing**
- Jest and React Testing Library for component testing
- Mock API responses for isolated component testing
- Test conversation flow state management
- Validate Cloudscape component integration

**Backend Testing**
- Jest for Lambda function unit tests
- Mock AWS SDK calls for isolated testing
- Test conversation logic and stage transitions
- Validate data transformation and storage operations

### Integration Testing

**API Integration**
- Test complete request/response cycles
- Validate data persistence in DynamoDB
- Test Bedrock integration with sample conversations
- Verify error handling across service boundaries

**End-to-End Testing**
- Cypress for full user journey testing
- Test complete conversation flows from start to finish
- Validate admin interface functionality
- Test session lifecycle management

### Performance Testing

**Load Testing**
- Simulate concurrent user conversations
- Test DynamoDB read/write capacity scaling
- Validate Lambda cold start performance
- Monitor Bedrock API response times

**Scalability Testing**
- Test auto-scaling behavior under load
- Validate cost optimization at scale
- Test data retention and cleanup processes

### Security Testing

**Authentication Testing**
- Validate session security and expiration
- Test admin interface access controls
- Verify data encryption in transit and at rest

**Input Validation Testing**
- Test for injection attacks and malicious input
- Validate content filtering and safety measures
- Test rate limiting and abuse prevention