<!------------------------------------------------------------------------------------
   SNS Notification System for Session Completion Events
-------------------------------------------------------------------------------------> 
SNS Notification System:

1. A lambda that consumes the DynamoDB Streams checks when session status becomes 'Completed': packages/backend/stream_handler.py
2. When a session is completed, the stream handler publishes a structured message to SNS Topic: ${AWS::StackName}-slack-notification
3. The SNS topic is encrypted by default (AWS managed key)
4. The message follows a specific schema format with rich metadata for downstream consumers
5. External systems (like Slack, Teams, or custom applications) can subscribe to the SNS topic to receive notifications

Message Schema:
- version: "1.0"
- source: "mte-prechat" 
- id: "session-{sessionId}"
- content: Contains title, description, nextSteps, and keywords
- metadata: Contains threadId, summary, eventType, relatedResources, and additionalContext with session details

The notification includes:
- Customer information (name, company, email)
- Sales representative details
- Session duration and statistics
- Direct link to admin dashboard
- Actionable next steps for follow-up