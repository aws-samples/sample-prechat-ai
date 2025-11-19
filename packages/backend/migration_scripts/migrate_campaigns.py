#!/usr/bin/env python3
"""
Migration script to move campaign data from SessionsTable to CampaignsTable
"""

import boto3
import json
import logging
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def migrate_campaigns(sessions_table_name, campaigns_table_name, region='ap-northeast-2'):
    """
    Migrate campaign data from SessionsTable to CampaignsTable
    
    Args:
        sessions_table_name (str): Name of the sessions table
        campaigns_table_name (str): Name of the campaigns table
        region (str): AWS region
    """
    
    dynamodb = boto3.resource('dynamodb', region_name=region)
    sessions_table = dynamodb.Table(sessions_table_name)
    campaigns_table = dynamodb.Table(campaigns_table_name)
    
    try:
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
        
        # Migrate each campaign
        migrated_count = 0
        failed_count = 0
        
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
                continue
        
        logger.info(f"Migration completed. Migrated: {migrated_count}, Failed: {failed_count}")
        
        # Optionally, remove campaign records from SessionsTable after successful migration
        if failed_count == 0:
            logger.info("All campaigns migrated successfully. Removing from SessionsTable...")
            
            for campaign in campaigns:
                try:
                    sessions_table.delete_item(
                        Key={
                            'PK': campaign['PK'],
                            'SK': campaign['SK']
                        }
                    )
                    logger.info(f"Removed campaign {campaign['campaignId']} from SessionsTable")
                except ClientError as e:
                    logger.error(f"Failed to remove campaign {campaign['campaignId']} from SessionsTable: {e}")
        else:
            logger.warning(f"Some campaigns failed to migrate. Keeping original records in SessionsTable.")
        
        return {
            'migrated': migrated_count,
            'failed': failed_count,
            'total': len(campaigns)
        }
        
    except ClientError as e:
        logger.error(f"Error during migration: {e}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during migration: {e}")
        raise

def verify_migration(sessions_table_name, campaigns_table_name, region='ap-northeast-2'):
    """
    Verify that the migration was successful
    
    Args:
        sessions_table_name (str): Name of the sessions table
        campaigns_table_name (str): Name of the campaigns table
        region (str): AWS region
    """
    
    dynamodb = boto3.resource('dynamodb', region_name=region)
    sessions_table = dynamodb.Table(sessions_table_name)
    campaigns_table = dynamodb.Table(campaigns_table_name)
    
    try:
        # Check remaining campaigns in SessionsTable
        sessions_response = sessions_table.scan(
            FilterExpression='SK = :sk AND begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={
                ':sk': 'METADATA',
                ':pk_prefix': 'CAMPAIGN#'
            }
        )
        
        remaining_in_sessions = len(sessions_response.get('Items', []))
        
        # Check campaigns in CampaignsTable
        campaigns_response = campaigns_table.scan(
            FilterExpression='SK = :sk AND begins_with(PK, :pk_prefix)',
            ExpressionAttributeValues={
                ':sk': 'METADATA',
                ':pk_prefix': 'CAMPAIGN#'
            }
        )
        
        migrated_to_campaigns = len(campaigns_response.get('Items', []))
        
        logger.info(f"Verification results:")
        logger.info(f"  Remaining in SessionsTable: {remaining_in_sessions}")
        logger.info(f"  Migrated to CampaignsTable: {migrated_to_campaigns}")
        
        return {
            'remaining_in_sessions': remaining_in_sessions,
            'migrated_to_campaigns': migrated_to_campaigns
        }
        
    except ClientError as e:
        logger.error(f"Error during verification: {e}")
        raise

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) != 3:
        print("Usage: python migrate_campaigns.py <sessions_table_name> <campaigns_table_name>")
        sys.exit(1)
    
    sessions_table_name = sys.argv[1]
    campaigns_table_name = sys.argv[2]
    
    try:
        # Run migration
        result = migrate_campaigns(sessions_table_name, campaigns_table_name)
        print(f"Migration completed: {json.dumps(result, indent=2)}")
        
        # Verify migration
        verification = verify_migration(sessions_table_name, campaigns_table_name)
        print(f"Verification results: {json.dumps(verification, indent=2)}")
        
    except Exception as e:
        logger.error(f"Migration failed: {e}")
        sys.exit(1)