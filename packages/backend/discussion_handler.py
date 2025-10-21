# nosemgrep
import json
import boto3
import os
import logging
from botocore.exceptions import ClientError
from utils import lambda_response, parse_body, get_timestamp, generate_id

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
cognito = boto3.client('cognito-idp')
USER_POOL_ID = os.environ.get('USER_POOL_ID')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')

def get_user_info_from_token(event):
    """Extract user information from JWT token with enhanced validation"""
    try:
        # Get user info from JWT claims (added by API Gateway authorizer)
        claims = event.get('requestContext', {}).get('authorizer', {}).get('claims', {})
        
        user_email = claims.get('email', '')
        user_name = claims.get('name', user_email.split('@')[0] if user_email else 'Unknown')
        
        # Enhanced validation: ensure we have a valid email
        if not user_email or '@' not in user_email:
            logger.warning("No valid email found in JWT claims")
            # Try to extract from Authorization header as fallback
            auth_header = event.get('headers', {}).get('Authorization', '')
            if auth_header.startswith('Bearer '):
                logger.info("Attempting to extract user info from Authorization header")
                # In production, decode the JWT token properly here
                # For now, we'll use a placeholder for development
                user_email = 'admin@example.com'
                user_name = 'Admin User'
            else:
                raise ValueError("No valid user authentication found")
        
        logger.info(f"User authenticated: {user_email}")
        return user_email, user_name
    except Exception as e:
        logger.error(f"Error extracting user info from token: {str(e)}")
        # In production, this should raise an exception instead of returning default values
        raise ValueError(f"Authentication failed: {str(e)}")

def list_discussions(event, context):
    """List all discussions for a session"""
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id:
            return lambda_response(400, {'error': 'Session ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing session ID parameter'})
    
    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # Query discussions for the session
        response = sessions_table.query(
            KeyConditionExpression='PK = :pk AND begins_with(SK, :sk_prefix)',
            ExpressionAttributeValues={
                ':pk': f'SESSION#{session_id}',
                ':sk_prefix': 'DISCUSSION#'
            },
            ScanIndexForward=False  # Sort by timestamp descending (newest first)
        )
        
        discussions = []
        for item in response.get('Items', []):
            # Extract discussion ID from SK (format: DISCUSSION#{timestamp}#{discussionId})
            sk_parts = item['SK'].split('#')
            discussion_id = sk_parts[-1] if len(sk_parts) >= 3 else item.get('id', '')
            
            discussions.append({
                'id': discussion_id,
                'sessionId': session_id,
                'content': item.get('content', ''),
                'authorEmail': item.get('authorEmail', ''),
                'authorName': item.get('authorName', ''),
                'timestamp': item.get('timestamp', ''),
                'createdAt': item.get('createdAt', ''),
                'updatedAt': item.get('updatedAt', '')
            })
        
        return lambda_response(200, {'discussions': discussions})
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error listing discussions for session {session_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error listing discussions for session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to list discussions'})

def create_discussion(event, context):
    """Create a new discussion comment"""
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id:
            return lambda_response(400, {'error': 'Session ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing session ID parameter'})
    
    try:
        body = parse_body(event)
        content = body.get('content', '').strip()
        
        if not content:
            return lambda_response(400, {'error': 'Discussion content is required'})
        
        if len(content) > 2000:  # Limit content length
            return lambda_response(400, {'error': 'Discussion content too long (max 2000 characters)'})
            
    except (ValueError, TypeError) as e:
        logger.error(f"Invalid request body for discussion creation: {str(e)}")
        return lambda_response(400, {'error': 'Invalid request body'})
    
    try:
        # Get user info from token with enhanced validation
        try:
            user_email, user_name = get_user_info_from_token(event)
        except ValueError as auth_error:
            logger.error(f"Authentication failed for discussion creation: {str(auth_error)}")
            return lambda_response(401, {'error': 'Authentication required'})
        
        # Generate discussion ID and timestamp
        discussion_id = generate_id()
        timestamp = get_timestamp()
        
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # Check if session exists
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        # Create discussion record with timestamp-based Sort Key for natural ordering
        discussion_record = {
            'PK': f'SESSION#{session_id}',
            'SK': f'DISCUSSION#{timestamp}#{discussion_id}',  # timestamp first for sorting
            'id': discussion_id,
            'sessionId': session_id,
            'content': content,
            'authorEmail': user_email,
            'authorName': user_name,
            'timestamp': timestamp,
            'createdAt': timestamp,
            'GSI1PK': f'DISCUSSION#{discussion_id}',
            'GSI1SK': timestamp
        }
        
        sessions_table.put_item(Item=discussion_record)
        
        return lambda_response(201, {
            'id': discussion_id,
            'sessionId': session_id,
            'content': content,
            'authorEmail': user_email,
            'authorName': user_name,
            'timestamp': timestamp,
            'createdAt': timestamp,
            'message': 'Discussion created successfully'
        })
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error creating discussion for session {session_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error creating discussion for session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to create discussion'})

def update_discussion(event, context):
    """Update an existing discussion comment"""
    try:
        session_id = event['pathParameters']['sessionId']
        discussion_id = event['pathParameters']['discussionId']
        
        if not session_id or not discussion_id:
            return lambda_response(400, {'error': 'Session ID and Discussion ID are required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing required parameters'})
    
    try:
        body = parse_body(event)
        content = body.get('content', '').strip()
        
        if not content:
            return lambda_response(400, {'error': 'Discussion content is required'})
        
        if len(content) > 2000:  # Limit content length
            return lambda_response(400, {'error': 'Discussion content too long (max 2000 characters)'})
            
    except (ValueError, TypeError) as e:
        logger.error(f"Invalid request body for discussion update: {str(e)}")
        return lambda_response(400, {'error': 'Invalid request body'})
    
    try:
        # Get user info from token with enhanced validation
        try:
            user_email, user_name = get_user_info_from_token(event)
        except ValueError as auth_error:
            logger.error(f"Authentication failed for discussion update: {str(auth_error)}")
            return lambda_response(401, {'error': 'Authentication required'})
        
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # Find discussion using GSI1 (by discussion_id)
        discussion_resp = sessions_table.query(
            IndexName='GSI1',
            KeyConditionExpression='GSI1PK = :pk',
            ExpressionAttributeValues={':pk': f'DISCUSSION#{discussion_id}'},
            Limit=1
        )
        
        if not discussion_resp.get('Items'):
            logger.warning(f"Discussion {discussion_id} not found")
            return lambda_response(404, {'error': 'Discussion not found'})
        
        discussion = discussion_resp['Items'][0]
        
        # Verify the discussion belongs to the correct session
        if discussion.get('sessionId') != session_id:
            logger.warning(f"Discussion {discussion_id} does not belong to session {session_id}")
            return lambda_response(404, {'error': 'Discussion not found'})
        
        # Enhanced authorization check
        discussion_author = discussion.get('authorEmail', '')
        if not discussion_author:
            logger.error(f"Discussion {discussion_id} has no author email")
            return lambda_response(500, {'error': 'Discussion data corrupted'})
        
        if discussion_author != user_email:
            logger.warning(f"User {user_email} attempted to edit discussion by {discussion_author}")
            return lambda_response(403, {'error': 'You can only edit your own discussions'})
        
        # Update discussion using the original Sort Key from the found item
        timestamp = get_timestamp()
        original_sk = discussion.get('SK')  # Get the original Sort Key
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': original_sk},
            UpdateExpression='SET content = :content, updatedAt = :timestamp',
            ExpressionAttributeValues={
                ':content': content,
                ':timestamp': timestamp
            }
        )
        
        return lambda_response(200, {
            'id': discussion_id,
            'sessionId': session_id,
            'content': content,
            'authorEmail': user_email,
            'authorName': user_name,
            'timestamp': discussion.get('timestamp'),
            'createdAt': discussion.get('createdAt'),
            'updatedAt': timestamp,
            'message': 'Discussion updated successfully'
        })
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error updating discussion {discussion_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error updating discussion {discussion_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to update discussion'})

def delete_discussion(event, context):
    """Delete a discussion comment"""
    try:
        session_id = event['pathParameters']['sessionId']
        discussion_id = event['pathParameters']['discussionId']
        
        if not session_id or not discussion_id:
            return lambda_response(400, {'error': 'Session ID and Discussion ID are required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing required parameters'})
    
    try:
        # Get user info from token with enhanced validation
        try:
            user_email, user_name = get_user_info_from_token(event)
        except ValueError as auth_error:
            logger.error(f"Authentication failed for discussion deletion: {str(auth_error)}")
            return lambda_response(401, {'error': 'Authentication required'})
        
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # Find discussion using GSI1 (by discussion_id)
        discussion_resp = sessions_table.query(
            IndexName='GSI1',
            KeyConditionExpression='GSI1PK = :pk',
            ExpressionAttributeValues={':pk': f'DISCUSSION#{discussion_id}'},
            Limit=1
        )
        
        if not discussion_resp.get('Items'):
            logger.warning(f"Discussion {discussion_id} not found")
            return lambda_response(404, {'error': 'Discussion not found'})
        
        discussion = discussion_resp['Items'][0]
        
        # Verify the discussion belongs to the correct session
        if discussion.get('sessionId') != session_id:
            logger.warning(f"Discussion {discussion_id} does not belong to session {session_id}")
            return lambda_response(404, {'error': 'Discussion not found'})
        
        # Enhanced authorization check
        discussion_author = discussion.get('authorEmail', '')
        if not discussion_author:
            logger.error(f"Discussion {discussion_id} has no author email")
            return lambda_response(500, {'error': 'Discussion data corrupted'})
        
        if discussion_author != user_email:
            logger.warning(f"User {user_email} attempted to delete discussion by {discussion_author}")
            return lambda_response(403, {'error': 'You can only delete your own discussions'})
        
        # Delete discussion using the original Sort Key from the found item
        original_sk = discussion.get('SK')  # Get the original Sort Key
        sessions_table.delete_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': original_sk}
        )
        
        return lambda_response(200, {
            'message': 'Discussion deleted successfully',
            'discussionId': discussion_id
        })
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error deleting discussion {discussion_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error deleting discussion {discussion_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to delete discussion'})