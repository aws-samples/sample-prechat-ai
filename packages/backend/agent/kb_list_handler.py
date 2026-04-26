"""
Knowledge Base List API Handler

Bedrock Knowledge Base 목록을 조회하는 API입니다. Cognito 인증 필요.

Endpoints:
  GET /api/admin/knowledge-bases - KB 목록 조회
"""

import os

import boto3

from utils import lambda_response

bedrock_region = os.environ.get(
    'BEDROCK_REGION',
    os.environ.get('AWS_REGION', 'ap-northeast-2'),
)
bedrock_agent_client = boto3.client(
    'bedrock-agent',
    region_name=bedrock_region,
)


def list_knowledge_bases(event, context):
    """GET /api/admin/knowledge-bases

    Bedrock Knowledge Base 목록을 조회합니다.
    knowledgeBaseId, name, status 필드만 반환합니다.
    페이지네이션을 처리하여 전체 목록을 반환합니다.
    """
    try:
        all_summaries = []
        next_token = None

        while True:
            kwargs = {}
            if next_token:
                kwargs['nextToken'] = next_token

            response = bedrock_agent_client.list_knowledge_bases(
                **kwargs
            )

            summaries = response.get(
                'knowledgeBaseSummaries', []
            )
            all_summaries.extend(summaries)

            next_token = response.get('nextToken')
            if not next_token:
                break

        kbs = [
            {
                'knowledgeBaseId': kb['knowledgeBaseId'],
                'name': kb['name'],
                'status': kb['status'],
            }
            for kb in all_summaries
        ]

        return lambda_response(
            200, {'knowledgeBases': kbs}
        )
    except Exception as e:
        print(f"Failed to list knowledge bases: {str(e)}")
        return lambda_response(
            500,
            {'error': 'Failed to list knowledge bases'},
        )
