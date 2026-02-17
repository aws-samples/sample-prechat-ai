# nosemgrep
import json
import boto3
import logging
import os
from decimal import Decimal
from datetime import datetime, timezone
from collections import defaultdict, Counter
from botocore.exceptions import ClientError
from utils import lambda_response, get_timestamp, convert_decimal_to_int, serialize_dynamodb_item

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
MESSAGES_TABLE = os.environ.get('MESSAGES_TABLE')
CAMPAIGNS_TABLE = os.environ.get('CAMPAIGNS_TABLE')

def get_campaign_analytics(event, context):
    """Get analytics for a specific campaign"""
    try:
        campaign_id = event['pathParameters']['campaignId']
        if not campaign_id:
            return lambda_response(400, {'error': 'Campaign ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing campaign ID parameter'})
    
    try:
        campaigns_table = dynamodb.Table(CAMPAIGNS_TABLE)
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
        # Check if campaign exists
        campaign_resp = campaigns_table.get_item(
            Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'}
        )
        
        if 'Item' not in campaign_resp:
            return lambda_response(404, {'error': 'Campaign not found'})
        
        # Get all sessions for this campaign using GSI2
        sessions_resp = sessions_table.query(
            IndexName='GSI2',
            KeyConditionExpression='GSI2PK = :pk',
            ExpressionAttributeValues={':pk': f'CAMPAIGN#{campaign_id}'},
            ScanIndexForward=False
        )
        
        sessions = sessions_resp.get('Items', [])
        
        # Calculate analytics
        analytics = calculate_campaign_analytics(campaign_id, sessions)
        
        return lambda_response(200, analytics)
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error getting campaign analytics {campaign_id}: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error getting campaign analytics {campaign_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to get campaign analytics'})

def calculate_campaign_analytics(campaign_id, sessions):
    """Calculate comprehensive analytics for a campaign"""
    try:
        total_sessions = len(sessions)
        active_sessions = len([s for s in sessions if s.get('status') == 'active'])
        completed_sessions = len([s for s in sessions if s.get('status') == 'completed'])
        
        # Calculate completion rate
        completion_rate = (completed_sessions / total_sessions * 100) if total_sessions > 0 else 0
        
        # Calculate average session duration for completed sessions
        total_duration = 0
        duration_count = 0
        
        for session in sessions:
            if session.get('completedAt') and session.get('createdAt'):
                try:
                    created = datetime.fromisoformat(session['createdAt'].replace('Z', '+00:00'))
                    completed = datetime.fromisoformat(session['completedAt'].replace('Z', '+00:00'))
                    duration = (completed - created).total_seconds() / 60  # Convert to minutes
                    total_duration += duration
                    duration_count += 1
                except (ValueError, TypeError):
                    continue
        
        average_duration = total_duration / duration_count if duration_count > 0 else 0
        
        # Analyze consultation purposes
        purposes_counter = Counter()
        for session in sessions:
            purposes = session.get('consultationPurposes', '')
            if purposes:
                # Split by common delimiters and clean up
                purpose_list = [p.strip() for p in purposes.replace(',', ';').split(';') if p.strip()]
                purposes_counter.update(purpose_list)
        
        top_purposes = [
            {'purpose': purpose, 'count': count}
            for purpose, count in purposes_counter.most_common(5)
        ]
        
        # Analyze completed sessions by completion date
        sessions_by_date = defaultdict(int)
        for session in sessions:
            # Only count completed sessions
            if session.get('status') == 'completed' and session.get('completedAt'):
                try:
                    completed_date = datetime.fromisoformat(session['completedAt'].replace('Z', '+00:00')).date()
                    sessions_by_date[completed_date.isoformat()] += 1
                except (ValueError, TypeError):
                    continue
        
        sessions_timeline = [
            {'date': date, 'count': count}
            for date, count in sorted(sessions_by_date.items())
        ]
        
        # Analyze customer companies
        companies_counter = Counter()
        for session in sessions:
            company = session.get('customerInfo', {}).get('company', '')
            if company:
                companies_counter[company] += 1
        
        customer_companies = [
            {'company': company, 'sessionCount': count}
            for company, count in companies_counter.most_common(10)
        ]
        
        # Calculate status distribution
        status_distribution = Counter(session.get('status', 'unknown') for session in sessions)
        
        # Analyze CSAT feedback
        csat_feedback = []
        csat_ratings = []
        
        for session in sessions:
            feedback = session.get('feedback')
            if feedback:
                rating = feedback.get('rating')
                narrative = feedback.get('narrative', '')
                
                if rating is not None:
                    csat_ratings.append(int(rating))
                    csat_feedback.append({
                        'sessionId': session.get('sessionId', session['PK'].replace('SESSION#', '')),
                        'customerName': session.get('customerInfo', {}).get('name', 'Unknown'),
                        'customerCompany': session.get('customerInfo', {}).get('company', 'Unknown'),
                        'rating': int(rating),
                        'narrative': narrative,
                        'completedAt': session.get('completedAt', '')
                    })
        
        # Calculate average CSAT rating
        average_csat = round(sum(csat_ratings) / len(csat_ratings), 1) if csat_ratings else 0
        
        analytics = {
            'campaignId': campaign_id,
            'totalSessions': total_sessions,
            'activeSessions': active_sessions,
            'completedSessions': completed_sessions,
            'completionRate': round(completion_rate, 2),
            'averageSessionDuration': round(average_duration, 2),
            'topConsultationPurposes': top_purposes,
            'sessionsByDate': sessions_timeline,
            'customerCompanies': customer_companies,
            'statusDistribution': dict(status_distribution),
            'csatFeedback': csat_feedback,
            'averageCSAT': average_csat,
            'totalCSATResponses': len(csat_ratings),
            'calculatedAt': get_timestamp()
        }
        
        return analytics
        
    except Exception as e:
        logger.error(f"Error calculating campaign analytics: {str(e)}")
        raise

def update_campaign_session_counts(campaign_id):
    """Update session counts for a campaign (called when sessions are modified)"""
    try:
        sessions_table = dynamodb.Table(SESSIONS_TABLE)
        
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
        campaigns_table = dynamodb.Table(CAMPAIGNS_TABLE)
        campaigns_table.update_item(
            Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'},
            UpdateExpression='SET sessionCount = :total, completedSessionCount = :completed, updatedAt = :timestamp',
            ExpressionAttributeValues={
                ':total': total_sessions,
                ':completed': completed_sessions,
                ':timestamp': get_timestamp()
            }
        )
        
        logger.info(f"Updated campaign {campaign_id} session counts: {total_sessions} total, {completed_sessions} completed")
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error updating campaign session counts {campaign_id}: {error_code} - {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error updating campaign session counts {campaign_id}: {str(e)}")

def get_campaigns_summary_analytics(event, context):
    """Get summary analytics across all campaigns"""
    try:
        owner_id = event.get('queryStringParameters', {}).get('ownerId') if event.get('queryStringParameters') else None
        
        campaigns_table = dynamodb.Table(CAMPAIGNS_TABLE)
        
        # Get all campaigns
        if owner_id:
            campaigns_resp = campaigns_table.query(
                IndexName='GSI1',
                KeyConditionExpression='GSI1PK = :pk',
                ExpressionAttributeValues={':pk': f'OWNER#{owner_id}'}
            )
        else:
            campaigns_resp = campaigns_table.scan(
                FilterExpression='SK = :sk AND begins_with(PK, :pk_prefix)',
                ExpressionAttributeValues={
                    ':sk': 'METADATA',
                    ':pk_prefix': 'CAMPAIGN#'
                }
            )
        
        campaigns = campaigns_resp.get('Items', [])
        
        # Calculate summary statistics
        total_campaigns = len(campaigns)
        active_campaigns = len([c for c in campaigns if c.get('status') == 'active'])
        total_sessions_across_campaigns = sum(c.get('sessionCount', 0) for c in campaigns)
        total_completed_sessions = sum(c.get('completedSessionCount', 0) for c in campaigns)
        
        # Calculate overall completion rate
        overall_completion_rate = (
            total_completed_sessions / total_sessions_across_campaigns * 100
            if total_sessions_across_campaigns > 0 else 0
        )
        
        # Find top performing campaigns by completion rate
        campaigns_with_sessions = [c for c in campaigns if c.get('sessionCount', 0) > 0]
        top_campaigns = sorted(
            campaigns_with_sessions,
            key=lambda c: (c.get('completedSessionCount', 0) / c.get('sessionCount', 1)) * 100,
            reverse=True
        )[:5]
        
        top_performing_campaigns = [
            {
                'campaignId': c['campaignId'],
                'campaignName': c['campaignName'],
                'sessionCount': c.get('sessionCount', 0),
                'completedSessionCount': c.get('completedSessionCount', 0),
                'completionRate': round(
                    (c.get('completedSessionCount', 0) / c.get('sessionCount', 1)) * 100, 2
                )
            }
            for c in top_campaigns
        ]
        
        # Analyze campaigns by status
        status_distribution = Counter(c.get('status', 'unknown') for c in campaigns)
        
        summary = {
            'totalCampaigns': total_campaigns,
            'activeCampaigns': active_campaigns,
            'totalSessionsAcrossCampaigns': total_sessions_across_campaigns,
            'totalCompletedSessions': total_completed_sessions,
            'overallCompletionRate': round(overall_completion_rate, 2),
            'topPerformingCampaigns': top_performing_campaigns,
            'campaignStatusDistribution': dict(status_distribution),
            'calculatedAt': get_timestamp()
        }
        
        return lambda_response(200, summary)
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error getting campaigns summary analytics: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error getting campaigns summary analytics: {str(e)}")
        return lambda_response(500, {'error': 'Failed to get campaigns summary analytics'})

def get_campaign_comparison_analytics(event, context):
    """Get comparative analytics between multiple campaigns

    GET /api/admin/analytics/comparison?campaignIds=id1,id2,id3
    (Also supports legacy POST with body { campaignIds: [...] })
    """
    try:
        campaign_ids = []

        # Support GET with query params (new) and POST with body (legacy)
        http_method = event.get('httpMethod', 'GET')
        if http_method == 'GET':
            params = event.get('queryStringParameters') or {}
            campaign_ids_str = params.get('campaignIds', '')
            if campaign_ids_str:
                campaign_ids = [cid.strip() for cid in campaign_ids_str.split(',') if cid.strip()]
        else:
            body = json.loads(event.get('body', '{}'))
            campaign_ids = body.get('campaignIds', [])

        if not campaign_ids or not isinstance(campaign_ids, list):
            return lambda_response(400, {'error': 'Campaign IDs list is required'})

        if len(campaign_ids) > 10:
            return lambda_response(400, {'error': 'Maximum 10 campaigns can be compared at once'})

        campaigns_table = dynamodb.Table(CAMPAIGNS_TABLE)
        sessions_table = dynamodb.Table(SESSIONS_TABLE)

        comparison_data = []

        for campaign_id in campaign_ids:
            # Get campaign info
            campaign_resp = campaigns_table.get_item(
                Key={'PK': f'CAMPAIGN#{campaign_id}', 'SK': 'METADATA'}
            )

            if 'Item' not in campaign_resp:
                continue  # Skip non-existent campaigns

            campaign = campaign_resp['Item']

            # Get sessions for this campaign using GSI2
            sessions_resp = sessions_table.query(
                IndexName='GSI2',
                KeyConditionExpression='GSI2PK = :pk',
                ExpressionAttributeValues={':pk': f'CAMPAIGN#{campaign_id}'},
                ScanIndexForward=False
            )

            sessions = sessions_resp.get('Items', [])

            # Calculate basic metrics
            total_sessions = len(sessions)
            completed_sessions = len([s for s in sessions if s.get('status') == 'completed'])
            completion_rate = (completed_sessions / total_sessions * 100) if total_sessions > 0 else 0

            comparison_data.append({
                'campaignId': campaign_id,
                'campaignName': campaign['campaignName'],
                'campaignCode': campaign['campaignCode'],
                'status': campaign['status'],
                'startDate': campaign['startDate'],
                'endDate': campaign['endDate'],
                'totalSessions': total_sessions,
                'completedSessions': completed_sessions,
                'completionRate': round(completion_rate, 2),
                'ownerName': campaign['ownerName']
            })

        # Sort by completion rate descending
        comparison_data.sort(key=lambda x: x['completionRate'], reverse=True)

        return lambda_response(200, {
            'campaigns': comparison_data,
            'comparedAt': get_timestamp()
        })

    except json.JSONDecodeError:
        return lambda_response(400, {'error': 'Invalid JSON in request body'})
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"DynamoDB error getting campaign comparison analytics: {error_code} - {str(e)}")
        return lambda_response(500, {'error': f'Database error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error getting campaign comparison analytics: {str(e)}")
        return lambda_response(500, {'error': 'Failed to get campaign comparison analytics'})
