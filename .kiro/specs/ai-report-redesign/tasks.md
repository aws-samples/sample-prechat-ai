# Implementation Plan

- [x] 1. Update backend infrastructure configuration for long-running operations
  - Modify Lambda function timeout to 300 seconds in template.yaml
  - Configure API Gateway integration timeout to 300 seconds
  - Update memory allocation for analysis functions to handle large conversation processing
  - _Requirements: 1.5, 4.1, 4.2, 4.3_

- [x] 2. Implement new conversation analysis backend function
  - [x] 2.1 Create analyze_conversation function in admin_handler.py
    - Write function to process conversation history with selected LLM model
    - Implement structured prompt generation using meet-logs-md.md template
    - Add JSON parsing and validation for LLM responses
    - Include error handling for LLM failures and timeouts
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 2.4, 6.1_

  - [x] 2.2 Implement DynamoDB storage for analysis results
    - Add aiAnalysis attribute structure to mte-sessions table updates
    - Write functions to store markdownSummary, bantAnalysis, awsServices, customerCases
    - Implement atomic updates to prevent partial data corruption
    - Add timestamp and model tracking for analysis metadata
    - _Requirements: 2.5, 2.6_

  - [x] 2.3 Add comprehensive error handling and logging
    - Implement graceful timeout handling for 300-second operations
    - Add retry logic for transient LLM failures
    - Create detailed error logging for debugging
    - Implement fallback responses for critical failures
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 3. Modify existing report retrieval function
  - [x] 3.1 Update get_session_report function to return structured data
    - Modify function to retrieve aiAnalysis data from DynamoDB
    - Remove on-demand report generation logic
    - Return structured JSON response with four analysis components
    - Add proper error handling for missing analysis data
    - _Requirements: 3.1, 3.2_

  - [x] 3.2 Add API endpoint for new analysis request
    - Create new API Gateway endpoint for POST /admin/sessions/{sessionId}/analyze
    - Configure 300-second timeout for the endpoint
    - Add request validation for modelId parameter
    - Implement proper HTTP status codes and error responses
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. Remove legacy report generation functions
  - Delete generate_optimized_prompt function from admin_handler.py
  - Remove generate_report_with_model function
  - Remove generate_report_with_agent function
  - Clean up unused imports and dependencies
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5. Create new frontend AI analysis report component
  - [x] 5.1 Create AIAnalysisReport component to replace ReportGenerator
    - Build simple interface with AI Analysis button and model selection dropdown
    - Implement 300-second timeout handling with loading indicators
    - Add error handling and retry mechanisms for failed analysis
    - Create refresh functionality to retrieve updated analysis results
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 3.1_

  - [x] 5.2 Implement four separate display containers
    - Create MarkdownSummaryContainer with proper markdown rendering
    - Build BANTAnalysisContainer with structured data display
    - Implement AWSServicesContainer with service recommendations grid
    - Create CustomerCasesContainer with case study cards
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.3 Add empty state handling for containers
    - Implement appropriate empty states when no analysis data exists
    - Add loading states during analysis processing
    - Create error states for failed analysis requests
    - Include retry buttons and user guidance for error scenarios
    - _Requirements: 3.7, 6.1, 6.2_

- [x] 6. Update API service layer
  - [x] 6.1 Add new analyzeConversation API method
    - Create API method for POST /admin/sessions/{sessionId}/analyze
    - Configure 300-second timeout for analysis requests
    - Add proper request/response type definitions
    - Implement error handling and retry logic
    - _Requirements: 1.3, 1.5, 6.2_

  - [x] 6.2 Modify getSessionReport API method
    - Update method to handle new structured response format
    - Remove legacy report generation parameters
    - Add proper TypeScript types for analysis results
    - Update error handling for new response structure
    - _Requirements: 3.1, 3.2_

  - [x] 6.3 Remove legacy API methods
    - Delete generateOptimizedPrompt API method
    - Remove generateReportWithModel API method
    - Remove generateReportWithAgent API method
    - Clean up unused type definitions and interfaces
    - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 7. Update TypeScript types and interfaces
  - [x] 7.1 Create new analysis result types
    - Define AnalysisResults interface with four analysis components
    - Create BANTAnalysis, AWSService, and CustomerCase interfaces
    - Add AnalysisRequest interface for API calls
    - Update existing Session interface to include aiAnalysis property
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 7.2 Remove legacy report generation types
    - Delete ReportAnalysisOptions interface
    - Remove ReportGenerationRequest and ReportGenerationResponse interfaces
    - Clean up unused type imports throughout the application
    - Update component props to use new interfaces
    - _Requirements: 5.5_

- [x] 8. Update AdminSessionDetails page integration
  - Replace ReportGenerator component with AIAnalysisReport component
  - Update report tab to use new analysis interface
  - Ensure proper error handling and loading states
  - Test integration with existing session details functionality
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 9. Final integration and cleanup
  - Integrate AIAnalysisReport component into AdminSessionDetails page
  - Remove all legacy report generation code and unused imports
  - Ensure proper error handling throughout the application
  - Clean up any remaining references to old report system
  - _Requirements: 3.1, 5.4, 5.5_