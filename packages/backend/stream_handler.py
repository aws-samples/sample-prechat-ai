import json
import boto3
import os
from utils import lambda_response, get_timestamp

sqs = boto3.client('sqs')
sns = boto3.client('sns')
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
                
                # Send completion email to sales representative
                send_completion_email(session_id, customer_info, sales_rep_email)
                
                # Send SMS notification to sales representative
                send_completion_sms(session_id, customer_info, sales_rep_email)
                
                # Enqueue analysis request
                enqueue_analysis_request(session_id)
    
    return lambda_response(200, {'message': 'Stream processed successfully'})

def send_completion_email(session_id, customer_info, sales_rep_email):
    """Send completion email to sales representative"""
    try:
        customer_name = customer_info.get('name', {}).get('S', '')
        customer_company = customer_info.get('company', {}).get('S', '')
        
        print(f"Sending completion email for session {session_id}")
        print(f"Customer: {customer_name} from {customer_company}")
        print(f"Sales Rep: {sales_rep_email}")
        
        # TODO: Implement SES email sending
        # ses = boto3.client('ses')
        # ses.send_email(
        #     Source='noreply@example.com',
        #     Destination={'ToAddresses': [sales_rep_email]},
        #     Message={
        #         'Subject': {'Data': f'Pre-consultation completed: {customer_name}'},
        #         'Body': {
        #             'Text': {
        #                 'Data': f'Customer {customer_name} from {customer_company} has completed their pre-consultation session {session_id}.'
        #             }
        #         }
        #     }
        # )
        
    except Exception as e:
        print(f"Error sending completion email: {str(e)}")

def send_completion_sms(session_id, customer_info, sales_rep_email):
    """Send SMS notification to sales representative"""
    try:
        customer_name = customer_info.get('name', {}).get('S', '')
        customer_company = customer_info.get('company', {}).get('S', '')
        
        # Get sales rep phone from Cognito (would need to implement)
        # For now, use a placeholder or skip if no phone available
        sales_rep_phone = get_sales_rep_phone(sales_rep_email)
        
        if not sales_rep_phone:
            print(f"No phone number found for sales rep {sales_rep_email}, skipping SMS")
            return
        
        message = f"Pre-consultation completed: {customer_name} from {customer_company}. Session: {session_id}"
        
        sns.publish(
            PhoneNumber=sales_rep_phone,
            Message=message
        )
        
        print(f"SMS sent to {sales_rep_phone} for session {session_id}")
        
    except Exception as e:
        print(f"Error sending SMS notification: {str(e)}")

def get_sales_rep_phone(sales_rep_email):
    """Get sales rep phone number from Cognito user attributes"""
    try:
        # TODO: Implement Cognito user lookup by email
        # cognito = boto3.client('cognito-idp')
        # response = cognito.list_users(
        #     UserPoolId=os.environ.get('USER_POOL_ID'),
        #     Filter=f'email = "{sales_rep_email}"'
        # )
        # if response['Users']:
        #     attributes = {attr['Name']: attr['Value'] for attr in response['Users'][0]['Attributes']}
        #     return attributes.get('phone_number')
        return None  # Placeholder - implement Cognito lookup
    except Exception as e:
        print(f"Error getting sales rep phone: {str(e)}")
        return None

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