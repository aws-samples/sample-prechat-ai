# nosemgrep
import json
import boto3
import logging
import os
from botocore.exceptions import ClientError
from utils import lambda_response

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
CAMPAIGNS_TABLE = os.environ.get('CAMPAIGNS_TABLE')

def migrate_campaigns_handler(event, context):
    """
    Lambda handler to migrate campaign data from SessionsTable to CampaignsTable
    """
    try:
        if not SESSIONS_TABLE or not CAMPAIGNS_TABLE:
            return lambda_response(500, {'error': 'Table names not configured'})
        
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        campaigns_table = dynamodb.Table(CAMPAIGNS_TABLE)
        
        # Scan for all campaign records in SessionsTable
        logger.info("Scanning for campaign records in SessionsTable...")
        
        response = sessions_table.scan(
            FilterExpression='SK = :sk AND begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={
                ':sk': 'METADATA',
                ':pk_prefix': 'CAMPAIGN#'
            }
        )
        
        campaigns = response.get('Items', [])
        logger.info(f"Found {len(campaigns)} campaign records to migrate")
        
        if not campaigns:
            return lambda_response(200, {
                'message': 'No campaigns found to migrate',
                'migrated': 0,
                'failed': 0,
                'total': 0
            })
        
        # Migrate each campaign
        migrated_count = 0
        failed_count = 0
        failed_campaigns = []
        
        for campaign in campaigns:
            try:
                # Prepare campaign record for new table
                campaign_record = {
                    'PK': campaign['PK'],
                    'SK': campaign['SK'],
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
                    'completedSessionCount': campaign.get('completedSessionCount', 0),
                    'GSI1PK': campaign['GSI1PK'],
                    'GSI1SK': campaign['GSI1SK']
                }
                
                # Insert into CampaignsTable
                campaigns_table.put_item(Item=campaign_record)
                
                logger.info(f"Migrated campaign: {campaign['campaignId']} - {campaign['campaignName']}")
                migrated_count += 1
                
            except ClientError as e:
                logger.error(f"Failed to migrate campaign {campaign['campaignId']}: {e}")
                failed_count += 1
                failed_campaigns.append({
                    'campaignId': campaign['campaignId'],
                    'campaignName': campaign['campaignName'],
                    'error': str(e)
                })
                continue
        
        logger.info(f"Migration completed. Migrated: {migrated_count}, Failed: {failed_count}")
        
        # If all campaigns migrated successfully, remove them from SessionsTable
        if failed_count == 0:
            logger.info("All campaigns migrated successfully. Removing from SessionsTable...")
            
            removed_count = 0
            for campaign in campaigns:
                try:
                    sessions_table.delete_item(
                        Key={
                            'PK': campaign['PK'],
                            'SK': campaign['SK']
                        }
                    )
                    logger.info(f"Removed campaign {campaign['campaignId']} from SessionsTable")
                    removed_count += 1
                except ClientError as e:
                    logger.error(f"Failed to remove campaign {campaign['campaignId']} from SessionsTable: {e}")
            
            return lambda_response(200, {
                'message': 'Migration completed successfully',
                'migrated': migrated_count,
                'failed': failed_count,
                'total': len(campaigns),
                'removed_from_sessions_table': removed_count
            })
        else:
            return lambda_response(200, {
                'message': 'Migration completed with some failures',
                'migrated': migrated_count,
                'failed': failed_count,
                'total': len(campaigns),
                'failed_campaigns': failed_campaigns,
                'note': 'Failed campaigns remain in SessionsTable'
            })
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error during migration: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error during migration: {str(e)}")
        return lambda_response(500, {'error': 'Migration failed'})

def verify_migration_handler(event, context):
    """
    Lambda handler to verify the migration was successful
    """
    try:
        if not SESSIONS_TABLE or not CAMPAIGNS_TABLE:
            return lambda_response(500, {'error': 'Table names not configured'})
        
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        campaigns_table = dynamodb.Table(CAMPAIGNS_TABLE)
        
        # Check remaining campaigns in SessionsTable
        sessions_response = sessions_table.scan(
            FilterExpression='SK = :sk AND begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={
                ':sk': 'METADATA',
                ':pk_prefix': 'CAMPAIGN#'
            }
        )
        
        remaining_in_sessions = sessions_response.get('Items', [])
        
        # Check campaigns in CampaignsTable
        campaigns_response = campaigns_table.scan(
            FilterExpression='SK = :sk AND begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={
                ':sk': 'METADATA',
                ':pk_prefix': 'CAMPAIGN#'
            }
        )
        
        migrated_to_campaigns = campaigns_response.get('Items', [])
        
        logger.info(f"Verification results:")
        logger.info(f"  Remaining in SessionsTable: {len(remaining_in_sessions)}")
        logger.info(f"  Migrated to CampaignsTable: {len(migrated_to_campaigns)}")
        
        return lambda_response(200, {
            'verification_results': {
                'remaining_in_sessions_table': len(remaining_in_sessions),
                'migrated_to_campaigns_table': len(migrated_to_campaigns),
                'remaining_campaigns': [
                    {
                        'campaignId': c['campaignId'],
                        'campaignName': c['campaignName']
                    } for c in remaining_in_sessions
                ],
                'migrated_campaigns': [
                    {
                        'campaignId': c['campaignId'],
                        'campaignName': c['campaignName']
                    } for c in migrated_to_campaigns
                ]
            }
        })
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error during verification: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error during verification: {str(e)}")
        return lambda_response(500, {'error': 'Verification failed'})