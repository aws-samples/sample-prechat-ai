import json
import boto3
import os

def lambda_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        'body': json.dumps(body)
    }

def parse_body(event):
    return json.loads(event.get('body', '{}'))

cognito = boto3.client('cognito-idp')
USER_POOL_ID = os.environ.get('USER_POOL_ID')
CLIENT_ID = os.environ.get('CLIENT_ID')

def signup(event, context):
    body = parse_body(event)
    
    email = body.get('email', '')
    password = body.get('password', '')
    name = body.get('name', '')
    phone_number = body.get('phoneNumber', '')
    
    if not all([email, password, name, phone_number]):
        return lambda_response(400, {'error': 'Missing required fields: email, password, name, and phone number are required'})
    
    # Validate Amazon.com domain
    if not email.endswith('@amazon.com'):
        return lambda_response(400, {'error': 'Only @amazon.com email addresses are allowed'})
    
    # Validate phone number format (basic validation)
    if not phone_number.startswith('+'):
        return lambda_response(400, {'error': 'Phone number must be in international format (e.g., +1234567890)'})
    
    try:
        # Self-signup creates user in Registered (Unconfirmed) state
        response = cognito.sign_up(
            ClientId=CLIENT_ID,
            Username=email,
            Password=password,
            UserAttributes=[
                {'Name': 'email', 'Value': email},
                {'Name': 'name', 'Value': name},
                {'Name': 'phone_number', 'Value': phone_number}
            ]
        )
        
        return lambda_response(200, {
            'message': 'Registration successful. Please check your email and phone for confirmation codes.',
            'userId': response['UserSub'],
            'status': 'UNCONFIRMED'
        })
    except cognito.exceptions.UsernameExistsException:
        return lambda_response(400, {'error': 'User already exists'})
    except Exception as e:
        return lambda_response(500, {'error': str(e)})

def signin(event, context):
    body = parse_body(event)
    
    email = body.get('email', '')
    password = body.get('password', '')
    
    if not all([email, password]):
        return lambda_response(400, {'error': 'Missing email or password'})
    
    try:
        response = cognito.admin_initiate_auth(
            UserPoolId=USER_POOL_ID,
            ClientId=CLIENT_ID,
            AuthFlow='ADMIN_NO_SRP_AUTH',
            AuthParameters={
                'USERNAME': email,
                'PASSWORD': password
            }
        )
        
        
        return lambda_response(200, {
            'accessToken': response['AuthenticationResult']['AccessToken'],
            'idToken': response['AuthenticationResult']['IdToken'],
            'refreshToken': response['AuthenticationResult']['RefreshToken'],
            'expiresIn': response['AuthenticationResult']['ExpiresIn']
        })
    except cognito.exceptions.NotAuthorizedException:
        return lambda_response(401, {'error': 'Invalid credentials or account not approved'})
    except Exception as e:
        return lambda_response(500, {'error': str(e)})

def confirm_signup(event, context):
    body = parse_body(event)
    
    email = body.get('email', '')
    confirmation_code = body.get('confirmationCode', '')
    
    if not all([email, confirmation_code]):
        return lambda_response(400, {'error': 'Missing email or confirmation code'})
    
    try:
        cognito.confirm_sign_up(
            ClientId=CLIENT_ID,
            Username=email,
            ConfirmationCode=confirmation_code
        )
        
        return lambda_response(200, {
            'message': 'Account confirmed successfully. You can now sign in.',
            'status': 'CONFIRMED'
        })
    except cognito.exceptions.CodeMismatchException:
        return lambda_response(400, {'error': 'Invalid confirmation code'})
    except cognito.exceptions.ExpiredCodeException:
        return lambda_response(400, {'error': 'Confirmation code has expired'})
    except Exception as e:
        return lambda_response(500, {'error': str(e)})

def confirm_phone(event, context):
    """Confirm phone number with SMS code"""
    body = parse_body(event)
    
    email = body.get('email', '')
    confirmation_code = body.get('confirmationCode', '')
    
    if not all([email, confirmation_code]):
        return lambda_response(400, {'error': 'Missing email or confirmation code'})
    
    try:
        # Verify phone number attribute
        cognito.verify_user_attribute(
            AccessToken=body.get('accessToken', ''),
            AttributeName='phone_number',
            Code=confirmation_code
        )
        
        return lambda_response(200, {
            'message': 'Phone number confirmed successfully.',
            'status': 'PHONE_CONFIRMED'
        })
    except cognito.exceptions.CodeMismatchException:
        return lambda_response(400, {'error': 'Invalid confirmation code'})
    except cognito.exceptions.ExpiredCodeException:
        return lambda_response(400, {'error': 'Confirmation code has expired'})
    except Exception as e:
        return lambda_response(500, {'error': str(e)})

def verify_token(event, context):
    auth_header = event.get('headers', {}).get('Authorization', '')
    
    if not auth_header.startswith('Bearer '):
        return lambda_response(401, {'error': 'Missing or invalid token'})
    
    token = auth_header.replace('Bearer ', '')
    
    try:
        response = cognito.get_user(AccessToken=token)
        
        user_attributes = {attr['Name']: attr['Value'] for attr in response['UserAttributes']}
        
        return lambda_response(200, {
            'username': response['Username'],
            'email': user_attributes.get('email'),
            'name': user_attributes.get('name'),
            'phoneNumber': user_attributes.get('phone_number')
        })
    except Exception as e:
        return lambda_response(401, {'error': 'Invalid token'})