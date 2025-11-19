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

cognito = boto3.client('cognito-idp')
USER_POOL_ID = os.environ.get('USER_POOL_ID')

def list_cognito_users(event, context):
    """List all users in the Cognito User Pool"""
    try:
        if not USER_POOL_ID:
            return lambda_response(500, {'error': 'User Pool ID not configured'})
        
        # Get pagination token if provided
        query_params = event.get('queryStringParameters') or {}
        pagination_token = query_params.get('paginationToken')
        limit = int(query_params.get('limit', 60))  # Default to 60 users per page
        
        # Prepare request parameters
        request_params = {
            'UserPoolId': USER_POOL_ID,
            'Limit': min(limit, 60)  # AWS limit is 60
        }
        
        if pagination_token:
            request_params['PaginationToken'] = pagination_token
        
        # List users from Cognito
        response = cognito.list_users(**request_params)
        
        users = []
        for user in response.get('Users', []):
            # Extract user attributes
            attributes = {attr['Name']: attr['Value'] for attr in user.get('Attributes', [])}
            
            # Only include users with email and name
            if 'email' in attributes:
                user_data = {
                    'userId': user['Username'],
                    'email': attributes['email'],
                    'name': attributes.get('name', attributes['email'].split('@')[0]),
                    'phone': attributes.get('phone_number', ''),
                    'status': user.get('UserStatus', 'UNKNOWN'),
                    'enabled': user.get('Enabled', False),
                    'createdDate': user.get('UserCreateDate').isoformat() if user.get('UserCreateDate') else None,
                    'lastModifiedDate': user.get('UserLastModifiedDate').isoformat() if user.get('UserLastModifiedDate') else None
                }
                users.append(user_data)
        
        # Prepare response
        response_data = {
            'users': users,
            'totalUsers': len(users)
        }
        
        # Add pagination token if there are more results
        if 'PaginationToken' in response:
            response_data['nextPaginationToken'] = response['PaginationToken']
        
        logger.info(f"Retrieved {len(users)} users from Cognito User Pool")
        
        return lambda_response(200, response_data)
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"Cognito error listing users: {error_code} - {str(e)}")
        
        if error_code == 'ResourceNotFoundException':
            return lambda_response(404, {'error': 'User Pool not found'})
        elif error_code == 'NotAuthorizedException':
            return lambda_response(403, {'error': 'Not authorized to list users'})
        else:
            return lambda_response(500, {'error': f'Cognito error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error listing Cognito users: {str(e)}")
        return lambda_response(500, {'error': 'Failed to list users'})

def get_cognito_user(event, context):
    """Get a specific user from Cognito User Pool"""
    try:
        user_id = event['pathParameters']['userId']
        if not user_id:
            return lambda_response(400, {'error': 'User ID is required'})
    except (KeyError, TypeError):
        return lambda_response(400, {'error': 'Missing user ID parameter'})
    
    try:
        if not USER_POOL_ID:
            return lambda_response(500, {'error': 'User Pool ID not configured'})
        
        # Get user from Cognito
        response = cognito.admin_get_user(
            UserPoolId=USER_POOL_ID,
            Username=user_id
        )
        
        # Extract user attributes
        attributes = {attr['Name']: attr['Value'] for attr in response.get('UserAttributes', [])}
        
        user_data = {
            'userId': response['Username'],
            'email': attributes.get('email', ''),
            'name': attributes.get('name', attributes.get('email', '').split('@')[0]),
            'phone': attributes.get('phone_number', ''),
            'status': response.get('UserStatus', 'UNKNOWN'),
            'enabled': response.get('Enabled', False),
            'createdDate': response.get('UserCreateDate').isoformat() if response.get('UserCreateDate') else None,
            'lastModifiedDate': response.get('UserLastModifiedDate').isoformat() if response.get('UserLastModifiedDate') else None
        }
        
        logger.info(f"Retrieved user {user_id} from Cognito User Pool")
        
        return lambda_response(200, user_data)
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        logger.error(f"Cognito error getting user {user_id}: {error_code} - {str(e)}")
        
        if error_code == 'UserNotFoundException':
            return lambda_response(404, {'error': 'User not found'})
        elif error_code == 'NotAuthorizedException':
            return lambda_response(403, {'error': 'Not authorized to get user'})
        else:
            return lambda_response(500, {'error': f'Cognito error: {error_code}'})
    except Exception as e:
        logger.error(f"Unexpected error getting Cognito user {user_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to get user'})