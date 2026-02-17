import json
import boto3
import os
from decimal import Decimal
from utils import lambda_response, parse_body, get_timestamp, generate_id, get_ttl_timestamp

dynamodb = boto3.resource('dynamodb')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE')
MESSAGES_TABLE = os.environ.get('MESSAGES_TABLE')


def update_consultation_purposes(event, context):
    """Update consultation purposes for a session"""
    body = parse_body(event)
    session_id = event['pathParameters']['sessionId']
    consultation_purposes = body.get('consultationPurposes', '')
    
    if not session_id:
        return lambda_response(400, {'error': 'Missing sessionId'})
    
    if not consultation_purposes:
        return lambda_response(400, {'error': 'Missing consultationPurposes'})
    
    # Get session to verify it exists and is active
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    try:
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        if session['status'] != 'active':
            return lambda_response(400, {'error': 'Session not active'})
    except Exception as e:
        print(f"Database error checking session: {str(e)}")
        return lambda_response(500, {'error': 'Database error'})
    
    # Update consultation purposes
    try:
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET consultationPurposes = :purposes',
            ExpressionAttributeValues={':purposes': consultation_purposes}
        )
        
        print(f"Consultation purposes updated for session {session_id}: {consultation_purposes}")
        
        return lambda_response(200, {
            'message': 'Consultation purposes updated successfully',
            'sessionId': session_id,
            'consultationPurposes': consultation_purposes
        })
    except Exception as e:
        print(f"Failed to update consultation purposes for session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to update consultation purposes'})

def handle_feedback(event, context):
    """Handle customer feedback submission"""
    body = parse_body(event)
    session_id = event['pathParameters']['sessionId']
    rating = body.get('rating')
    feedback = body.get('feedback', '')
    
    if not session_id:
        return lambda_response(400, {'error': 'Missing sessionId'})
    
    if not rating or not isinstance(rating, (int, float)) or rating < 0.5 or rating > 5:
        return lambda_response(400, {'error': 'Invalid rating. Must be between 0.5 and 5.0'})
    
    # Get session to verify it exists
    sessions_table = dynamodb.Table(SESSIONS_TABLE)
    try:
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
    except Exception as e:
        print(f"Database error checking session: {str(e)}")
        return lambda_response(500, {'error': 'Database error'})
    
    # Save feedback
    timestamp = get_timestamp()
    ttl_value = get_ttl_timestamp(365)  # Keep feedback for 1 year
    
    feedback_item = {
        'PK': f'SESSION#{session_id}',
        'SK': 'FEEDBACK',
        'sessionId': session_id,
        'rating': Decimal(str(rating)),  # Convert float to Decimal for DynamoDB
        'feedback': feedback,
        'timestamp': timestamp,
        'ttl': ttl_value
    }
    
    try:
        sessions_table.put_item(Item=feedback_item)
        print(f"Feedback saved for session {session_id}: rating={rating}, feedback_length={len(feedback)}")
        
        return lambda_response(200, {
            'message': 'Feedback submitted successfully',
            'sessionId': session_id,
            'rating': rating
        })
    except Exception as e:
        print(f"Failed to save feedback for session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to save feedback'})

