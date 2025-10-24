# nosemgrep
import json
import boto3
import logging
import os
from decimal import Decimal
from botocore.exceptions import ClientError
from utils import lambda_response, parse_body, get_timestamp, generate_id

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
cognito = boto3.client('cognito-idp')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
USER_POOL_ID = os.environ.get('USER_POOL_ID')

def create_campaign(event, context):
    """Create a new campaign"""
    try:
        body = parse_body(event)
        
        # Validate required fields
        required_fields = ['campaignName', 'campaignCode', 'startDate', 'endDate', 'ownerId']
        for field in required_fields:
            if not body.get(field):
                return lambda_response(400, {'error': f'Missing required field: {field}'})
        
        campaign_name = body['campaignName']
        campaign_code = body['campaignCode']
        description = body.get('description', '')
        start_date = body['startDate']
        end_date = body['endDate']
        owner_id = body['ownerId']
        
        # Validate date range
        if start_date >= end_date:
            return lambda_response(400, {'error': 'End date must be after start date'})
        
        # Get owner information from Cognito
        owner_info = get_user_info(owner_id)
        if not owner_info:
            return lambda_response(400, {'error': 'Invalid owner ID'})
        
        # Generate campaign ID
        campaign_id = generate_id()
        timestamp = get_timestamp()
        
        # Create campaign record
        campaign_record = {
            'PK': f'CAMPAIGN#{campaign_id}',
            'SK': 'METADATA',
            'campaignId': campaign_id,
            'campaignName': campaign_name,
            'campaignCode': campaign_code,
            'description': description,
            'startDate': start_date,
            'endDate': end_date,
            'ownerId': owner_id,
            'ownerEmail': owner_info['email'],
            'ownerName': owner_info['name'],
            'status': 'active',
            'createdAt': timestamp,
            'updatedAt': timestamp,
            'sessionCount': 0,
            'completedSessionCount': 0,
            'GSI1PK': f'OWNER#{owner_id}',
            'GSI1SK': f'CAMPAIGN#{timestamp}'
        }
        
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # Check if campaign code already exists
        existing_campaigns = sessions_table.scan(
            FilterExpression='SK = :sk AND campaignCode = :code',
            ExpressionAttributeValues={
                ':sk': 'METADATA',
                ':code': campaign_code
            }
        )
        
        if existing_campaigns.get('Items'):
            return lambda_response(400, {'error': 'Campaign code already exists'})
        
        # Create campaign
        sessions_table.put_item(Item=campaign_record)
        
        logger.info(f"Created campaign {campaign_id} with code {campaign_code}")
        
        return lambda_response(201, {
            'campaignId': campaign_id,
            'campaignName': campaign_name,
            'campaignCode': campaign_code,
            'description': description,
            'startDate': start_date,
            'endDate': end_date,
            'ownerId': owner_id,
            'ownerEmail': owner_info['email'],
            'ownerName': owner_info['name'],
            'status': 'active',
            'createdAt': timestamp,
            'sessionCount': 0,
            'completedSessionCount': 0
        })
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error creating campaign: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error creating campaign: {str(e)}")
        return lambda_response(500, {'error': 'Failed to create campaign'})

def list_campaigns(event, context):
    """List all campaigns"""
    try:
        owner_id = event.get('queryStringParameters', {}).get('ownerId') if event.get('queryStringParameters') else None
        
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        if owner_id:
            # Query campaigns by owner
            response = sessions_table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={':pk': f'OWNER#{owner_id}'},
                ScanIndexForward=False
            )
        else:
            # Scan all campaigns
            response = sessions_table.scan(
                FilterExpression='SK = :sk AND begins_with(PK, :pk_prefix)',
                ExpressionAttributeValues={
                    ':sk': 'METADATA',
                    ':pk_prefix': 'CAMPAIGN#'
                }
            )
        
        campaigns = []
        for item in response.get('Items', []):
            campaigns.append({
                'campaignId': item['campaignId'],
                'campaignName': item['campaignName'],
                'campaignCode': item['campaignCode'],
                'description': item.get('description', ''),
                'startDate': item['startDate'],
                'endDate': item['endDate'],
                'ownerId': item['ownerId'],
                'ownerEmail': item['ownerEmail'],
                'ownerName': item['ownerName'],
                'status': item['status'],
                'createdAt': item['createdAt'],
                'updatedAt': item.get('updatedAt', item['createdAt']),
                'sessionCount': item.get('sessionCount', 0),
                'completedSessionCount': item.get('completedSessionCount', 0)
            })
        
        return lambda_response(200, {'campaigns': campaigns})
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error listing campaigns: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error listing campaigns: {str(e)}")
        return lambda_response(500, {'error': 'Failed to list campaigns'})

def get_campaign(event, context):
    """Get campaign details"""
    try:
        campaign_id = event['pathParameters']['campaignId']
        if not campaign_id:
            return lambda_response(400, {'error': 'Campaign ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing campaign ID parameter'})
    
    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        campaign_resp = sessions_table.get_item(
            Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'}
        )
        
        if 'Item' not in campaign_resp:
            return lambda_response(404, {'error': 'Campaign not found'})
        
        campaign = campaign_resp['Item']
        
        return lambda_response(200, {
            'campaignId': campaign['campaignId'],
            'campaignName': campaign['campaignName'],
            'campaignCode': campaign['campaignCode'],
            'description': campaign.get('description', ''),
            'startDate': campaign['startDate'],
            'endDate': campaign['endDate'],
            'ownerId': campaign['ownerId'],
            'ownerEmail': campaign['ownerEmail'],
            'ownerName': campaign['ownerName'],
            'status': campaign['status'],
            'createdAt': campaign['createdAt'],
            'updatedAt': campaign.get('updatedAt', campaign['createdAt']),
            'sessionCount': campaign.get('sessionCount', 0),
            'completedSessionCount': campaign.get('completedSessionCount', 0)
        })
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error getting campaign {campaign_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error getting campaign {campaign_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to get campaign'})

def update_campaign(event, context):
    """Update campaign details"""
    try:
        campaign_id = event['pathParameters']['campaignId']
        if not campaign_id:
            return lambda_response(400, {'error': 'Campaign ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing campaign ID parameter'})
    
    try:
        body = parse_body(event)
        
        # Validate that at least one field is provided for update
        updatable_fields = ['campaignName', 'campaignCode', 'description', 'startDate', 'endDate', 'ownerId', 'status']
        update_data = {k: v for k, v in body.items() if k in updatable_fields and v is not None}
        
        if not update_data:
            return lambda_response(400, {'error': 'No valid fields provided for update'})
        
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # Check if campaign exists
        campaign_resp = sessions_table.get_item(
            Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'}
        )
        
        if 'Item' not in campaign_resp:
            return lambda_response(404, {'error': 'Campaign not found'})
        
        current_campaign = campaign_resp['Item']
        
        # Validate date range if dates are being updated
        start_date = update_data.get('startDate', current_campaign['startDate'])
        end_date = update_data.get('endDate', current_campaign['endDate'])
        
        if start_date >= end_date:
            return lambda_response(400, {'error': 'End date must be after start date'})
        
        # Handle owner change
        if 'ownerId' in update_data:
            owner_info = get_user_info(update_data['ownerId'])
            if not owner_info:
                return lambda_response(400, {'error': 'Invalid owner ID'})
            update_data['ownerEmail'] = owner_info['email']
            update_data['ownerName'] = owner_info['name']
        
        # Check if campaign code is being changed and if it already exists
        if 'campaignCode' in update_data and update_data['campaignCode'] != current_campaign['campaignCode']:
            existing_campaigns = sessions_table.scan(
                FilterExpression='SK = :sk AND campaignCode = :code AND campaignId <> :current_id',
                ExpressionAttributeValues={
                    ':sk': 'METADATA',
                    ':code': update_data['campaignCode'],
                    ':current_id': campaign_id
                }
            )
            
            if existing_campaigns.get('Items'):
                return lambda_response(400, {'error': 'Campaign code already exists'})
        
        # Build update expression
        update_expression = 'SET updatedAt = :timestamp'
        expression_values = {':timestamp': get_timestamp()}
        
        for field, value in update_data.items():
            update_expression += f', {field} = :{field}'
            expression_values[f':{field}'] = value
        
        # Update campaign
        sessions_table.update_item(
            Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values
        )
        
        # Get updated campaign
        updated_resp = sessions_table.get_item(
            Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'}
        )
        
        updated_campaign = updated_resp['Item']
        
        logger.info(f"Updated campaign {campaign_id}")
        
        return lambda_response(200, {
            'campaignId': updated_campaign['campaignId'],
            'campaignName': updated_campaign['campaignName'],
            'campaignCode': updated_campaign['campaignCode'],
            'description': updated_campaign.get('description', ''),
            'startDate': updated_campaign['startDate'],
            'endDate': updated_campaign['endDate'],
            'ownerId': updated_campaign['ownerId'],
            'ownerEmail': updated_campaign['ownerEmail'],
            'ownerName': updated_campaign['ownerName'],
            'status': updated_campaign['status'],
            'createdAt': updated_campaign['createdAt'],
            'updatedAt': updated_campaign['updatedAt'],
            'sessionCount': updated_campaign.get('sessionCount', 0),
            'completedSessionCount': updated_campaign.get('completedSessionCount', 0)
        })
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error updating campaign {campaign_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error updating campaign {campaign_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to update campaign'})

def delete_campaign(event, context):
    """Delete a campaign"""
    try:
        campaign_id = event['pathParameters']['campaignId']
        if not campaign_id:
            return lambda_response(400, {'error': 'Campaign ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing campaign ID parameter'})
    
    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # Check if campaign exists
        campaign_resp = sessions_table.get_item(
            Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'}
        )
        
        if 'Item' not in campaign_resp:
            return lambda_response(404, {'error': 'Campaign not found'})
        
        # Check if campaign has associated sessions
        sessions_resp = sessions_table.scan(
            FilterExpression='SK = :sk AND campaignId = :campaign_id',
            ExpressionAttributeValues={
                ':sk': 'METADATA',
                ':campaign_id': campaign_id
            }
        )
        
        if sessions_resp.get('Items'):
            return lambda_response(400, {
                'error': 'Cannot delete campaign with associated sessions',
                'sessionCount': len(sessions_resp['Items'])
            })
        
        # Delete campaign
        sessions_table.delete_item(
            Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'}
        )
        
        logger.info(f"Deleted campaign {campaign_id}")
        
        return lambda_response(200, {'message': 'Campaign deleted successfully'})
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error deleting campaign {campaign_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error deleting campaign {campaign_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to delete campaign'})

def get_campaign_sessions(event, context):
    """Get sessions associated with a campaign"""
    try:
        campaign_id = event['pathParameters']['campaignId']
        if not campaign_id:
            return lambda_response(400, {'error': 'Campaign ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing campaign ID parameter'})
    
    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # Check if campaign exists
        campaign_resp = sessions_table.get_item(
            Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'}
        )
        
        if 'Item' not in campaign_resp:
            return lambda_response(404, {'error': 'Campaign not found'})
        
        # Get sessions associated with campaign using GSI2
        sessions_resp = sessions_table.query(
            IndexName='GSI2',
            KeyConditionExpression='GSI2PK = :pk',
            ExpressionAttributeValues={':pk': f'CAMPAIGN#{campaign_id}'},
            ScanIndexForward=False
        )
        
        sessions = []
        for item in sessions_resp.get('Items', []):
            # Skip campaign records
            if item['PK'].startswith('CAMPAIGN#'):
                continue
                
            session_id = item.get('sessionId') or item['PK'].replace('SESSION#', '')
            
            sessions.append({
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
                'campaignId': campaign_id,
                'campaignName': item.get('campaignName', '')
            })
        
        return lambda_response(200, {
            'campaignId': campaign_id,
            'sessions': sessions,
            'totalSessions': len(sessions)
        })
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error getting campaign sessions {campaign_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error getting campaign sessions {campaign_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to get campaign sessions'})

def associate_session_with_campaign(event, context):
    """Associate a session with a campaign"""
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id:
            return lambda_response(400, {'error': 'Session ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing session ID parameter'})
    
    try:
        body = parse_body(event)
        campaign_id = body.get('campaignId')
        
        if not campaign_id:
            return lambda_response(400, {'error': 'Campaign ID is required'})
        
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # Check if session exists
        session_resp = sessions_table.get_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'}
        )
        
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        # Check if campaign exists
        campaign_resp = sessions_table.get_item(
            Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'}
        )
        
        if 'Item' not in campaign_resp:
            return lambda_response(404, {'error': 'Campaign not found'})
        
        campaign = campaign_resp['Item']
        
        # Update session with campaign association
        timestamp = get_timestamp()
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET campaignId = :campaign_id, campaignName = :campaign_name, GSI2PK = :gsi2pk, GSI2SK = :gsi2sk',
            ExpressionAttributeValues={
                ':campaign_id': campaign_id,
                ':campaign_name': campaign['campaignName'],
                ':gsi2pk': f'CAMPAIGN#{campaign_id}',
                ':gsi2sk': f'SESSION#{timestamp}'
            }
        )
        
        logger.info(f"Associated session {session_id} with campaign {campaign_id}")
        
        return lambda_response(200, {
            'message': 'Session associated with campaign successfully',
            'sessionId': session_id,
            'campaignId': campaign_id,
            'campaignName': campaign['campaignName']
        })
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error associating session {session_id} with campaign: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error associating session {session_id} with campaign: {str(e)}")
        return lambda_response(500, {'error': 'Failed to associate session with campaign'})

def get_user_info(user_id):
    """Get user information from Cognito"""
    if not user_id or not USER_POOL_ID:
        return None
    
    try:
        # Get user by username (user_id)
        response = cognito.admin_get_user(
            UserPoolId=USER_POOL_ID,
            Username=user_id
        )
        
        attributes = {attr['Name']: attr['Value'] for attr in response['UserAttributes']}
        
        return {
            'email': attributes.get('email', ''),
            'name': attributes.get('name', user_id),
            'phone': attributes.get('phone_number', '')
        }
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        if error_code == 'UserNotFoundException':
            logger.warning(f"User {user_id} not found in Cognito")
        else:
            logger.error(f"Error getting user info from Cognito: {error_code} - {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error getting user info from Cognito: {str(e)}")
        return None