# Requirements Document

## Introduction

This feature redesigns the AI Report generation system for the MTE Pre-consultation Chatbot. The current agent-based reporting system will be replaced with a streamlined approach that uses direct LLM analysis to generate structured conversation insights. The new system will store analysis results in DynamoDB and provide a modern UI for viewing reports with separate containers for different analysis types.

## Requirements

### Requirement 1

**User Story:** As an AWS sales representative, I want to request AI analysis of customer conversations by selecting an LLM model, so that I can get structured insights without the complexity of agent-based processing.

#### Acceptance Criteria

1. WHEN I access the report tab THEN the system SHALL display an "AI Analysis" button
2. WHEN I click "AI Analysis" THEN the system SHALL present a dropdown to select from available LLM models
3. WHEN I select an LLM model and confirm THEN the system SHALL initiate conversation analysis using the selected model
4. WHEN analysis is initiated THEN the system SHALL display a loading state with progress indication
5. WHEN analysis is in progress THEN the client SHALL wait up to 300 seconds for completion
6. IF analysis takes longer than 300 seconds THEN the system SHALL timeout gracefully with an appropriate error message

### Requirement 2

**User Story:** As an AWS sales representative, I want the AI analysis to produce four specific types of insights, so that I have comprehensive structured data about the customer conversation.

#### Acceptance Criteria

1. WHEN AI analysis completes THEN the system SHALL generate a Markdown summary of the conversation
2. WHEN AI analysis completes THEN the system SHALL produce BANT (Budget, Authority, Need, Timeline) analysis
3. WHEN AI analysis completes THEN the system SHALL identify relevant AWS services based on customer requirements
4. WHEN AI analysis completes THEN the system SHALL suggest relevant customer case studies
5. WHEN analysis is complete THEN all four analysis components SHALL be stored in the mte-sessions DynamoDB table
6. WHEN storing analysis results THEN the system SHALL maintain data integrity and proper formatting

### Requirement 3

**User Story:** As an AWS sales representative, I want to view the AI analysis results in a well-organized report interface, so that I can easily consume the insights and prepare for customer meetings.

#### Acceptance Criteria

1. WHEN analysis is completed OR I click refresh THEN the system SHALL call the report retrieval API
2. WHEN report data is retrieved THEN the system SHALL display four separate containers for each analysis type
3. WHEN displaying the Markdown summary THEN the system SHALL render it with proper formatting
4. WHEN displaying BANT analysis THEN the system SHALL present it in a structured, readable format
5. WHEN displaying AWS services THEN the system SHALL show them in an organized list or grid
6. WHEN displaying customer case studies THEN the system SHALL present them with clear titles and descriptions
7. WHEN no analysis data exists THEN the system SHALL show appropriate empty states for each container

### Requirement 4

**User Story:** As a system administrator, I want the backend infrastructure to support long-running analysis requests, so that complex AI processing doesn't timeout prematurely.

#### Acceptance Criteria

1. WHEN configuring Lambda functions THEN the system SHALL set timeout to support up to 300 seconds of processing
2. WHEN configuring API Gateway THEN the system SHALL set integration timeout to prevent premature connection termination
3. WHEN processing analysis requests THEN the system SHALL handle long-running operations without dropping connections
4. WHEN Lambda execution approaches timeout THEN the system SHALL implement graceful degradation or error handling
5. WHEN API Gateway timeout is reached THEN the system SHALL return appropriate error responses

### Requirement 5

**User Story:** As a developer, I want to remove all legacy agent-based reporting functionality, so that the codebase is clean and maintainable without deprecated features.

#### Acceptance Criteria

1. WHEN implementing the new system THEN all agent-based report generation code SHALL be removed
2. WHEN implementing the new system THEN all prompt generation step functionality SHALL be removed
3. WHEN implementing the new system THEN legacy Markdown report generation features SHALL be removed
4. WHEN removing legacy code THEN the system SHALL ensure no breaking changes to other functionality
5. WHEN cleanup is complete THEN the codebase SHALL contain only the new direct LLM analysis approach

### Requirement 6

**User Story:** As an AWS sales representative, I want the system to handle errors gracefully during AI analysis, so that I understand what went wrong and can take appropriate action.

#### Acceptance Criteria

1. WHEN LLM analysis fails THEN the system SHALL display a clear error message explaining the failure
2. WHEN network issues occur THEN the system SHALL provide retry options
3. WHEN timeout occurs THEN the system SHALL inform the user and suggest trying again later
4. WHEN invalid session data is encountered THEN the system SHALL show appropriate validation errors
5. WHEN DynamoDB storage fails THEN the system SHALL log errors and notify the user appropriately