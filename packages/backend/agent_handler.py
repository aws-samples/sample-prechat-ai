import json
import boto3
import uuid
import os
from datetime import datetime
from utils import lambda_response, parse_body

bedrock_region = os.environ.get('BEDROCK_REGION', 'ap-northeast-2')
bedrock_agent = boto3.client('bedrock-agent', region_name=bedrock_region)

def list_agents(event, context):
    """List all AgentCore agents"""
    try:
        response = bedrock_agent.list_agents()
        
        agents = []
        for agent in response.get('agentSummaries', []):
            # Get detailed agent info
            try:
                agent_detail = bedrock_agent.get_agent(agentId=agent['agentId'])
                agent_info = agent_detail['agent']
                
                # Extract memory configuration if available
                memory_config = agent_info.get('memoryConfiguration', {})
                memory_storage_days = 30  # Default value
                if memory_config and 'storageDays' in memory_config:
                    memory_storage_days = memory_config['storageDays']
                
                agents.append({
                    'agentId': agent['agentId'],
                    'agentName': agent['agentName'],
                    'agentStatus': agent['agentStatus'],
                    'foundationModel': agent_info.get('foundationModel', ''),
                    'instruction': agent_info.get('instruction', ''),
                    'memoryStorageDays': memory_storage_days,
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
                    'memoryStorageDays': 30,  # Default when details unavailable
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
    """Create a new AgentCore agent"""
    try:
        body = parse_body(event)
        agent_name = body.get('agentName')
        foundation_model = body.get('foundationModel')
        instruction = body.get('instruction')
        
        if not all([agent_name, foundation_model, instruction]):
            return lambda_response(400, {'error': 'Missing required fields'})
        
        # Get AgentCore Agent Role ARN from environment variable
        role_arn = os.environ.get('BEDROCK_AGENT_ROLE_ARN')
        if not role_arn:
            return lambda_response(500, {'error': 'AgentCore Agent Role ARN not configured'})
        
        # Get memory configuration from request
        memory_storage_days = body.get('memoryStorageDays', 30)  # Default to 30 days
        
        # Create the agent with memory configuration
        response = bedrock_agent.create_agent(
            agentName=agent_name,
            foundationModel=foundation_model,
            instruction=instruction,
            idleSessionTTLInSeconds=1800,  # 30 minutes
            agentResourceRoleArn=role_arn,
            memoryConfiguration={
                'enabledMemoryTypes': ['SESSION_SUMMARY'],
                'storageDays': memory_storage_days
            }
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
    """Delete an AgentCore agent"""
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
    """Prepare an AgentCore agent for use"""
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
    """Get a specific AgentCore agent"""
    try:
        agent_id = event['pathParameters']['agentId']
        
        # Get the agent details
        response = bedrock_agent.get_agent(agentId=agent_id)
        agent = response['agent']
        
        # Extract memory configuration if available
        memory_config = agent.get('memoryConfiguration', {})
        memory_storage_days = 30  # Default value
        if memory_config and 'storageDays' in memory_config:
            memory_storage_days = memory_config['storageDays']
        
        return lambda_response(200, {
            'agentId': agent['agentId'],
            'agentName': agent['agentName'],
            'agentStatus': agent['agentStatus'],
            'foundationModel': agent.get('foundationModel', ''),
            'instruction': agent.get('instruction', ''),
            'memoryStorageDays': memory_storage_days,
            'createdAt': agent['createdAt'].isoformat(),
            'updatedAt': agent['updatedAt'].isoformat(),
            'agentArn': agent['agentArn']
        })
    except Exception as e:
        print(f"Error getting agent: {str(e)}")
        return lambda_response(500, {'error': f'Failed to get agent: {str(e)}'})

def update_agent(event, context):
    """Update an AgentCore agent

    PUT /api/admin/agents/{agentId}

    Request Body:
      - foundationModel (str, required): Foundation model ID
      - instruction (str, required): Agent instruction

    Note: Memory configuration is managed at deployment time by system admin.
    """
    try:
        agent_id = event['pathParameters']['agentId']

        body = parse_body(event)
        foundation_model = body.get('foundationModel')
        instruction = body.get('instruction')

        if not all([foundation_model, instruction]):
            return lambda_response(400, {'error': 'Missing required fields: foundationModel, instruction'})

        # Get current agent info to preserve existing settings
        get_response = bedrock_agent.get_agent(agentId=agent_id)
        current_agent = get_response['agent']

        role_arn = os.environ.get('BEDROCK_AGENT_ROLE_ARN')
        if not role_arn:
            return lambda_response(500, {'error': 'AgentCore Agent Role ARN not configured'})

        # Preserve existing memory configuration (managed at deployment time)
        update_kwargs = {
            'agentId': agent_id,
            'agentName': current_agent['agentName'],
            'foundationModel': foundation_model,
            'instruction': instruction,
            'agentResourceRoleArn': role_arn,
        }

        # Preserve memory config if it exists
        existing_memory = current_agent.get('memoryConfiguration')
        if existing_memory:
            update_kwargs['memoryConfiguration'] = existing_memory

        response = bedrock_agent.update_agent(**update_kwargs)
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
        return lambda_response(500, {'error': f'Failed to update agent: {str(e)}'})

