import json
import boto3
import os
from utils import lambda_response, get_timestamp
from trigger_manager import TriggerManager

sqs = boto3.client('sqs')
ANALYSIS_QUEUE_URL = os.environ.get('ANALYSIS_QUEUE_URL')
DEFAULT_MODEL_ID = 'apac.anthropic.claude-3-5-sonnet-20241022-v2:0'
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
MESSAGES_TABLE = os.environ.get('MESSAGES_TABLE')

# Initialize TriggerManager for domain event-driven triggers
trigger_manager = TriggerManager()

def handle_session_stream(event, context):
    """Handle DynamoDB Streams events for session status changes and trigger execution"""
    
    for record in event.get('Records', []):
        event_name = record.get('eventName')
        
        # Handle TTL-based session expiration (REMOVE events)
        if event_name == 'REMOVE':
            old_image = record.get('dynamodb', {}).get('OldImage', {})
            session_id = old_image.get('sessionId', {}).get('S', '')
            
            if session_id:
                print(f"Session {session_id} expired via TTL - cleaning up S3 files")
                cleanup_session_files(session_id)
        
        elif event_name == 'INSERT':
            new_image = record.get('dynamodb', {}).get('NewImage', {})
            pk = new_image.get('PK', {}).get('S', '')
            sk = new_image.get('SK', {}).get('S', '')
            
            # 세션 생성 이벤트 감지
            if pk.startswith('SESSION#') and sk == 'METADATA':
                session_id = new_image.get('sessionId', {}).get('S', '')
                campaign_id = new_image.get('campaignId', {}).get('S', '')
                customer_info = new_image.get('customerInfo', {}).get('M', {})
                
                event_data = {
                    'event_type': 'SessionCreated',
                    'session_id': session_id,
                    'campaign_id': campaign_id,
                    'campaign_name': new_image.get('campaignName', {}).get('S', ''),
                    'customer_name': customer_info.get('name', {}).get('S', ''),
                    'customer_email': customer_info.get('email', {}).get('S', ''),
                    'customer_company': customer_info.get('company', {}).get('S', ''),
                    'created_at': new_image.get('createdAt', {}).get('S', ''),
                }
                
                print(f"Session {session_id} created - executing triggers")
                trigger_manager.execute_triggers('SessionCreated', event_data, campaign_id)
        
        elif event_name == 'MODIFY':
            old_image = record.get('dynamodb', {}).get('OldImage', {})
            new_image = record.get('dynamodb', {}).get('NewImage', {})
            
            old_status = old_image.get('status', {}).get('S', '')
            new_status = new_image.get('status', {}).get('S', '')
            
            # 세션 완료 이벤트
            if old_status != 'completed' and new_status == 'completed':
                session_id = new_image.get('sessionId', {}).get('S', '')
                campaign_id = new_image.get('campaignId', {}).get('S', '')
                customer_info = new_image.get('customerInfo', {}).get('M', {})
                sales_rep_email = new_image.get('salesRepEmail', {}).get('S', '')
                
                print(f"Session {session_id} completed!")
                
                # 도메인 이벤트 기반 트리거 실행
                session_data = get_session_details_for_notification(session_id)
                cloudfront_url = os.environ.get('CLOUDFRONT_URL', '')
                event_data = {
                    'event_type': 'SessionCompleted',
                    'session_id': session_id,
                    'campaign_id': campaign_id,
                    'campaign_name': new_image.get('campaignName', {}).get('S', ''),
                    'customer_name': customer_info.get('name', {}).get('S', ''),
                    'customer_email': customer_info.get('email', {}).get('S', ''),
                    'customer_company': customer_info.get('company', {}).get('S', ''),
                    'sales_rep_email': sales_rep_email,
                    'completed_at': new_image.get('completedAt', {}).get('S', ''),
                    'created_at': new_image.get('createdAt', {}).get('S', ''),
                    'message_count': session_data.get('message_count', 0),
                    'duration_minutes': _calc_duration_minutes(
                        new_image.get('createdAt', {}).get('S', ''),
                        new_image.get('completedAt', {}).get('S', '')
                    ),
                    'admin_url': f"{cloudfront_url}/admin/sessions/{session_id}" if cloudfront_url else '',
                }
                trigger_manager.execute_triggers('SessionCompleted', event_data, campaign_id)
                
                # 분석 요청 큐잉
                enqueue_analysis_request(session_id)
            
            # 세션 비활성화 이벤트
            elif old_status == 'active' and new_status == 'inactive':
                session_id = new_image.get('sessionId', {}).get('S', '')
                campaign_id = new_image.get('campaignId', {}).get('S', '')
                customer_info = new_image.get('customerInfo', {}).get('M', {})
                
                event_data = {
                    'event_type': 'SessionInactivated',
                    'session_id': session_id,
                    'campaign_id': campaign_id,
                    'customer_name': customer_info.get('name', {}).get('S', ''),
                    'inactivated_at': get_timestamp(),
                }
                trigger_manager.execute_triggers('SessionInactivated', event_data, campaign_id)
    
    return lambda_response(200, {'message': 'Stream processed successfully'})


def handle_campaign_stream(event, context):
    """Handle DynamoDB Streams events for campaign lifecycle changes and trigger execution.

    CampaignsTable에 StreamSpecification 활성화 후 사용 가능합니다.
    campaign_handler.py에서 직접 TriggerManager를 호출하는 방식과 병행 가능하며,
    스트림 기반으로 전환 시 campaign_handler의 트리거 호출을 제거하면 됩니다.
    """

    for record in event.get('Records', []):
        event_name = record.get('eventName')

        if event_name == 'INSERT':
            new_image = record.get('dynamodb', {}).get('NewImage', {})
            pk = new_image.get('PK', {}).get('S', '')

            if pk.startswith('CAMPAIGN#') and new_image.get('SK', {}).get('S', '') == 'METADATA':
                campaign_id = new_image.get('campaignId', {}).get('S', '')
                event_data = {
                    'event_type': 'CampaignCreated',
                    'campaign_id': campaign_id,
                    'campaign_name': new_image.get('campaignName', {}).get('S', ''),
                    'campaign_code': new_image.get('campaignCode', {}).get('S', ''),
                    'owner_email': new_image.get('ownerEmail', {}).get('S', ''),
                    'created_at': new_image.get('createdAt', {}).get('S', ''),
                    'start_date': new_image.get('startDate', {}).get('S', ''),
                    'end_date': new_image.get('endDate', {}).get('S', ''),
                }
                print(f"Campaign {campaign_id} created - executing triggers")
                trigger_manager.execute_triggers('CampaignCreated', event_data, campaign_id)

        elif event_name == 'MODIFY':
            old_image = record.get('dynamodb', {}).get('OldImage', {})
            new_image = record.get('dynamodb', {}).get('NewImage', {})
            pk = new_image.get('PK', {}).get('S', '')

            if pk.startswith('CAMPAIGN#') and new_image.get('SK', {}).get('S', '') == 'METADATA':
                old_status = old_image.get('status', {}).get('S', '')
                new_status = new_image.get('status', {}).get('S', '')

                # 캠페인 종료 이벤트 (active → inactive)
                if old_status == 'active' and new_status == 'inactive':
                    campaign_id = new_image.get('campaignId', {}).get('S', '')
                    event_data = {
                        'event_type': 'CampaignClosed',
                        'campaign_id': campaign_id,
                        'campaign_name': new_image.get('campaignName', {}).get('S', ''),
                        'closed_at': get_timestamp(),
                        'total_sessions': int(new_image.get('sessionCount', {}).get('N', '0')),
                    }
                    print(f"Campaign {campaign_id} closed - executing triggers")
                    trigger_manager.execute_triggers('CampaignClosed', event_data, campaign_id)

    return lambda_response(200, {'message': 'Campaign stream processed successfully'})


def _calc_duration_minutes(created_at: str, completed_at: str) -> int:
    """세션 소요 시간을 분 단위로 계산합니다."""
    try:
        from datetime import datetime
        created = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
        completed = datetime.fromisoformat(completed_at.replace('Z', '+00:00'))
        return int((completed - created).total_seconds() / 60)
    except Exception:
        return 0

def get_session_details_for_notification(session_id):
    """Get additional session details for rich notification"""
    try:
        dynamodb = boto3.resource('dynamodb')
        
        # Get session metadata
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
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
        messages_table = dynamodb.Table(MESSAGES_TABLE)
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
    """Enqueue AgentCore-based analysis request to SQS"""
    try:
        if not ANALYSIS_QUEUE_URL:
            print(f"No analysis queue URL configured, skipping analysis for session {session_id}")
            return
        
        message = {
            'sessionId': session_id,
            'configId': '',  # 빈 값이면 process_analysis에서 세션 캠페인의 summary 설정 자동 조회
            'requestedAt': get_timestamp(),
            'triggeredBy': 'session_completion'
        }
        
        sqs.send_message(
            QueueUrl=ANALYSIS_QUEUE_URL,
            MessageBody=json.dumps(message)
        )
        
        print(f"AgentCore analysis request enqueued for session {session_id}")
        
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
