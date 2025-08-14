import json
import boto3
from utils import lambda_response, parse_body, verify_csrf_token, get_timestamp

dynamodb = boto3.resource('dynamodb')

def submit_feedback(event, context):
    """Submit customer feedback for a session"""
    try:
        session_id = event['pathParameters']['sessionId']
        
        # CSRF Protection - Verify CSRF token
        if not verify_csrf_token(event, session_id):
            return lambda_response(403, {'error': 'Invalid CSRF token'})
        
        body = parse_body(event)
        rating = body.get('rating')
        feedback = body.get('feedback', '')
        
        if not rating or not isinstance(rating, (int, float)) or rating < 0 or rating > 5:
            return lambda_response(400, {'error': 'Valid rating (0-5) is required'})
        
        timestamp = get_timestamp()
        
        # Store feedback in sessions table
        sessions_table = dynamodb.Table('mte-sessions')
        sessions_table.update_item(
            Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'},
            UpdateExpression='SET feedback = :feedback, feedbackTimestamp = :timestamp',
            ExpressionAttributeValues={
                ':feedback': {
                    'rating': rating,
                    'comment': feedback
                },
                ':timestamp': timestamp
            }
        )
        
        return lambda_response(200, {'message': 'Feedback submitted successfully'})
        
    except Exception as e:
        print(f"Error submitting feedback: {str(e)}")
        return lambda_response(500, {'error': 'Failed to submit feedback'})

def get_session_feedback(event, context):
    """Get feedback for a session (admin access)"""
    try:
        session_id = event['pathParameters']['sessionId']
        
        sessions_table = dynamodb.Table('mte-sessions')
        session_resp = sessions_table.get_item(Key={'PK': f'SESSION#{session_id}', 'SK': 'METADATA'})
        
        if 'Item' not in session_resp:
            return lambda_response(404, {'error': 'Session not found'})
        
        session = session_resp['Item']
        feedback = session.get('feedback')
        
        if not feedback:
            return lambda_response(404, {'error': 'No feedback found'})
        
        return lambda_response(200, {
            'feedback': feedback,
            'feedbackTimestamp': session.get('feedbackTimestamp')
        })
        
    except Exception as e:
        print(f"Error getting feedback: {str(e)}")
        return lambda_response(500, {'error': 'Failed to get feedback'})