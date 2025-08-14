import json
import boto3
import os
from botocore.exceptions import ClientError
from utils import lambda_response

s3_client = boto3.client('s3')

def list_session_files_admin(event, context):
    """List uploaded files for a session (admin access - no CSRF required)"""
    try:
        session_id = event['pathParameters']['sessionId']
        if not session_id or not session_id.strip():
            return lambda_response(400, {'error': 'Session ID is required'})
        bucket_name = os.environ.get('WEBSITE_BUCKET')
        
        if not bucket_name:
            return lambda_response(500, {'error': 'S3 bucket not configured'})
        
        # List objects in the session's upload folder
        prefix = f"uploads/{session_id}/"
        
        try:
            response = s3_client.list_objects_v2(
                Bucket=bucket_name,
                Prefix=prefix
            )
            
            files = []
            if 'Contents' in response:
                for obj in response['Contents']:
                    # Skip the folder itself
                    if obj['Key'] == prefix:
                        continue
                        
                    # Extract encoded filename from S3 key
                    encoded_filename = obj['Key'].split('/')[-1]
                    
                    # Get content type
                    content_type = 'application/octet-stream'
                    try:
                        head_response = s3_client.head_object(
                            Bucket=bucket_name,
                            Key=obj['Key']
                        )
                        content_type = head_response.get('ContentType', 'application/octet-stream')
                    except Exception as e:
                        print(f"Warning: Failed to get content type for {obj['Key']}: {str(e)}")
                        # Continue with default content type
                    
                    # Generate relative URL for CloudFront access
                    file_url = f"/{obj['Key']}"
                    
                    files.append({
                        'fileKey': obj['Key'],
                        'fileName': encoded_filename,
                        'encodedFileName': encoded_filename,
                        'fileSize': obj['Size'],
                        'uploadedAt': obj['LastModified'].isoformat(),
                        'contentType': content_type,
                        'fileUrl': file_url
                    })
            
            return lambda_response(200, {'files': files})
            
        except ClientError as e:
            error_code = e.response['Error']['Code']
            print(f"S3 ClientError listing files for session {session_id}: {error_code} - {str(e)}")
            if error_code in ['NoSuchBucket', 'AccessDenied']:
                return lambda_response(500, {'error': f'S3 configuration error: {error_code}'})
            return lambda_response(200, {'files': []})
        except Exception as e:
            print(f"Unexpected error listing files for session {session_id}: {str(e)}")
            return lambda_response(200, {'files': []})
        
    except KeyError as e:
        print(f"Missing required parameter in list_session_files_admin: {str(e)}")
        return lambda_response(400, {'error': 'Missing required parameters'})
    except Exception as e:
        print(f"Critical error in list_session_files_admin: {str(e)}")
        return lambda_response(500, {'error': 'Failed to list files'})

def delete_session_file_admin(event, context):
    """Delete an uploaded file (admin access - no CSRF required)"""
    try:
        session_id = event['pathParameters']['sessionId']
        file_key = event['pathParameters']['fileKey']
        
        if not session_id or not session_id.strip():
            return lambda_response(400, {'error': 'Session ID is required'})
        if not file_key or not file_key.strip():
            return lambda_response(400, {'error': 'File key is required'})
        bucket_name = os.environ.get('WEBSITE_BUCKET')
        
        # Get client IP address for admin access logging
        client_ip = event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'Unknown')
        user_agent = event.get('headers', {}).get('User-Agent', 'Unknown')
        
        print(f"Admin file deletion request - Session ID: {session_id}, File Key: {file_key}, Client IP: {client_ip}, User-Agent: {user_agent}")
        
        if not bucket_name:
            return lambda_response(500, {'error': 'S3 bucket not configured'})
        
        # URL decode the file key
        import urllib.parse
        decoded_file_key = urllib.parse.unquote(file_key)
        
        # Handle case where fileKey might not include the full path
        if not decoded_file_key.startswith("uploads/"):
            decoded_file_key = f"uploads/{session_id}/{decoded_file_key}"
        
        # Verify the file belongs to the session
        expected_prefix = f"uploads/{session_id}/"
        if not decoded_file_key.startswith(expected_prefix):
            return lambda_response(403, {'error': 'Access denied - Invalid file path'})
        
        # Delete the file
        s3_client.delete_object(
            Bucket=bucket_name,
            Key=decoded_file_key
        )
        
        print(f"Admin file deleted successfully - Session ID: {session_id}, File: {decoded_file_key}, Client IP: {client_ip}")
        return lambda_response(200, {'message': 'File deleted successfully'})
        
    except ClientError as e:
        error_code = e.response['Error']['Code']
        print(f"S3 ClientError deleting file {file_key} from session {session_id}: {error_code} - {str(e)}")
        if error_code == 'NoSuchKey':
            return lambda_response(404, {'error': 'File not found'})
        elif error_code in ['NoSuchBucket', 'AccessDenied']:
            return lambda_response(500, {'error': f'S3 configuration error: {error_code}'})
        return lambda_response(500, {'error': f'S3 error: {error_code}'})
    except KeyError as e:
        print(f"Missing required parameter in delete_session_file_admin: {str(e)}")
        return lambda_response(400, {'error': 'Missing required parameters'})
    except Exception as e:
        print(f"Unexpected error deleting file {file_key} from session {session_id}: {str(e)}")
        return lambda_response(500, {'error': 'Failed to delete file'})