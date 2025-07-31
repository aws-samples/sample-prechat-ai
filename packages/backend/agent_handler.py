import json
import boto3
import uuid
from datetime import datetime
from utils import lambda_response, parse_body

bedrock_agent = boto3.client('bedrock-agent', region_name='ap-northeast-2')

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
                
                agents.append({
                    'agentId': agent['agentId'],
                    'agentName': agent['agentName'],
                    'agentStatus': agent['agentStatus'],
                    'foundationModel': agent_info.get('foundationModel', ''),
                    'instruction': agent_info.get('instruction', ''),
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
        
        # Get account ID from context
        account_id = context.invoked_function_arn.split(':')[4]
        role_arn = f"arn:aws:iam::{account_id}:role/AmazonBedrockExecutionRoleForAgents_bedrock-agent-role"
        
        # Create the agent
        response = bedrock_agent.create_agent(
            agentName=agent_name,
            foundationModel=foundation_model,
            instruction=instruction,
            idleSessionTTLInSeconds=1800,  # 30 minutes
            agentResourceRoleArn=role_arn
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
        
        return lambda_response(200, {
            'agentId': agent['agentId'],
            'agentName': agent['agentName'],
            'agentStatus': agent['agentStatus'],
            'foundationModel': agent.get('foundationModel', ''),
            'instruction': agent.get('instruction', ''),
            'createdAt': agent['createdAt'].isoformat(),
            'updatedAt': agent['updatedAt'].isoformat(),
            'agentArn': agent['agentArn']
        })
    except Exception as e:
        print(f"Error getting agent: {str(e)}")
        return lambda_response(500, {'error': f'Failed to get agent: {str(e)}'})

def update_agent(event, context):
    """Update a Bedrock agent"""
    try:
        agent_id = event['pathParameters']['agentId']
        body = parse_body(event)
        
        foundation_model = body.get('foundationModel')
        instruction = body.get('instruction')
        
        if not all([foundation_model, instruction]):
            return lambda_response(400, {'error': 'Missing required fields'})
        
        # Update the agent (agent name cannot be changed)
        response = bedrock_agent.update_agent(
            agentId=agent_id,
            foundationModel=foundation_model,
            instruction=instruction
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
        return lambda_response(500, {'error': f'Failed to update agent: {str(e)}'})