import json
import boto3
from utils import lambda_response

def handle_session_stream(event, context):
    """Handle DynamoDB Streams events for session status changes"""
    
    for record in event.get('Records', []):
        event_name = record.get('eventName')
        
        if event_name == 'MODIFY':
            # Check if session status changed to completed
            old_image = record.get('dynamodb', {}).get('OldImage', {})
            new_image = record.get('dynamodb', {}).get('NewImage', {})
            
            old_status = old_image.get('status', {}).get('S', '')
            new_status = new_image.get('status', {}).get('S', '')
            
            if old_status != 'completed' and new_status == 'completed':
                session_id = new_image.get('sessionId', {}).get('S', '')
                customer_info = new_image.get('customerInfo', {}).get('M', {})
                sales_rep_email = new_image.get('salesRepEmail', {}).get('S', '')
                
                print(f"Session {session_id} completed!")
                print(f"Customer: {customer_info.get('name', {}).get('S', '')}")
                print(f"Sales Rep: {sales_rep_email}")
                
                # Here you can add additional processing:
                # - Send notification emails
                # - Update CRM systems
                # - Generate reports
                # - Trigger workflows
                
                # Example: Send notification (implement as needed)
                send_completion_notification(session_id, customer_info, sales_rep_email)
    
    return lambda_response(200, {'message': 'Stream processed successfully'})

def send_completion_notification(session_id, customer_info, sales_rep_email):
    """Send notification when session is completed"""
    try:
        # Example implementation - replace with your notification logic
        print(f"Sending completion notification for session {session_id}")
        print(f"Customer: {customer_info.get('name', {}).get('S', '')}")
        print(f"Company: {customer_info.get('company', {}).get('S', '')}")
        print(f"Sales Rep: {sales_rep_email}")
        
        # You can implement:
        # - SES email notifications
        # - SNS notifications
        # - Slack/Teams webhooks
        # - CRM API calls
        
    except Exception as e:
        print(f"Error sending notification: {str(e)}")