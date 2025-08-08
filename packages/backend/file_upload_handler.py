import json
import boto3
import os
from datetime import datetime, timedelta
from utils import lambda_response, parse_body, verify_origin
import uuid

s3_client = boto3.client('s3')

def generate_presigned_url(event, context):
    """Generate presigned URL for file upload to S3"""
    try:
        # CSRF Protection - Verify request origin
        if not verify_origin(event):
            return lambda_response(403, {'error': 'Invalid request origin - CSRF protection'})
            
        # Parse request body
        body = parse_body(event)
        session_id = event['pathParameters']['sessionId']
        
        # Get file info from request
        file_name = body.get('fileName')
        file_type = body.get('fileType')
        file_size = body.get('fileSize', 0)
        
        if not file_name or not file_type:
            return lambda_response(400, {'error': 'fileName and fileType are required'})
        
        # Check file size limit (50MB)
        max_size = 50 * 1024 * 1024  # 50MB in bytes
        if file_size > max_size:
            return lambda_response(400, {'error': 'File size exceeds 50MB limit'})
        
        # Validate file type (allow common document and image formats)
        allowed_types = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
            'application/pdf', 'application/msword', 
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'text/plain', 'text/csv'
        ]
        
        if file_type not in allowed_types:
            return lambda_response(400, {'error': 'File type not allowed'})
        
        # Generate S3 key with base64 encoded filename
        import base64
        encoded_filename = base64.b64encode(file_name.encode('utf-8')).decode('ascii')
        s3_key = f"uploads/{session_id}/{encoded_filename}"
        
        # Get bucket name from environment
        bucket_name = os.environ.get('WEBSITE_BUCKET')
        if not bucket_name:
            return lambda_response(500, {'error': 'S3 bucket not configured'})
        

        
        # Generate presigned URL for PUT operation
        # Client will set metadata headers directly
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
                'Key': s3_key,
                'ContentType': file_type
            },
            ExpiresIn=3600  # 1 hour
        )
        
        return lambda_response(200, {
            'uploadUrl': presigned_url,
            'fileKey': s3_key,
            'fileName': file_name,
            'fileType': file_type,
            'fileSize': file_size
        })
        
    except Exception as e:
        import traceback
        print(f"Error generating presigned URL: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        print(f"Event: {json.dumps(event)}")
        print(f"Bucket name: {os.environ.get('WEBSITE_BUCKET')}")
        print(f"Session ID: {event.get('pathParameters', {}).get('sessionId')}")
        print(f"Body: {parse_body(event)}")
        return lambda_response(500, {'error': f'Failed to generate upload URL: {str(e)}'})


def list_session_files(event, context):
    """List uploaded files for a session"""
    try:
        session_id = event['pathParameters']['sessionId']
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
                    encoded_filename = obj['Key'].split('/')[-1]  # Get filename part from key
                    
                    # Get content type and infer from filename if needed
                    content_type = 'application/octet-stream'
                    try:
                        head_response = s3_client.head_object(
                            Bucket=bucket_name,
                            Key=obj['Key']
                        )
                        content_type = head_response.get('ContentType', 'application/octet-stream')
                        print(f"Debug - Raw ContentType from S3: {content_type}")
                        
                    except Exception as head_error:
                        print(f"Debug - Head object error: {head_error}")
                        # Continue with default content_type = 'application/octet-stream'
                    
                    # If content type is generic or head_object failed, infer from filename
                    if content_type == 'application/octet-stream':
                        import base64
                        try:
                            decoded_filename = base64.b64decode(encoded_filename).decode('utf-8').lower()
                            print(f"Debug - Inferring content type from filename: {decoded_filename}")
                            if decoded_filename.endswith(('.jpg', '.jpeg')):
                                content_type = 'image/jpeg'
                            elif decoded_filename.endswith('.png'):
                                content_type = 'image/png'
                            elif decoded_filename.endswith('.gif'):
                                content_type = 'image/gif'
                            elif decoded_filename.endswith('.webp'):
                                content_type = 'image/webp'
                            elif decoded_filename.endswith('.pdf'):
                                content_type = 'application/pdf'
                            print(f"Debug - Inferred content type: {content_type}")
                        except Exception as infer_error:
                            print(f"Debug - Failed to infer content type: {infer_error}")
                    
                    # Generate presigned URL for file access
                    file_url = s3_client.generate_presigned_url(
                        'get_object',
                        Params={
                            'Bucket': bucket_name,
                            'Key': obj['Key']
                        },
                        ExpiresIn=3600  # 1 hour
                    )
                    
                    files.append({
                        'fileKey': obj['Key'],
                        'fileName': encoded_filename,  # This is the base64 encoded filename
                        'encodedFileName': encoded_filename,  # Same as fileName for consistency
                        'fileSize': obj['Size'],
                        'uploadedAt': obj['LastModified'].isoformat(),
                        'contentType': content_type,
                        'fileUrl': file_url
                    })
            
            return lambda_response(200, {'files': files})
            
        except Exception as e:
            print(f"Error listing files: {str(e)}")
            return lambda_response(200, {'files': []})  # Return empty list if folder doesn't exist
        
    except Exception as e:
        print(f"Error in list_session_files: {str(e)}")
        return lambda_response(500, {'error': 'Failed to list files'})


def delete_session_file(event, context):
    """Delete an uploaded file"""
    try:
        # CSRF Protection - Verify request origin
        if not verify_origin(event):
            return lambda_response(403, {'error': 'Invalid request origin - CSRF protection'})
        
        session_id = event['pathParameters']['sessionId']
        file_key = event['pathParameters']['fileKey']
        bucket_name = os.environ.get('WEBSITE_BUCKET')
        
        print(f"Debug - Delete request - Session ID: {session_id}")
        print(f"Debug - Delete request - File Key (raw): {file_key}")
        
        if not bucket_name:
            return lambda_response(500, {'error': 'S3 bucket not configured'})
        
        # URL decode the file key in case it's encoded
        import urllib.parse
        decoded_file_key = urllib.parse.unquote(file_key)
        print(f"Debug - Delete request - File Key (decoded): {decoded_file_key}")
        
        # Handle case where fileKey might not include the full path
        # If it doesn't start with "uploads/", prepend the session path
        if not decoded_file_key.startswith("uploads/"):
            decoded_file_key = f"uploads/{session_id}/{decoded_file_key}"
            print(f"Debug - Delete request - File Key (with path): {decoded_file_key}")
        
        # Verify the file belongs to the session
        expected_prefix = f"uploads/{session_id}/"
        print(f"Debug - Delete request - Expected prefix: {expected_prefix}")
        print(f"Debug - Delete request - Key starts with prefix: {decoded_file_key.startswith(expected_prefix)}")
        
        if not decoded_file_key.startswith(expected_prefix):
            print(f"Debug - Access denied - File key '{decoded_file_key}' does not start with '{expected_prefix}'")
            return lambda_response(403, {'error': f'Access denied - Invalid file path'})
        
        # Delete the file
        print(f"Debug - Attempting to delete file: {decoded_file_key}")
        s3_client.delete_object(
            Bucket=bucket_name,
            Key=decoded_file_key
        )
        
        print(f"Debug - File deleted successfully: {decoded_file_key}")
        return lambda_response(200, {'message': 'File deleted successfully'})
        
    except Exception as e:
        print(f"Error deleting file: {str(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        return lambda_response(500, {'error': 'Failed to delete file'})


