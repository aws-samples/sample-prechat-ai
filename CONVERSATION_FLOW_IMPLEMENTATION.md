# Conversation Flow Management Implementation

## Overview

This implementation provides comprehensive conversation flow management for the MTE Pre-consultation Chatbot customer interface, including state management, stage progression, context preservation, adaptive UI, and session cleanup functionality.

## Components Implemented

### 1. ConversationFlow Component (`src/components/ConversationFlow.tsx`)

**Core Features:**
- React Context-based state management for conversation flow
- Stage progression with automatic and manual transitions
- Context preservation across conversation stages
- Session persistence using sessionStorage
- Adaptive prompts based on technical level detection
- Conversation completion handling with sales rep information display
- Session cleanup and conversation disabling after completion

**Key Functions:**
- `ConversationFlowProvider`: Main provider component for conversation state
- `useConversationFlow`: Hook to access conversation flow context
- `getStageTitle()`: Returns human-readable stage titles
- `getStageDescription()`: Returns stage descriptions for UI guidance
- `getAdaptivePrompt()`: Generates adaptive prompts based on technical level
- `isStageComplete()`: Evaluates stage completion status
- `getNextStage()`: Determines next stage in conversation flow
- `shouldShowSalesRepInfo()`: Controls sales rep info display
- `cleanupSession()`: Handles session cleanup and data removal

**State Management:**
```typescript
interface ConversationState {
  currentStage: ConversationStage;
  messages: Message[];
  isComplete: boolean;
  salesRepInfo?: SalesRepresentative;
  technicalLevel?: TechnicalLevel;
  stageProgress: number;
  contextData: Record<string, any>;
  isDisabled: boolean;
}
```

### 2. Enhanced ChatInterface (`src/components/ChatInterface.tsx`)

**Enhancements:**
- Integration with ConversationFlow for state synchronization
- Stage-specific guidance alerts
- Sales representative information display on completion
- Adaptive input placeholders based on current stage
- Conversation disabling after completion
- Automatic session cleanup handling

**New UI Elements:**
- `SalesRepInfo`: Component for displaying sales rep contact information
- `StageGuidance`: Component providing contextual guidance for each stage
- Stage-specific input placeholders for better user experience

### 3. Enhanced ConversationProgress (`src/components/ConversationProgress.tsx`)

**Features:**
- Integration with ConversationFlow for dynamic progress tracking
- Stage completion badges with color coding
- Detailed progress indicators showing both overall and stage-specific progress
- Visual stage status indicators (completed, current, upcoming)

### 4. CompletedConversation Component (`src/components/CompletedConversation.tsx`)

**Features:**
- Post-completion information display
- Sales representative contact information
- Next steps guidance
- Automatic session cleanup after 5 minutes
- Manual session closure functionality

### 5. Enhanced MessageInput (`src/components/MessageInput.tsx`)

**Enhancements:**
- Support for adaptive placeholders based on conversation stage
- Better integration with conversation flow state

### 6. Updated Pages

**ChatPage (`src/pages/ChatPage.tsx`):**
- Wrapped ChatInterface with ConversationFlowProvider
- Proper initialization with session data

**CompletedPage (`src/pages/CompletedPage.tsx`):**
- Uses ConversationFlowProvider for state management
- Displays CompletedConversation component
- Handles session cleanup on completion

## Stage Configuration

The conversation flow supports 5 main stages plus completion:

1. **AUTHORITY**: Authority & Decision Making
2. **BUSINESS**: Business Requirements  
3. **AWS_SERVICES**: AWS Services Interest
4. **TECHNICAL**: Technical Requirements
5. **NEXT_STEPS**: Next Steps & Timeline
6. **COMPLETED**: Consultation Complete

Each stage has:
- Descriptive title and description
- Adaptive prompts based on technical level (Beginner, Intermediate, Advanced)
- Completion criteria and progress tracking
- Context preservation across transitions

## Adaptive UI Features

### Technical Level Adaptation
- **Beginner**: Simplified language, more explanations
- **Intermediate**: Balanced technical and business language
- **Advanced**: Technical terminology, architecture-focused questions

### Stage-Specific Guidance
- Contextual alerts explaining current stage purpose
- Adaptive input placeholders guiding user responses
- Progress indicators showing completion status

### Conversation Completion
- Sales representative information display
- Next steps guidance
- Session cleanup and disabling
- Automatic timeout handling

## Session Management

### Persistence
- Conversation state saved to sessionStorage
- Automatic restoration on page reload
- Session-specific data isolation

### Cleanup
- Manual cleanup on conversation completion
- Automatic cleanup after timeout
- Session data removal from storage
- Conversation disabling to prevent further input

## Testing

### Unit Tests (`src/components/__tests__/ConversationFlow.test.tsx`)
- State management functionality
- Stage transitions and progression
- Conversation completion handling
- Session persistence and restoration
- Adaptive prompt generation

### Integration Tests (`src/components/__tests__/ChatInterface.integration.test.tsx`)
- Complete user interaction flow
- Stage guidance display
- Message submission and response handling
- Completion state management

## Usage

```typescript
// Wrap your chat interface with the provider
<ConversationFlowProvider
  sessionId={session.sessionId}
  initialMessages={session.conversationHistory}
  initialStage={session.currentStage}
>
  <ChatInterface session={session} />
</ConversationFlowProvider>

// Access conversation flow in components
const { 
  state, 
  dispatch, 
  getStageTitle, 
  isStageComplete,
  cleanupSession 
} = useConversationFlow();
```

## Key Benefits

1. **Centralized State Management**: Single source of truth for conversation state
2. **Adaptive User Experience**: UI adapts based on user's technical level and current stage
3. **Context Preservation**: Maintains conversation context across stage transitions
4. **Robust Session Handling**: Proper cleanup and persistence mechanisms
5. **Extensible Architecture**: Easy to add new stages or modify flow logic
6. **Comprehensive Testing**: Well-tested components with unit and integration tests

## Requirements Fulfilled

✅ **Requirement 3.1**: 5-stage conversation flow implementation  
✅ **Requirement 3.2**: Contextually appropriate follow-up questions  
✅ **Requirement 3.3**: Adaptive conversation flow based on customer responses  
✅ **Requirement 3.5**: Sales rep information display and conversation disabling  
✅ **Requirement 4.4**: Stage summaries and confirmation of understanding  

This implementation provides a robust, scalable foundation for managing conversation flow in the MTE Pre-consultation Chatbot customer interface.