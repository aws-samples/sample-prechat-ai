# nosemgrep
import json
import boto3
import time
import logging
import os
from decimal import Decimal
from botocore.exceptions import ClientError, ReadTimeoutError
from utils import lambda_response, parse_body, get_timestamp, convert_decimal_to_int, serialize_dynamodb_item

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
bedrock_region = os.environ.get('BEDROCK_REGION', 'ap-northeast-2')
bedrock = boto3.client('bedrock-runtime', region_name=bedrock_region)
sqs = boto3.client('sqs')
ANALYSIS_QUEUE_URL = os.environ.get('ANALYSIS_QUEUE_URL')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
MESSAGES_TABLE = os.environ.get('MESSAGES_TABLE')
CAMPAIGNS_TABLE = os.environ.get('CAMPAIGNS_TABLE')

from agent_runtime import AgentCoreClient, get_agent_config_for_session, get_agent_runtime_arn
from models.agent_config import AgentConfiguration

# AgentCore 클라이언트 (Summary Agent 호출용)
agentcore_client = AgentCoreClient()

def clean_llm_response(content):
    """Clean up LLM response by removing code block markers and trimming"""
    content = content.strip()
    
    # Remove opening code block
    if content.startswith('```'):
        lines = content.split('\n')
        if lines[0].strip().startswith('```'):
            lines = lines[1:]
        content = '\n'.join(lines)
    
    # Remove closing code block
    if content.endswith('```'):
        lines = content.split('\n')
        if lines[-1].strip() == '```':
            lines = lines[:-1]
        elif lines[-1].strip().endswith('```'):
            lines[-1] = lines[-1].replace('```', '').rstrip()
        content = '\n'.join(lines)
    
    return content.strip()

def list_sessions(event, context):
    try:
        query_params = event.get('queryStringParameters') or {}
        sales_rep_id = query_params.get('salesRepId')
        campaign_id = query_params.get('campaignId')
    except (KeyError, TypeError, AttributeError):
        sales_rep_id = None
        campaign_id = None
    
    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        if sales_rep_id:
            # Query by sales rep
            response = sessions_table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={':pk': f'SALESREP#{sales_rep_id}'},
                ScanIndexForward=False
            )
        else:
            # Scan all sessions
            response = sessions_table.scan(
                FilterExpression='SK = :sk AND begins_with(PK, :pk_prefix)',
                ExpressionAttributeValues={
                    ':sk': 'METADATA',
                    ':pk_prefix': 'SESSION#'
                }
            )
        
        sessions = []
        for item in response.get('Items', []):
            # Skip non-session items (like campaigns)
            if not item['PK'].startswith('SESSION#'):
                continue
                
            # Filter by campaign if specified
            if campaign_id and item.get('campaignId') != campaign_id:
                continue
            
            # Extract sessionId from PK (format: SESSION#sessionId)
            session_id = item.get('sessionId') or item['PK'].replace('SESSION#', '')
            
            session_data = {
                'sessionId': session_id,
                'status': item['status'],
                'customerName': item['customerInfo']['name'],
                'customerEmail': item['customerInfo']['email'],
                'customerCompany': item['customerInfo']['company'],
                'customerTitle': item['customerInfo'].get('title', ''),
                'consultationPurposes': item.get('consultationPurposes', ''),
                'createdAt': item['createdAt'],
                'completedAt': item.get('completedAt', ''),
                'salesRepEmail': item.get('salesRepEmail', item.get('salesRepId', '')),
                'agentId': item.get('agentId', ''),
                'campaignId': item.get('campaignId', ''),
                'campaignName': ''  # Will be populated from campaign table if available
                # PIN 번호는 보안상 세션 목록에서 제외
            }
            
            # Get detailed campaign info if campaign is associated
            if item.get('campaignId') and CAMPAIGNS_TABLE:
                try:
                    campaigns_table = dynamodb.Table(CAMPAIGNS_TABLE)
                    campaign_resp = campaigns_table.get_item(
                        Key={'PK': f'CAMPAIGN#{item["campaignId"]}', 'SK': 'METADATA'}
                    )
                    
                    if 'Item' in campaign_resp:
                        campaign = campaign_resp['Item']
                        # Update campaignName with latest value from campaigns table
                        session_data['campaignName'] = campaign['campaignName']
                        session_data['campaignInfo'] = {
                            'campaignCode': campaign['campaignCode'],
                            'description': campaign.get('description', ''),
                            'status': campaign['status'],
                            'ownerName': campaign['ownerName'],
                            'ownerEmail': campaign['ownerEmail']
                        }
                except Exception as e:
                    logger.warning(f"Failed to get campaign info for session {session_id}: {str(e)}")
                    # Continue without campaign info
            
            sessions.append(session_data)
        
        return lambda_response(200, {'sessions': sessions})
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error listing sessions: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error listing sessions: {str(e)}")
        return lambda_response(500, {'error': 'Failed to list sessions'})

def inactivate_session(event, context):
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id:
            return lambda_response(400, {'error': 'Session ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing session ID parameter'})
    
    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET #status = :status',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={':status': 'inactive'}
        )
        
        return lambda_response(200, {'message': 'Session inactivated'})
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error inactivating session {session_id}: {error_code} - {str(e)}")
        if error_code == 'ConditionalCheckFailedException':
            return lambda_response(404, {'error': 'Session not found'})
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except KeyError as e:
        logger.error(f"Missing session ID parameter: {str(e)}")
        return lambda_response(400, {'error': 'Missing session ID'})
    except Exception as e:
        logger.error(f"Unexpected error inactivating session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to inactivate session'})

def delete_session(event, context):
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id:
            return lambda_response(400, {'error': 'Session ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing session ID parameter'})
    
    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        messages_table = dynamodb.Table(MESSAGES_TABLE)
        
        # Delete session metadata
        sessions_table.delete_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        
        # Delete all messages
        messages_resp = messages_table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'SESSION#{session_id}'}
        )
        
        for message in messages_resp.get('Items', []):
            messages_table.delete_item(Key={'PK': message['PK'], 'SK': message['SK']})
        
        return lambda_response(200, {'message': 'Session deleted'})
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error deleting session {session_id}: {error_code} - {str(e)}")
        if error_code == 'ResourceNotFoundException':
            return lambda_response(404, {'error': 'Session not found'})
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except KeyError as e:
        logger.error(f"Missing session ID parameter: {str(e)}")
        return lambda_response(400, {'error': 'Missing session ID'})
    except Exception as e:
        logger.error(f"Unexpected error deleting session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to delete session'})

def get_session_report(event, context):
    """Retrieve stored analysis results from DynamoDB"""
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id:
            return lambda_response(400, {'error': 'Session ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing session ID parameter'})
    
    try:
        # Get session with aiAnalysis data
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        
        if 'Item' not in session_resp:
            logger.error(f"Session {session_id} not found")
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        
        # Check analysis status
        analysis_status = session.get('analysisStatus', 'not_started')
        
        if analysis_status == 'processing':
            return lambda_response(202, {
                'status': 'processing',
                'message': 'Analysis is still in progress. Please check again in a few moments.'
            })
        elif analysis_status == 'failed':
            return lambda_response(500, {
                'status': 'failed',
                'message': 'Analysis failed. Please try running the analysis again.'
            })
        elif 'aiAnalysis' not in session:
            return lambda_response(404, {
                'status': 'not_started',
                'error': 'No analysis data found',
                'message': 'Please run AI analysis first to generate report data'
            })
        
        analysis_data = session['aiAnalysis']
        
        # Validate analysis data structure
        try:
            _validate_analysis_data(analysis_data)
        except ValueError as e:
            logger.error(f"Invalid analysis data structure for session {session_id}: {str(e)}")
            return lambda_response(500, {
                'error': 'Invalid analysis data structure',
                'message': 'Analysis data is corrupted, please re-run analysis'
            })
        
        # Return structured analysis results
        return lambda_response(200, {
            'sessionId': session_id,
            'status': 'completed',
            'analysis': {
                'markdownSummary': analysis_data.get('markdownSummary', ''),
                'bantAnalysis': analysis_data.get('bantAnalysis', {}),
                'awsServices': analysis_data.get('awsServices', []),
                'analyzedAt': analysis_data.get('analyzedAt', ''),
                'modelUsed': analysis_data.get('modelUsed', ''),
                'agentName': analysis_data.get('agentName', ''),
            }
        })
        
    except ClientError as e:
        logger.error(f"DynamoDB error retrieving session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Database error retrieving session'})
    except Exception as e:
        logger.error(f"Unexpected error retrieving report for session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to retrieve report'})



def get_aws_docs_recommendations(messages):
    # Simple keyword-based recommendations
    content = ' '.join([msg['content'].lower() for msg in messages])
    
    recommendations = []
    
    if 'ec2' in content or 'compute' in content:
        recommendations.append({'service': 'EC2', 'url': 'https://docs.aws.amazon.com/ec2/'})
    if 's3' in content or 'storage' in content:
        recommendations.append({'service': 'S3', 'url': 'https://docs.aws.amazon.com/s3/'})
    if 'rds' in content or 'database' in content:
        recommendations.append({'service': 'RDS', 'url': 'https://docs.aws.amazon.com/rds/'})
    if 'lambda' in content or 'serverless' in content:
        recommendations.append({'service': 'Lambda', 'url': 'https://docs.aws.amazon.com/lambda/'})
    
    return recommendations

def get_analysis_status(event, context):
    """Get analysis status for frontend polling"""
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id:
            return lambda_response(400, {'error': 'Session ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing session ID parameter'})
    
    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        analysis_status = session.get('analysisStatus', 'not_started')
        
        response_data = {
            'sessionId': session_id,
            'status': analysis_status
        }
        
        if analysis_status == 'processing':
            response_data['message'] = 'Analysis is in progress'
        elif analysis_status == 'completed':
            response_data['message'] = 'Analysis completed successfully'
            response_data['analyzedAt'] = session.get('aiAnalysis', {}).get('analyzedAt')
        elif analysis_status == 'failed':
            response_data['message'] = 'Analysis failed'
        else:
            response_data['message'] = 'Analysis not started'
        
        return lambda_response(200, response_data)
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error getting analysis status for session {session_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error getting analysis status for session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to get analysis status'})

def get_session_details(event, context):
    """Get detailed session info including PIN (only for session owner)"""
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id:
            return lambda_response(400, {'error': 'Session ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing session ID parameter'})
    
    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        
        # Get campaign info if associated
        campaign_info = None
        campaign_id = session.get('campaignId')
        if campaign_id and CAMPAIGNS_TABLE:
            try:
                campaigns_table = dynamodb.Table(CAMPAIGNS_TABLE)
                campaign_resp = campaigns_table.get_item(
                    Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'}
                )
                
                if 'Item' in campaign_resp:
                    campaign = campaign_resp['Item']
                    campaign_info = {
                        'campaignId': campaign['campaignId'],
                        'campaignName': campaign['campaignName'],
                        'campaignCode': campaign['campaignCode'],
                        'description': campaign.get('description', ''),
                        'status': campaign['status'],
                        'ownerName': campaign['ownerName'],
                        'ownerEmail': campaign['ownerEmail'],
                        'startDate': campaign['startDate'],
                        'endDate': campaign['endDate']
                    }
            except Exception as e:
                logger.warning(f"Failed to get campaign info for session {session_id}: {str(e)}")
        
        response_data = {
            'sessionId': session['sessionId'],
            'status': session['status'],
            'customerInfo': session['customerInfo'],
            'salesRepEmail': session.get('salesRepEmail', session.get('salesRepId', '')),
            'agentId': session.get('agentId', ''),
            'consultationPurposes': session.get('consultationPurposes', ''),
            'pinNumber': session.get('pinNumber', ''),
            'createdAt': session['createdAt'],
            'completedAt': session.get('completedAt', ''),
            'privacyConsentAgreed': session.get('privacyConsentAgreed', False),
            'privacyConsentTimestamp': session.get('privacyConsentTimestamp', ''),
            'meetingLog': session.get('meetingLog', ''),
            'campaignId': session.get('campaignId', ''),
            'campaignName': campaign_info['campaignName'] if campaign_info else session.get('campaignName', '')
        }
        
        # Add detailed campaign info if available
        if campaign_info:
            response_data['campaignInfo'] = campaign_info
        
        return lambda_response(200, response_data)
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error getting session details {session_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except KeyError as e:
        logger.error(f"Missing session ID parameter: {str(e)}")
        return lambda_response(400, {'error': 'Missing session ID'})
    except Exception as e:
        logger.error(f"Unexpected error getting session details {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to get session details'})

def save_meeting_log(event, context):
    """Save meeting log for a session"""
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id:
            return lambda_response(400, {'error': 'Session ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing session ID parameter'})
    
    try:
        body = parse_body(event)
        meeting_log = body.get('meetingLog', '')
        if not isinstance(meeting_log, str):
            return lambda_response(400, {'error': 'Meeting log must be a string'})
    except (ValueError, TypeError) as e:
        logger.error(f"Invalid request body for meeting log: {str(e)}")
        return lambda_response(400, {'error': 'Invalid request body'})
    
    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # Check if session exists
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        # Update meeting log
        timestamp = get_timestamp()
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET meetingLog = :log, meetingLogUpdatedAt = :timestamp',
            ExpressionAttributeValues={
                ':log': meeting_log,
                ':timestamp': timestamp
            }
        )
        
        return lambda_response(200, {
            'message': 'Meeting log saved successfully',
            'sessionId': session_id,
            'updatedAt': timestamp
        })
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error saving meeting log for session {session_id}: {error_code} - {str(e)}")
        if error_code == 'ConditionalCheckFailedException':
            return lambda_response(404, {'error': 'Session not found'})
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except KeyError as e:
        logger.error(f"Missing required parameters for meeting log: {str(e)}")
        return lambda_response(400, {'error': 'Missing required parameters'})
    except Exception as e:
        logger.error(f"Unexpected error saving meeting log for session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to save meeting log'})

def reanalyze_with_meeting_log(event, context):
    """Request re-analysis including meeting log context via AgentCore

    Request Body:
        configId (str): 사용할 AgentConfiguration ID (summary 역할, 선택)
    """
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id:
            return lambda_response(400, {'error': 'Session ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing session ID parameter'})

    try:
        body = parse_body(event)
        config_id = body.get('configId', '')
    except (ValueError, TypeError) as e:
        logger.error(f"Invalid request body for re-analysis request: {str(e)}")
        return lambda_response(400, {'error': 'Invalid request body'})

    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})

        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})

        session = session_resp['Item']
        meeting_log = session.get('meetingLog', '')

        # configId 결정
        if config_id:
            config_resp = sessions_table.get_item(Key={'PK': f'AGENTCONFIG#{config_id}', 'SK': 'METADATA'})
            if 'Item' not in config_resp:
                return lambda_response(404, {'error': 'Agent configuration not found'})
        else:
            _arn, config = get_agent_config_for_session(session_id, 'summary')
            if not config or not config.agent_runtime_arn:
                if _arn:
                    config = AgentConfiguration(config_id='fallback', agent_role='summary', agent_runtime_arn=_arn)
                else:
                    return lambda_response(400, {'error': 'No summary agent configured for this session'})
            config_id = config.config_id

        timestamp = get_timestamp()
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET analysisStatus = :status, analysisRequestedAt = :timestamp',
            ExpressionAttributeValues={
                ':status': 'processing',
                ':timestamp': timestamp
            }
        )

        message = {
            'sessionId': session_id,
            'configId': config_id,
            'requestedAt': timestamp,
            'includeMeetingLog': True,
            'meetingLog': meeting_log
        }

        if not ANALYSIS_QUEUE_URL:
            logger.error("ANALYSIS_QUEUE_URL environment variable not configured")
            return lambda_response(500, {'error': 'Analysis queue not configured'})

        try:
            sqs.send_message(
                QueueUrl=ANALYSIS_QUEUE_URL,
                MessageBody=json.dumps(message)
            )
        except ClientError as sqs_error:
            error_code = sqs_error.response['Error']['Code']
            logger.error(f"SQS error sending re-analysis request for session {session_id}: {error_code} - {str(sqs_error)}")
            return lambda_response(500, {'error': f'Failed to queue re-analysis request: {error_code}'})

        return lambda_response(202, {
            'message': 'Re-analysis with meeting log queued successfully',
            'sessionId': session_id,
            'configId': config_id,
            'status': 'processing'
        })

    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error in re-analysis for session {session_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error queuing re-analysis for session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to queue re-analysis request'})



def request_analysis(event, context):
    """Producer function - Enqueue AgentCore-based analysis request to SQS

    Request Body:
        configId (str): 사용할 AgentConfiguration ID (summary 역할)
    """
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id:
            return lambda_response(400, {'error': 'Session ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing session ID parameter'})

    try:
        body = parse_body(event)
        config_id = body.get('configId', '')
    except (ValueError, TypeError) as e:
        logger.error(f"Invalid request body for analysis request: {str(e)}")
        return lambda_response(400, {'error': 'Invalid request body'})

    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})

        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})

        # configId가 명시되면 해당 설정 사용, 아니면 세션 캠페인의 summary 설정 자동 조회
        if config_id:
            config_resp = sessions_table.get_item(Key={'PK': f'AGENTCONFIG#{config_id}', 'SK': 'METADATA'})
            if 'Item' not in config_resp:
                return lambda_response(404, {'error': 'Agent configuration not found'})
        else:
            _arn, config = get_agent_config_for_session(session_id, 'summary')
            if not config or not config.agent_runtime_arn:
                if _arn:
                    config = AgentConfiguration(config_id='fallback', agent_role='summary', agent_runtime_arn=_arn)
                else:
                    return lambda_response(400, {'error': 'No summary agent configured for this session'})
            config_id = config.config_id

        timestamp = get_timestamp()
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET analysisStatus = :status, analysisRequestedAt = :timestamp',
            ExpressionAttributeValues={
                ':status': 'processing',
                ':timestamp': timestamp
            }
        )

        message = {
            'sessionId': session_id,
            'configId': config_id,
            'requestedAt': timestamp
        }

        if not ANALYSIS_QUEUE_URL:
            logger.error("ANALYSIS_QUEUE_URL environment variable not configured")
            return lambda_response(500, {'error': 'Analysis queue not configured'})

        try:
            sqs.send_message(
                QueueUrl=ANALYSIS_QUEUE_URL,
                MessageBody=json.dumps(message)
            )
        except ClientError as sqs_error:
            error_code = sqs_error.response['Error']['Code']
            logger.error(f"SQS error sending analysis request for session {session_id}: {error_code} - {str(sqs_error)}")
            return lambda_response(500, {'error': f'Failed to queue analysis request: {error_code}'})

        return lambda_response(202, {
            'message': 'Analysis request queued successfully',
            'sessionId': session_id,
            'configId': config_id,
            'status': 'processing'
        })

    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error in analysis request for session {session_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error queuing analysis request for session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to queue analysis request'})

def process_analysis(event, context):
    """Consumer function - Process analysis from SQS queue via AgentCore

    SQS 메시지 구조:
        sessionId (str): 세션 ID
        configId (str): AgentConfiguration ID
        includeMeetingLog (bool): 미팅 로그 포함 여부
        meetingLog (str): 미팅 로그 텍스트
    """
    try:
        for record in event['Records']:
            message_body = json.loads(record['body'])
            session_id = message_body['sessionId']
            config_id = message_body.get('configId', '')
            include_meeting_log = message_body.get('includeMeetingLog', False)
            meeting_log = message_body.get('meetingLog', '')

            logger.info(f"Processing AgentCore analysis for session {session_id}, configId={config_id}, includeMeetingLog={include_meeting_log}")

            result = _perform_agentcore_analysis(session_id, config_id, include_meeting_log, meeting_log)

            if result['success']:
                logger.info(f"AgentCore analysis completed successfully for session {session_id}")
            else:
                logger.error(f"AgentCore analysis failed for session {session_id}: {result.get('error')}")

        return {'statusCode': 200}

    except Exception as e:
        logger.warning(f"Error processing analysis from SQS: {str(e)}")
        raise e

def _perform_agentcore_analysis(session_id, config_id, include_meeting_log=False, meeting_log=''):
    """AgentCore Summary Agent를 호출하여 대화 분석을 수행합니다."""
    logger.info(f"Starting AgentCore analysis for session {session_id}, configId={config_id}")

    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    try:
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET analysisStatus = :status',
            ExpressionAttributeValues={':status': 'processing'}
        )

        # 세션 및 메시지 조회
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        if 'Item' not in session_resp:
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET analysisStatus = :status',
                ExpressionAttributeValues={':status': 'failed'}
            )
            return {'success': False, 'error': 'Session not found'}

        session = session_resp['Item']

        messages_table = dynamodb.Table(MESSAGES_TABLE)
        messages_resp = messages_table.query(
            KeyConditionExpression='PK = :pk',
            ExpressionAttributeValues={':pk': f'SESSION#{session_id}'},
            ScanIndexForward=True
        )
        messages = messages_resp.get('Items', [])
        if not messages:
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET analysisStatus = :status',
                ExpressionAttributeValues={':status': 'failed'}
            )
            return {'success': False, 'error': 'No conversation messages found'}

        # 대화 이력 텍스트 구성
        conversation_text = '\n'.join([f"{msg['sender']}: {msg['content']}" for msg in messages])
        if len(conversation_text) > 50000:
            conversation_text = conversation_text[:50000] + "\n[대화 내용이 길어 일부 생략됨]"

        if include_meeting_log and meeting_log:
            effective_meeting_log = meeting_log
        else:
            effective_meeting_log = session.get('meetingLog', '')

        # AgentConfiguration 조회
        config = None
        if config_id and config_id != 'default':
            config_resp = sessions_table.get_item(Key={'PK': f'AGENTCONFIG#{config_id}', 'SK': 'METADATA'})
            if 'Item' in config_resp:
                config = AgentConfiguration.from_dynamodb_item(config_resp['Item'])

        # config가 없으면 세션 캠페인의 summary 설정 자동 조회
        if not config:
            arn, config = get_agent_config_for_session(session_id, 'summary')
            if config and not config.agent_runtime_arn and arn:
                config.agent_runtime_arn = arn
            elif not config and arn:
                config = AgentConfiguration(
                    config_id='fallback',
                    agent_role='summary',
                    agent_runtime_arn=arn,
                )

        # config는 있지만 ARN이 없으면 환경 변수에서 주입
        if config and not config.agent_runtime_arn:
            env_arn = get_agent_runtime_arn('summary')
            if env_arn:
                config.agent_runtime_arn = env_arn
                logger.info(f"Injected ARN from env var for configId={config.config_id}: {env_arn}")

        if not config or not config.agent_runtime_arn:
            logger.error(f"No summary agent ARN available for session {session_id}")
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET analysisStatus = :status',
                ExpressionAttributeValues={':status': 'failed'}
            )
            return {'success': False, 'error': 'Summary Agent가 구성되지 않았습니다. SSM 파라미터(/prechat/{stage}/agents/summary/runtime-arn)를 확인하세요.'}

        # AgentCore Summary Agent 호출
        logger.info(f"Invoking AgentCore Summary Agent: {config.agent_runtime_arn}")
        locale = session.get('locale', 'ko')
        result = agentcore_client.invoke_analysis(
            agent_runtime_arn=config.agent_runtime_arn,
            session_id=session_id,
            conversation_history=conversation_text,
            config=config,
            locale=locale,
            meeting_log=effective_meeting_log,
        )

        if 'error' in result and not result.get('result'):
            logger.error(f"AgentCore analysis returned error: {result['error']}")
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET analysisStatus = :status',
                ExpressionAttributeValues={':status': 'failed'}
            )
            return {'success': False, 'error': result['error']}

        # 결과 파싱 - AgentCore 응답에서 분석 데이터 추출
        analysis_data = _parse_agentcore_analysis_result(result, config)

        if not _store_analysis_results(session_id, analysis_data):
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET analysisStatus = :status',
                ExpressionAttributeValues={':status': 'failed'}
            )
            return {'success': False, 'error': 'Failed to store analysis results'}

        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET analysisStatus = :status',
            ExpressionAttributeValues={':status': 'completed'}
        )

        logger.info(f"AgentCore analysis completed for session {session_id}")
        return {'success': True, 'analysis': analysis_data}

    except Exception as e:
        logger.error(f"AgentCore analysis error for session {session_id}: {str(e)}")
        try:
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET analysisStatus = :status',
                ExpressionAttributeValues={':status': 'failed'}
            )
        except Exception:
            pass
        return {'success': False, 'error': str(e)}


def _parse_agentcore_analysis_result(result: dict, config) -> dict:
    """AgentCore Summary Agent 응답을 분석 결과 형식으로 파싱합니다.

    Structured Output 기반: 에이전트가 AnalysisOutput Pydantic 모델로
    검증된 응답을 반환하므로, 최소한의 변환만 수행합니다.
    """
    timestamp = get_timestamp()
    model_used = config.model_id if hasattr(config, 'model_id') and config.model_id else 'unknown'
    agent_name = config.agent_name if hasattr(config, 'agent_name') and config.agent_name else 'unknown'

    raw = result.get('result', result)

    # 문자열이면 JSON 파싱 시도
    if isinstance(raw, str):
        cleaned = raw.strip()
        if cleaned.startswith('```'):
            cleaned = cleaned.split('\n', 1)[-1]
            if cleaned.endswith('```'):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
        try:
            raw = json.loads(cleaned)
        except json.JSONDecodeError:
            return {
                'markdownSummary': raw,
                'bantAnalysis': {'budget': 'N/A', 'authority': 'N/A', 'need': 'N/A', 'timeline': 'N/A'},
                'awsServices': [],
                'analyzedAt': timestamp,
                'modelUsed': model_used,
                'agentName': agent_name,
            }

    if isinstance(raw, dict):
        return {
            'markdownSummary': raw.get('markdownSummary', ''),
            'bantAnalysis': raw.get('bantAnalysis', {'budget': 'N/A', 'authority': 'N/A', 'need': 'N/A', 'timeline': 'N/A'}),
            'awsServices': raw.get('awsServices', []),
            'analyzedAt': timestamp,
            'modelUsed': model_used,
            'agentName': agent_name,
        }

    return {
        'markdownSummary': str(raw),
        'bantAnalysis': {'budget': 'N/A', 'authority': 'N/A', 'need': 'N/A', 'timeline': 'N/A'},
        'awsServices': [],
        'analyzedAt': timestamp,
        'modelUsed': model_used,
        'agentName': agent_name,
    }


def _perform_conversation_analysis(session_id, model_id, include_meeting_log=False, meeting_log=''):
    """Perform the actual conversation analysis"""
    logger.info(f"Starting conversation analysis for session {session_id} with model {model_id}, includeMeetingLog: {include_meeting_log}")
    
    try:
        # Update status to processing
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET analysisStatus = :status',
            ExpressionAttributeValues={':status': 'processing'}
        )
        
        # Get session and messages with error handling
        try:
            session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        except ClientError as e:
            logger.error(f"DynamoDB error retrieving session {session_id}: {str(e)}")
            return lambda_response(500, {'error': 'Database error retrieving session'})
        
        if 'Item' not in session_resp:
            logger.error(f"Session {session_id} not found")
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        logger.info(f"Retrieved session for customer: {session['customerInfo']['name']}")
        
        # Get messages with error handling
        messages_table = dynamodb.Table(MESSAGES_TABLE)
        try:
            messages_resp = messages_table.query(
                KeyConditionExpression='PK = :pk',
                ExpressionAttributeValues={':pk': f'SESSION#{session_id}'},
                ScanIndexForward=True
            )
        except ClientError as e:
            logger.error(f"DynamoDB error retrieving messages for session {session_id}: {str(e)}")
            return lambda_response(500, {'error': 'Database error retrieving messages'})
        
        messages = messages_resp.get('Items', [])
        
        if not messages:
            logger.error(f"No conversation messages found for session {session_id}")
            return lambda_response(400, {'error': 'No conversation messages found'})
        
        logger.info(f"Found {len(messages)} messages for analysis")
        
        # Build conversation history with length check
        conversation_text = '\n'.join([f"{msg['sender']}: {msg['content']}" for msg in messages])
        
        if len(conversation_text) > 50000:  # Limit conversation length
            logger.warning(f"Conversation too long ({len(conversation_text)} chars), truncating")
            conversation_text = conversation_text[:50000] + "\n[대화 내용이 길어 일부 생략됨]"
        
        # Add meeting log context if provided
        meeting_log_context = ""
        if include_meeting_log and meeting_log:
            meeting_log_context = f"""

미팅 로그 (Sales Rep이 작성한 초도미팅록):
{meeting_log}

위의 미팅 로그와 사전상담 대화 내용을 모두 고려하여 분석해주세요."""
        
        # Generate structured analysis prompt using meet-logs-md.md template
        analysis_prompt = f"""고객 상담 내용을 분석하여 다음 4가지 항목을 JSON 형태로 제공해주세요:

고객 정보:
- 이름: {session['customerInfo']['name']}
- 회사: {session['customerInfo']['company']}
- 직책: {session['customerInfo'].get('title', '미입력')}
- 이메일: {session['customerInfo']['email']}

대화 내용:
{conversation_text}{meeting_log_context}

다음 형식으로 분석 결과를 제공해주세요. 반드시 유효한 JSON 형식으로 응답해주세요:

{{
  "markdownSummary": "마크다운 템플릿 구조를 참고하여 작성된 마크다운 요약. Account Info 섹션(SFDC URL, Site URL, Partner, Industry/Domain, Business model, Customer's Key Requirement, Key Challenges, TAS, Chat Summary, Developer status, Key Contact, Budget), Meeting Logs 섹션(Meeting Minute, F/up items), Account Planning 섹션을 포함해야 합니다.",
  "bantAnalysis": {{
    "budget": "예산 관련 분석 - 고객이 언급한 예산 정보나 투자 계획",
    "authority": "의사결정권한 분석 - 대화 상대방의 의사결정 권한 수준", 
    "need": "필요성 분석 - 고객의 핵심 요구사항과 해결해야 할 문제",
    "timeline": "일정 분석 - 프로젝트 진행 일정이나 도입 계획"
  }},
  "awsServices": [
    {{
      "service": "추천 AWS 서비스명",
      "reason": "해당 서비스를 추천하는 이유",
      "implementation": "구체적인 구현 방안이나 적용 방법"
    }}
  ]
}}

중요: 응답은 반드시 유효한 JSON 형식이어야 하며, 마크다운 코드 블록(```)이나 다른 텍스트 없이 순수 JSON만 반환해주세요."""

        # Note: Running in SQS consumer with 15-minute timeout, no need to check remaining time
        
        # Call LLM for analysis with retry logic
        analysis_result = _call_llm_for_analysis(model_id, analysis_prompt)
        
        if not analysis_result:
            logger.error("LLM analysis failed after all retries")
            # Return fallback response
            fallback_analysis = _generate_fallback_analysis(session, messages)
            return lambda_response(500, {
                'error': 'LLM analysis failed',
                'fallback': fallback_analysis,
                'message': 'Analysis failed but basic summary provided'
            })
        
        # Store analysis results in DynamoDB
        timestamp = get_timestamp()
        analysis_data = {
            **analysis_result,
            'analyzedAt': timestamp,
            'modelUsed': model_id
        }
        
        # Store analysis results with atomic update
        if not _store_analysis_results(session_id, analysis_data):
            logger.error(f"Failed to store analysis results for session {session_id}")
            # Update status to failed
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET analysisStatus = :status',
                ExpressionAttributeValues={':status': 'failed'}
            )
            return {'success': False, 'error': 'Failed to store analysis results'}
        
        # Update status to completed
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET analysisStatus = :status',
            ExpressionAttributeValues={':status': 'completed'}
        )
        
        logger.info(f"Analysis completed successfully for session {session_id}")
        return {'success': True, 'analysis': analysis_data}
        
    except Exception as e:
        logger.error(f"Unexpected error in analyze_conversation for session {session_id}: {str(e)}")
        
        # Generate fallback response for critical failures
        try:
            sessions_table = dynamodb.Table(SESSIONS_TABLE)
            session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
            if 'Item' in session_resp:
                session = session_resp['Item']
                messages_table = dynamodb.Table(MESSAGES_TABLE)
                messages_resp = messages_table.query(
                    KeyConditionExpression='PK = :pk',
                    ExpressionAttributeValues={':pk': f'SESSION#{session_id}'},
                    ScanIndexForward=True
                )
                messages = messages_resp.get('Items', [])
                fallback_analysis = _generate_fallback_analysis(session, messages)
                
                # Update status to failed
                try:
                    sessions_table.update_item(
                        Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                        UpdateExpression='SET analysisStatus = :status',
                        ExpressionAttributeValues={':status': 'failed'}
                    )
                except Exception as status_update_error:
                    logger.error(f"Failed to update analysis status to failed for session {session_id}: {str(status_update_error)}")
                
                return {
                    'success': False,
                    'error': 'Analysis failed with critical error',
                    'fallback': fallback_analysis
                }
        except Exception as fallback_error:
            logger.error(f"Failed to generate fallback analysis for session {session_id}: {str(fallback_error)}")
        
        # Update status to failed
        try:
            sessions_table = dynamodb.Table(SESSIONS_TABLE)
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET analysisStatus = :status',
                ExpressionAttributeValues={':status': 'failed'}
            )
        except Exception as status_update_error:
            logger.error(f"Failed to update analysis status to failed for session {session_id}: {str(status_update_error)}")
        
        return {'success': False, 'error': 'Critical failure in conversation analysis'}

def _generate_fallback_analysis(session, messages):
    """Generate basic fallback analysis when LLM fails"""
    try:
        customer_info = session['customerInfo']
        message_count = len(messages)
        
        # Basic conversation summary
        conversation_summary = f"고객 {customer_info['name']}({customer_info['company']})과의 상담이 {message_count}개 메시지로 진행되었습니다."
        
        fallback = {
            'markdownSummary': f"""# {customer_info['company']}

## Account Info

| 항목 | 내용 |
|------|------|
| 고객명 | {customer_info['name']} |
| 회사명 | {customer_info['company']} |
| 직책 | {customer_info.get('title', '미입력')} |
| 이메일 | {customer_info['email']} |
| 대화 요약 | {conversation_summary} |

## Meeting Logs

#### Meeting Minute
- AI 분석 실패로 인해 자동 요약을 생성할 수 없습니다.
- 수동으로 대화 내용을 검토해주세요.

#### F/up items
- [ ] 대화 내용 수동 검토 필요
- [ ] 고객 요구사항 재확인 필요

## Account Planning
- AI 분석 실패로 인해 자동 계획을 생성할 수 없습니다.
""",
            'bantAnalysis': {
                'budget': 'AI 분석 실패로 인해 예산 정보를 추출할 수 없습니다.',
                'authority': 'AI 분석 실패로 인해 권한 정보를 추출할 수 없습니다.',
                'need': 'AI 분석 실패로 인해 필요성 정보를 추출할 수 없습니다.',
                'timeline': 'AI 분석 실패로 인해 일정 정보를 추출할 수 없습니다.'
            },
            'awsServices': [
                {
                    'service': '분석 실패',
                    'reason': 'AI 분석 실패로 인해 서비스 추천을 제공할 수 없습니다.',
                    'implementation': '수동으로 대화 내용을 검토하여 적절한 서비스를 선택해주세요.'
                }
            ],
        }
        
        return fallback
        
    except Exception as e:
        logger.error(f"Error generating fallback analysis: {str(e)}")
        return {
            'markdownSummary': '# 분석 실패\n\n시스템 오류로 인해 분석을 수행할 수 없습니다.',
            'bantAnalysis': {'budget': '분석 실패', 'authority': '분석 실패', 'need': '분석 실패', 'timeline': '분석 실패'},
            'awsServices': [{'service': '분석 실패', 'reason': '시스템 오류', 'implementation': '수동 검토 필요'}],
        }

def _call_llm_for_analysis(model_id, prompt, max_retries=3):
    """Helper function to call LLM and parse JSON response with retry logic"""
    last_error = None
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Attempting LLM analysis (attempt {attempt + 1}/{max_retries}) with model: {model_id}")
            
            # Prepare request based on model type
            if 'anthropic' in model_id.lower():
                # Anthropic Claude format
                request_body = json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 8192,
                    "messages": [{"role": "user", "content": prompt}]
                })
            else:
                # Amazon Nova format
                request_body = json.dumps({
                    "messages": [{"role": "user", "content": [{"text": prompt}]}],
                    "inferenceConfig": {"max_new_tokens": 8192}
                })
            
            # Call Bedrock with timeout handling
            start_time = time.time()
            response = bedrock.invoke_model(modelId=model_id, body=request_body)
            end_time = time.time()
            
            logger.info(f"LLM call completed in {end_time - start_time:.2f} seconds")
            
            result = json.loads(response['body'].read())
            
            # Extract content based on model type
            if 'anthropic' in model_id.lower():
                content = result['content'][0]['text']
            else:
                content = result['output']['message']['content'][0]['text']
            
            # Clean up response and parse JSON
            content = clean_llm_response(content)
            logger.info(f"Raw LLM response length: {len(content)} characters")
            
            # Parse JSON response
            analysis_result = json.loads(content)
            
            # Validate required fields
            _validate_llm_response(analysis_result)
            
            logger.info("LLM analysis completed successfully")
            return analysis_result
            
        except ReadTimeoutError as e:
            last_error = e
            logger.warning(f"LLM request timeout on attempt {attempt + 1}: {str(e)}")
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt  # Exponential backoff
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            last_error = e
            
            if error_code in ['ThrottlingException', 'ServiceUnavailableException']:
                logger.warning(f"Transient error on attempt {attempt + 1}: {error_code}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt  # Exponential backoff
                    logger.info(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
            else:
                logger.error(f"Non-retryable error: {error_code} - {str(e)}")
                break
                
        except json.JSONDecodeError as e:
            last_error = e
            logger.error(f"Failed to parse LLM response as JSON on attempt {attempt + 1}: {str(e)}")
            logger.error(f"Raw content: {content[:500]}...")  # Log first 500 chars
            if attempt < max_retries - 1:
                logger.info("Retrying with same prompt...")
            
        except ValueError as e:
            last_error = e
            logger.error(f"LLM response validation failed on attempt {attempt + 1}: {str(e)}")
            if attempt < max_retries - 1:
                logger.info("Retrying with same prompt...")
                
        except Exception as e:
            last_error = e
            logger.error(f"Unexpected error on attempt {attempt + 1}: {str(e)}")
    
    logger.error(f"All {max_retries} attempts failed. Last error: {str(last_error)}")
    return None

def _validate_llm_response(analysis_result):
    """Validate LLM response structure"""
    required_fields = ['markdownSummary', 'bantAnalysis', 'awsServices']
    for field in required_fields:
        if field not in analysis_result:
            raise ValueError(f"Missing required field: {field}")
    
    # Validate bantAnalysis structure
    bant_fields = ['budget', 'authority', 'need', 'timeline']
    for field in bant_fields:
        if field not in analysis_result['bantAnalysis']:
            raise ValueError(f"Missing BANT field: {field}")
    
    # Validate lists
    if not isinstance(analysis_result['awsServices'], list):
        raise ValueError("awsServices must be a list")

def _store_analysis_results(session_id, analysis_data, max_retries=3):
    """Store analysis results in DynamoDB with atomic updates and retry logic"""
    last_error = None
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Storing analysis results for session {session_id} (attempt {attempt + 1}/{max_retries})")
            
            sessions_table = dynamodb.Table(SESSIONS_TABLE)
            
            # Validate analysis data structure before storing
            _validate_analysis_data(analysis_data)
            
            # Perform atomic update to prevent partial data corruption
            sessions_table.update_item(
                Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
                UpdateExpression='SET aiAnalysis = :analysis',
                ExpressionAttributeValues={':analysis': analysis_data},
                # Ensure the session exists before updating
                ConditionExpression='attribute_exists(PK)'
            )
            
            logger.info(f"Successfully stored analysis results for session {session_id}")
            return True
            
        except sessions_table.meta.client.exceptions.ConditionalCheckFailedException as e:
            logger.error(f"Session {session_id} not found - cannot store analysis")
            return False  # Don't retry for this error
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            last_error = e
            
            if error_code in ['ThrottlingException', 'ServiceUnavailableException']:
                logger.warning(f"Transient DynamoDB error on attempt {attempt + 1}: {error_code}")
                if attempt < max_retries - 1:
                    wait_time = 2 ** attempt
                    logger.info(f"Retrying storage in {wait_time} seconds...")
                    time.sleep(wait_time)
            else:
                logger.error(f"Non-retryable DynamoDB error: {error_code} - {str(e)}")
                return False
                
        except ValueError as e:
            logger.error(f"Analysis data validation failed: {str(e)}")
            return False  # Don't retry for validation errors
            
        except Exception as e:
            last_error = e
            logger.error(f"Unexpected error storing analysis on attempt {attempt + 1}: {str(e)}")
    
    logger.error(f"Failed to store analysis after {max_retries} attempts. Last error: {str(last_error)}")
    return False

def _validate_analysis_data(analysis_data):
    """Validate analysis data structure before storage.

    Structured Output 기반 에이전트가 이미 Pydantic 검증을 수행하므로,
    여기서는 최소한의 필수 필드 존재 여부만 확인합니다.
    """
    required_fields = ['markdownSummary', 'bantAnalysis', 'awsServices', 'analyzedAt', 'modelUsed']

    for field in required_fields:
        if field not in analysis_data:
            raise ValueError(f"Missing required analysis field: {field}")

    # Validate bantAnalysis structure
    bant_fields = ['budget', 'authority', 'need', 'timeline']
    for field in bant_fields:
        if field not in analysis_data['bantAnalysis']:
            raise ValueError(f"Missing BANT field: {field}")

    # Validate awsServices is a list
    if not isinstance(analysis_data['awsServices'], list):
        raise ValueError("awsServices must be a list")

    # awsServices 내부 필드 검증: 객체 배열이면 필수 필드 확인
    for service in analysis_data['awsServices']:
        if isinstance(service, dict):
            if 'service' not in service:
                raise ValueError("Missing AWS service field: service")
            # reason, implementation은 빈 문자열 허용
            service.setdefault('reason', '')
            service.setdefault('implementation', '')

def _get_stored_analysis(session_id):
    """Retrieve stored analysis results from DynamoDB"""
    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        response = sessions_table.get_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            ProjectionExpression='aiAnalysis'
        )
        
        if 'Item' in response and 'aiAnalysis' in response['Item']:
            return response['Item']['aiAnalysis']
        
        return None
        
    except Exception as e:
        print(f"Error retrieving analysis for session {session_id}: {str(e)}")
        return None


def get_session_feedback(event, context):
    """Get customer feedback for a session"""
    session_id = event['pathParameters']['sessionId']
    
    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # Get feedback data
        response = sessions_table.get_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'FEEDBACK'}
        )
        
        if 'Item' not in response:
            return lambda_response(404, {'error': 'No feedback found for this session'})
        
        feedback_item = response['Item']
        
        # Convert Decimal rating back to float for JSON serialization
        rating = feedback_item.get('rating')
        if isinstance(rating, Decimal):
            rating = float(rating)
        
        return lambda_response(200, {
            'rating': rating,
            'feedback': feedback_item.get('feedback', ''),
            'timestamp': feedback_item.get('timestamp')
        })
        
    except Exception as e:
        print(f"Error retrieving feedback for session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to retrieve feedback'})

def patch_session(event, context):
    """
    PATCH /api/admin/sessions/{sessionId}

    세션의 부분 업데이트를 수행합니다.
    지원하는 필드:
      - status: 'inactive' 로 변경 (기존 inactivate 엔드포인트 통합)
      - campaignId: 캠페인 연결 (기존 PUT .../campaign 엔드포인트 통합)
    """
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id:
            return lambda_response(400, {'error': 'Session ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing session ID parameter'})

    try:
        body = parse_body(event)
        if not body:
            return lambda_response(400, {'error': 'Request body is required'})

        sessions_table = dynamodb.Table(SESSIONS_TABLE)

        # Verify session exists
        session_resp = sessions_table.get_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'}
        )
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})

        update_expressions = []
        expression_names = {}
        expression_values = {}

        # Handle status change (inactivate)
        if 'status' in body:
            new_status = body['status']
            if new_status not in ('inactive', 'active'):
                return lambda_response(400, {'error': 'Invalid status. Must be "active" or "inactive"'})
            update_expressions.append('#status = :status')
            expression_names['#status'] = 'status'
            expression_values[':status'] = new_status

        # Handle campaign association
        if 'campaignId' in body:
            campaign_id = body['campaignId']
            if campaign_id:
                # Validate campaign exists
                campaigns_table = dynamodb.Table(CAMPAIGNS_TABLE)
                campaign_resp = campaigns_table.get_item(
                    Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'}
                )
                if 'Item' not in campaign_resp:
                    return lambda_response(404, {'error': 'Campaign not found'})

                campaign = campaign_resp['Item']
                timestamp = get_timestamp()
                update_expressions.append('campaignId = :campaign_id')
                update_expressions.append('GSI2PK = :gsi2pk')
                update_expressions.append('GSI2SK = :gsi2sk')
                expression_values[':campaign_id'] = campaign_id
                expression_values[':gsi2pk'] = f'CAMPAIGN#{campaign_id}'
                expression_values[':gsi2sk'] = f'SESSION#{timestamp}'
            else:
                # Remove campaign association
                update_expressions.append('campaignId = :empty')
                update_expressions.append('GSI2PK = :empty')
                update_expressions.append('GSI2SK = :empty')
                expression_values[':empty'] = ''

        if not update_expressions:
            return lambda_response(400, {'error': 'No valid fields to update'})

        update_expr = 'SET ' + ', '.join(update_expressions)
        update_kwargs = {
            'Key': {'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            'UpdateExpression': update_expr,
            'ExpressionAttributeValues': expression_values,
        }
        if expression_names:
            update_kwargs['ExpressionAttributeNames'] = expression_names

        sessions_table.update_item(**update_kwargs)

        return lambda_response(200, {
            'message': 'Session updated successfully',
            'sessionId': session_id,
        })

    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error patching session {session_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error patching session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to update session'})


def submit_analysis(event, context):
    """
    POST /api/admin/sessions/{sessionId}/analysis

    분석 요청을 통합 처리합니다.
    기존 analyze + reanalyze 엔드포인트를 통합합니다.

    Request Body:
      - configId (str, optional): AgentConfiguration ID (빈 값이면 세션 캠페인의 summary 설정 자동 조회)
      - includeMeetingLog (bool, optional): 미팅 로그 포함 여부 (기존 reanalyze)
    """
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id:
            return lambda_response(400, {'error': 'Session ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing session ID parameter'})

    try:
        body = parse_body(event)
        config_id = body.get('configId', '')
        include_meeting_log = body.get('includeMeetingLog', False)

        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        session_resp = sessions_table.get_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'}
        )

        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})

        session = session_resp['Item']
        timestamp = get_timestamp()

        # Mark analysis as in progress
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET analysisStatus = :status, analysisRequestedAt = :timestamp',
            ExpressionAttributeValues={
                ':status': 'processing',
                ':timestamp': timestamp
            }
        )

        # Build SQS message - configId 기반으로 process_analysis에서 AgentConfiguration 조회
        message = {
            'sessionId': session_id,
            'configId': config_id,
            'requestedAt': timestamp,
        }

        if include_meeting_log:
            message['includeMeetingLog'] = True
            message['meetingLog'] = session.get('meetingLog', '')

        if not ANALYSIS_QUEUE_URL:
            logger.error("ANALYSIS_QUEUE_URL environment variable not configured")
            return lambda_response(500, {'error': 'Analysis queue not configured'})

        sqs.send_message(
            QueueUrl=ANALYSIS_QUEUE_URL,
            MessageBody=json.dumps(message)
        )

        return lambda_response(202, {
            'message': 'Analysis request queued successfully',
            'sessionId': session_id,
            'status': 'processing',
            'includeMeetingLog': include_meeting_log,
        })

    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB/SQS error in analysis for session {session_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Service error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error submitting analysis for session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to submit analysis request'})




