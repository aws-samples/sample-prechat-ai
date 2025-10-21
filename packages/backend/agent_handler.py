import json
import boto3
import uuid
import os
from datetime import datetime
from utils import lambda_response, parse_body

bedrock_region = os.environ.get('BEDROCK_REGION', 'ap-northeast-2')
bedrock_agent = boto3.client('bedrock-agent', region_name=bedrock_region)

def list_agents(event, context):
    """List all Bedrock agents"""
    try:
        response = bedrock_agent.list_agents()
        
        agents = []
        for agent in response.get('agentSummaries', []):
            # Get detailed agent info
            try:
                agent_detail = bedrock_agent.get_agent(agentId=agent['agentId'])
                agent_info = agent_detail['agent']
                
<<<<<<< HEAD
=======
                # Extract memory configuration if available
                memory_config = agent_info.get('memoryConfiguration', {})
                memory_storage_days = 30  # Default value
                if memory_config and 'storageDays' in memory_config:
                    memory_storage_days = memory_config['storageDays']
                
>>>>>>> dev
                agents.append({
                    'agentId': agent['agentId'],
                    'agentName': agent['agentName'],
                    'agentStatus': agent['agentStatus'],
                    'foundationModel': agent_info.get('foundationModel', ''),
                    'instruction': agent_info.get('instruction', ''),
<<<<<<< HEAD
=======
                    'memoryStorageDays': memory_storage_days,
>>>>>>> dev
                    'createdAt': agent['createdAt'].isoformat() if 'createdAt' in agent else '',
                    'updatedAt': agent['updatedAt'].isoformat() if 'updatedAt' in agent else '',
                    'agentVersion': agent.get('latestAgentVersion', ''),
                    'agentArn': agent.get('agentArn', '')
                })
            except Exception as detail_error:
                # If we can't get details, use summary info
                agents.append({
                    'agentId': agent['agentId'],
                    'agentName': agent['agentName'],
                    'agentStatus': agent['agentStatus'],
                    'foundationModel': '',
                    'instruction': agent.get('description', ''),
<<<<<<< HEAD
=======
                    'memoryStorageDays': 30,  # Default when details unavailable
>>>>>>> dev
                    'createdAt': agent['createdAt'].isoformat() if 'createdAt' in agent else '',
                    'updatedAt': agent['updatedAt'].isoformat() if 'updatedAt' in agent else '',
                    'agentVersion': agent.get('latestAgentVersion', ''),
                    'agentArn': agent.get('agentArn', '')
                })
        
        return lambda_response(200, {'agents': agents})
    except Exception as e:
        print(f"Error listing agents: {str(e)}")
        return lambda_response(500, {'error': 'Failed to list agents'})

def create_agent(event, context):
    """Create a new Bedrock agent"""
    try:
        body = parse_body(event)
        agent_name = body.get('agentName')
        foundation_model = body.get('foundationModel')
        instruction = body.get('instruction')
        
        if not all([agent_name, foundation_model, instruction]):
            return lambda_response(400, {'error': 'Missing required fields'})
        
        # Get Bedrock Agent Role ARN from environment variable
        role_arn = os.environ.get('BEDROCK_AGENT_ROLE_ARN')
        if not role_arn:
            return lambda_response(500, {'error': 'Bedrock Agent Role ARN not configured'})
        
<<<<<<< HEAD
        # Create the agent
=======
        # Get memory configuration from request
        memory_storage_days = body.get('memoryStorageDays', 30)  # Default to 30 days
        
        # Create the agent with memory configuration
>>>>>>> dev
        response = bedrock_agent.create_agent(
            agentName=agent_name,
            foundationModel=foundation_model,
            instruction=instruction,
            idleSessionTTLInSeconds=1800,  # 30 minutes
<<<<<<< HEAD
            agentResourceRoleArn=role_arn
=======
            agentResourceRoleArn=role_arn,
            memoryConfiguration={
                'enabledMemoryTypes': ['SESSION_SUMMARY'],
                'storageDays': memory_storage_days
            }
>>>>>>> dev
        )
        
        agent = response['agent']
        
        return lambda_response(200, {
            'agentId': agent['agentId'],
            'agentName': agent['agentName'],
            'agentStatus': agent['agentStatus'],
            'foundationModel': agent['foundationModel'],
            'instruction': agent['instruction'],
            'createdAt': agent['createdAt'].isoformat(),
            'updatedAt': agent['updatedAt'].isoformat(),
            'agentArn': agent['agentArn']
        })
    except Exception as e:
        print(f"Error creating agent: {str(e)}")
        return lambda_response(500, {'error': f'Failed to create agent: {str(e)}'})

def delete_agent(event, context):
    """Delete a Bedrock agent"""
    try:
        agent_id = event['pathParameters']['agentId']
        
        # Delete the agent
        bedrock_agent.delete_agent(
            agentId=agent_id,
            skipResourceInUseCheck=True
        )
        
        return lambda_response(200, {'message': 'Agent deleted successfully'})
    except Exception as e:
        print(f"Error deleting agent: {str(e)}")
        return lambda_response(500, {'error': f'Failed to delete agent: {str(e)}'})

def prepare_agent(event, context):
    """Prepare a Bedrock agent for use"""
    try:
        agent_id = event['pathParameters']['agentId']
        
        # Prepare the agent
        response = bedrock_agent.prepare_agent(agentId=agent_id)
        
        return lambda_response(200, {
            'agentId': response['agentId'],
            'agentStatus': response['agentStatus'],
            'preparedAt': response['preparedAt'].isoformat()
        })
    except Exception as e:
        print(f"Error preparing agent: {str(e)}")
        return lambda_response(500, {'error': f'Failed to prepare agent: {str(e)}'})

def get_agent(event, context):
    """Get a specific Bedrock agent"""
    try:
        agent_id = event['pathParameters']['agentId']
        
        # Get the agent details
        response = bedrock_agent.get_agent(agentId=agent_id)
        agent = response['agent']
        
<<<<<<< HEAD
=======
        # Extract memory configuration if available
        memory_config = agent.get('memoryConfiguration', {})
        memory_storage_days = 30  # Default value
        if memory_config and 'storageDays' in memory_config:
            memory_storage_days = memory_config['storageDays']
        
>>>>>>> dev
        return lambda_response(200, {
            'agentId': agent['agentId'],
            'agentName': agent['agentName'],
            'agentStatus': agent['agentStatus'],
            'foundationModel': agent.get('foundationModel', ''),
            'instruction': agent.get('instruction', ''),
<<<<<<< HEAD
=======
            'memoryStorageDays': memory_storage_days,
>>>>>>> dev
            'createdAt': agent['createdAt'].isoformat(),
            'updatedAt': agent['updatedAt'].isoformat(),
            'agentArn': agent['agentArn']
        })
    except Exception as e:
        print(f"Error getting agent: {str(e)}")
        return lambda_response(500, {'error': f'Failed to get agent: {str(e)}'})

def update_agent(event, context):
<<<<<<< HEAD
    """Update a Bedrock agent"""
    try:
        agent_id = event['pathParameters']['agentId']
        body = parse_body(event)
        
        foundation_model = body.get('foundationModel')
        instruction = body.get('instruction')
=======
    """Update a Bedrock agent or enable memory"""
    try:
        agent_id = event['pathParameters']['agentId']
        http_method = event['httpMethod']
        path = event['path']
        
        print(f"Update agent called - Method: {http_method}, Path: {path}, AgentId: {agent_id}")
        
        # Check if this is a memory-only update request
        if http_method == 'POST' and path.endswith('/enable-memory'):
            print(f"Routing to enable_agent_memory_only for agent: {agent_id}")
            return enable_agent_memory_only(agent_id, event)
        
        # Regular agent update
        body = parse_body(event)
        foundation_model = body.get('foundationModel')
        instruction = body.get('instruction')
        memory_storage_days = body.get('memoryStorageDays', 30)  # Default to 30 days
>>>>>>> dev
        
        if not all([foundation_model, instruction]):
            return lambda_response(400, {'error': 'Missing required fields'})
        
<<<<<<< HEAD
        # Update the agent (agent name cannot be changed)
        response = bedrock_agent.update_agent(
            agentId=agent_id,
            foundationModel=foundation_model,
            instruction=instruction
=======
        # Get current agent info to get the agent name and role ARN
        get_response = bedrock_agent.get_agent(agentId=agent_id)
        current_agent = get_response['agent']
        
        # Get the agent resource role ARN from environment
        role_arn = os.environ.get('BEDROCK_AGENT_ROLE_ARN')
        if not role_arn:
            return lambda_response(500, {'error': 'Bedrock Agent Role ARN not configured'})
        
        # Update the agent with memory configuration
        response = bedrock_agent.update_agent(
            agentId=agent_id,
            agentName=current_agent['agentName'],  # Required parameter
            foundationModel=foundation_model,
            instruction=instruction,
            agentResourceRoleArn=role_arn,  # Required parameter
            memoryConfiguration={
                'enabledMemoryTypes': ['SESSION_SUMMARY'],
                'storageDays': memory_storage_days
            }
>>>>>>> dev
        )
        
        agent = response['agent']
        
        return lambda_response(200, {
            'agentId': agent['agentId'],
            'agentName': agent['agentName'],
            'agentStatus': agent['agentStatus'],
            'foundationModel': agent['foundationModel'],
            'instruction': agent['instruction'],
            'createdAt': agent['createdAt'].isoformat(),
            'updatedAt': agent['updatedAt'].isoformat(),
            'agentArn': agent['agentArn']
        })
    except Exception as e:
        print(f"Error updating agent: {str(e)}")
<<<<<<< HEAD
        return lambda_response(500, {'error': f'Failed to update agent: {str(e)}'})
=======
        return lambda_response(500, {'error': f'Failed to update agent: {str(e)}'})

def enable_agent_memory_only(agent_id: str, event):
    """Enable memory for an existing Bedrock agent without changing other settings"""
    try:
        print(f"Starting memory enablement for agent: {agent_id}")
        
        # Parse request body to get storage days
        body = parse_body(event)
        memory_storage_days = body.get('memoryStorageDays', 30)  # Default to 30 days
        
        print(f"Memory storage days requested: {memory_storage_days}")
        
        # Validate storage days
        if not isinstance(memory_storage_days, int) or memory_storage_days < 1 or memory_storage_days > 365:
            print(f"Invalid storage days: {memory_storage_days}")
            return lambda_response(400, {'error': 'Memory storage days must be between 1 and 365'})
        
        # Get current agent configuration
        print(f"Getting current agent configuration for: {agent_id}")
        get_response = bedrock_agent.get_agent(agentId=agent_id)
        agent = get_response['agent']
        
        print(f"Current agent status: {agent.get('agentStatus')}")
        print(f"Current foundation model: {agent.get('foundationModel')}")
        
        # Get the agent resource role ARN from environment
        role_arn = os.environ.get('BEDROCK_AGENT_ROLE_ARN')
        if not role_arn:
            print("BEDROCK_AGENT_ROLE_ARN environment variable not set")
            return lambda_response(500, {'error': 'Bedrock Agent Role ARN not configured'})
        
        # Update the agent with memory configuration while keeping existing settings
        print(f"Updating agent with memory configuration...")
        response = bedrock_agent.update_agent(
            agentId=agent_id,
            agentName=agent['agentName'],  # Required parameter
            foundationModel=agent['foundationModel'],
            instruction=agent['instruction'],
            agentResourceRoleArn=role_arn,  # Required parameter
            memoryConfiguration={
                'enabledMemoryTypes': ['SESSION_SUMMARY'],
                'storageDays': memory_storage_days
            }
        )
        
        updated_agent = response['agent']
        print(f"Memory enabled successfully for agent: {agent_id}")
        
        return lambda_response(200, {
            'message': 'Memory enabled successfully',
            'agentId': updated_agent['agentId'],
            'agentName': updated_agent['agentName'],
            'agentStatus': updated_agent['agentStatus'],
            'memoryEnabled': True,
            'memoryStorageDays': memory_storage_days
        })
    except Exception as e:
        print(f"Error enabling memory for agent {agent_id}: {str(e)}")
        print(f"Exception type: {type(e).__name__}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        return lambda_response(500, {'error': f'Failed to enable memory: {str(e)}'})
>>>>>>> dev
