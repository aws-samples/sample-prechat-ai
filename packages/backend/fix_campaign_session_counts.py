# nosemgrep
import boto3
import logging
import os
from botocore.exceptions import ClientError
from utils import lambda_response, get_timestamp

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
CAMPAIGNS_TABLE = os.environ.get('CAMPAIGNS_TABLE')

def fix_campaign_session_counts(event, context):
    """
    Fix session counts for all campaigns by recalculating from actual sessions
    """
    try:
        if not SESSIONS_TABLE or not CAMPAIGNS_TABLE:
            return lambda_response(500, {'error': 'Required environment variables not set'})
        
        campaigns_table = dynamodb.Table(CAMPAIGNS_TABLE)
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # Get all campaigns
        campaigns_resp = campaigns_table.scan(
            FilterExpression='SK = :sk AND begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={
                ':sk': 'METADATA',
                ':pk_prefix': 'CAMPAIGN#'
            }
        )
        
        updated_count = 0
        
        for campaign in campaigns_resp.get('Items', []):
            campaign_id = campaign['campaignId']
            
            # Get all sessions for this campaign using GSI2
            sessions_resp = sessions_table.query(
                IndexName='GSI2',
                KeyConditionExpression='GSI2PK = :pk',
                ExpressionAttributeValues={':pk': f'CAMPAIGN#{campaign_id}'},
                ScanIndexForward=False
            )
            
            sessions = sessions_resp.get('Items', [])
            
            total_sessions = len(sessions)
            completed_sessions = len([s for s in sessions if s.get('status') == 'completed'])
            
            # Update campaign record
            campaigns_table.update_item(
                Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'},
                UpdateExpression='SET sessionCount = :total, completedSessionCount = :completed, updatedAt = :timestamp',
                ExpressionAttributeValues={
                    ':total': total_sessions,
                    ':completed': completed_sessions,
                    ':timestamp': get_timestamp()
                }
            )
            
            logger.info(f"Updated campaign {campaign_id} ({campaign['campaignName']}): {total_sessions} total, {completed_sessions} completed")
            updated_count += 1
        
        return lambda_response(200, {
            'message': 'Campaign session counts fixed successfully',
            'updatedCampaigns': updated_count
        })
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error fixing campaign session counts: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error fixing campaign session counts: {str(e)}")
        return lambda_response(500, {'error': 'Failed to fix campaign session counts'})