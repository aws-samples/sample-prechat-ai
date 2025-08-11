import json
import boto3
import os
from utils import lambda_response

s3_client = boto3.client('s3')

def list_session_files_admin(event, context):
    """List uploaded files for a session (admin access - no CSRF required)"""
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
                    encoded_filename = obj['Key'].split('/')[-1]
                    
                    # Get content type
                    content_type = 'application/octet-stream'
                    try:
                        head_response = s3_client.head_object(
                            Bucket=bucket_name,
                            Key=obj['Key']
                        )
                        content_type = head_response.get('ContentType', 'application/octet-stream')
                    except Exception:
                        pass
                    
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
            
        except Exception as e:
            print(f"Error listing files: {str(e)}")
            return lambda_response(200, {'files': []})
        
    except Exception as e:
        print(f"Error in list_session_files_admin: {str(e)}")
        return lambda_response(500, {'error': 'Failed to list files'})

def delete_session_file_admin(event, context):
    """Delete an uploaded file (admin access - no CSRF required)"""
    try:
        session_id = event['pathParameters']['sessionId']
        file_key = event['pathParameters']['fileKey']
        bucket_name = os.environ.get('WEBSITE_BUCKET')
        
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
        
        return lambda_response(200, {'message': 'File deleted successfully'})
        
    except Exception as e:
        print(f"Error deleting file: {str(e)}")
        return lambda_response(500, {'error': 'Failed to delete file'})