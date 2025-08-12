import json
import boto3
import os
import urllib3
from utils import lambda_response, get_timestamp

sqs = boto3.client('sqs')
ANALYSIS_QUEUE_URL = os.environ.get('ANALYSIS_QUEUE_URL')
DEFAULT_MODEL_ID = 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0'

def handle_session_stream(event, context):
    """Handle DynamoDB Streams events for session status changes"""
    
    for record in event.get('Records', []):
        event_name = record.get('eventName')
        
        # Handle TTL-based session expiration (REMOVE events)
        if event_name == 'REMOVE':
            old_image = record.get('dynamodb', {}).get('OldImage', {})
            session_id = old_image.get('sessionId', {}).get('S', '')
            
            if session_id:
                print(f"Session {session_id} expired via TTL - cleaning up S3 files")
                cleanup_session_files(session_id)
        
        elif event_name == 'MODIFY':
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
                
                # Send Slack notification
                send_slack_notification(session_id, customer_info, old_status, new_status)
                
                # Enqueue analysis request
                enqueue_analysis_request(session_id)
    
    return lambda_response(200, {'message': 'Stream processed successfully'})

def send_slack_notification(session_id, customer_info, old_status, new_status):
    """Send Slack notification via Workflow webhook when session status changes to completed"""
    try:
        slack_webhook_url = os.environ.get('SLACK_WEBHOOK_URL')
        
        if not slack_webhook_url:
            print(f"No Slack webhook URL configured, skipping notification for session {session_id}")
            return
        
        # Get additional session data for rich notification
        session_data = get_session_details_for_notification(session_id)
        
        # Build payload for Workflow webhook
        payload = build_workflow_slack_payload(session_id, customer_info, session_data, old_status, new_status)
        
        # Send HTTP POST request to Slack webhook
        http = urllib3.PoolManager()
        response = http.request(
            'POST',
            slack_webhook_url,
            body=json.dumps(payload),
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status == 200:
            print(f"Slack notification sent successfully for session {session_id}")
        else:
            print(f"Failed to send Slack notification for session {session_id}. Status: {response.status}")
            
    except Exception as e:
        print(f"Error sending Slack notification for session {session_id}: {str(e)}")

def build_workflow_slack_payload(session_id, customer_info, session_data, old_status, new_status):
    """Build simple payload for Slack Workflow webhook (matches your example format)"""
    
    customer_name = customer_info.get('name', {}).get('S', 'Unknown')
    customer_company = customer_info.get('company', {}).get('S', 'Unknown')
    customer_email = customer_info.get('email', {}).get('S', 'Unknown')
    customer_title = customer_info.get('title', {}).get('S', '')
    
    # Extract sales rep info properly
    sales_rep_email = session_data.get('sales_rep_email', 'Unknown')
    
    # Debug logging
    print(f"Building Slack payload for session {session_id}")
    print(f"Sales rep info: email={sales_rep_email}")
    print(f"Customer info: name={customer_name}, company={customer_company}, email={customer_email}")
    print(f"Session data keys: {list(session_data.keys())}")
    
    # Calculate session duration and format completion time
    duration_text = "Unknown"
    completed_at_formatted = "Unknown"
    
    if session_data.get('completed_at'):
        try:
            from datetime import datetime
            completed = datetime.fromisoformat(session_data['completed_at'].replace('Z', '+00:00'))
            completed_at_formatted = completed.strftime('%Y-%m-%d %H:%M:%S UTC')
            
            if session_data.get('created_at'):
                created = datetime.fromisoformat(session_data['created_at'].replace('Z', '+00:00'))
                duration = completed - created
                duration_minutes = int(duration.total_seconds() / 60)
                if duration_minutes < 60:
                    duration_text = f"{duration_minutes} minutes"
                else:
                    hours = duration_minutes // 60
                    minutes = duration_minutes % 60
                    duration_text = f"{hours}h {minutes}m"
        except Exception as e:
            print(f"Error calculating duration: {str(e)}")
            duration_text = "Unknown"
            completed_at_formatted = session_data.get('completed_at', 'Unknown')
    
    # Format customer info with rich details
    customer_display = f"{customer_name}"
    if customer_title:
        customer_display += f" ({customer_title})"
    customer_display += f" from {customer_company} ({customer_email})"
    
    # Add session statistics
    message_stats = f"{session_data.get('message_count', 0)} messages"
    if session_data.get('customer_messages', 0) > 0:
        message_stats += f" ({session_data.get('customer_messages', 0)} customer, {session_data.get('bot_messages', 0)} AI)"
    
    # Add conversation preview if available
    conversation_preview = ""
    if session_data.get('first_message'):
        conversation_preview = f"First message: {session_data['first_message'][:150]}..."
    
    # Get admin URL from environment variable
    cloudfront_url = os.environ.get('CLOUDFRONT_URL', 'https://localhost:3000')
    
    # Build the payload matching your example format
    payload = {
        "session_id": session_id,
        "customer": customer_display,
        "new_status": new_status,
        "old_status": old_status,
        # Additional rich data for Workflow to use
        "sales_rep": f"{sales_rep_email}",
        "duration": duration_text,
        "message_stats": message_stats,
        "conversation_preview": conversation_preview,
        "admin_url": f"{cloudfront_url}/admin/sessions/{session_id}",
        "completed_at": completed_at_formatted
    }
    
    return payload

def get_session_details_for_notification(session_id):
    """Get additional session details for rich notification"""
    try:
        dynamodb = boto3.resource('dynamodb')
        
        # Get session metadata
        sessions_table = dynamodb.Table('mte-sessions')
        session_resp = sessions_table.get_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'}
        )
        
        session_data = {}
        if 'Item' in session_resp:
            session = session_resp['Item']
            session_data = {
                'created_at': session.get('createdAt', ''),
                'completed_at': session.get('completedAt', ''),
                'sales_rep_email': session.get('salesRepEmail', ''),
                'sales_rep_info': session.get('salesRepInfo', {}),
                'agent_id': session.get('agentId', '')
            }
            
            # Debug logging
            print(f"Session data retrieved: {session_data}")
        
        # Get conversation messages
        messages_table = dynamodb.Table('mte-messages')
        messages_resp = messages_table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'SESSION#{session_id}'},
            ScanIndexForward=True
        )
        
        messages = messages_resp.get('Items', [])
        session_data['message_count'] = len(messages)
        session_data['customer_messages'] = len([m for m in messages if m.get('sender') == 'customer'])
        session_data['bot_messages'] = len([m for m in messages if m.get('sender') == 'bot'])
        
        # Get conversation summary (first and last messages)
        if messages:
            first_content = messages[0].get('content', '')
            last_content = messages[-1].get('content', '')
            
            session_data['first_message'] = first_content[:150] + '...' if len(first_content) > 150 else first_content
            session_data['last_message'] = last_content[:150] + '...' if len(last_content) > 150 else last_content
        
        print(f"Final session data for notification: {session_data}")
        return session_data
        
    except Exception as e:
        print(f"Error getting session details for notification: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return {}



def enqueue_analysis_request(session_id):
    """Enqueue analysis request to SQS"""
    try:
        if not ANALYSIS_QUEUE_URL:
            print(f"No analysis queue URL configured, skipping analysis for session {session_id}")
            return
        
        message = {
            'sessionId': session_id,
            'modelId': DEFAULT_MODEL_ID,
            'requestedAt': get_timestamp(),
            'triggeredBy': 'session_completion'
        }
        
        sqs.send_message(
            QueueUrl=ANALYSIS_QUEUE_URL,
            MessageBody=json.dumps(message)
        )
        
        print(f"Analysis request enqueued for session {session_id}")
        
    except Exception as e:
        print(f"Error enqueuing analysis request for session {session_id}: {str(e)}")

def cleanup_session_files(session_id):
    """Clean up S3 files when session expires via TTL"""
    try:
        s3_client = boto3.client('s3')
        bucket_name = os.environ.get('WEBSITE_BUCKET')
        
        if not bucket_name:
            print(f"No S3 bucket configured, skipping file cleanup for session {session_id}")
            return
        
        # List and delete all files for this session
        prefix = f"uploads/{session_id}/"
        
        response = s3_client.list_objects_v2(
            Bucket=bucket_name,
            Prefix=prefix
        )
        
        if 'Contents' in response:
            for obj in response['Contents']:
                s3_client.delete_object(
                    Bucket=bucket_name,
                    Key=obj['Key']
                )
                print(f"Deleted S3 file: {obj['Key']}")
            
            print(f"Cleaned up {len(response['Contents'])} files for expired session {session_id}")
        else:
            print(f"No files found for expired session {session_id}")
            
    except Exception as e:
        print(f"Error cleaning up files for session {session_id}: {str(e)}")