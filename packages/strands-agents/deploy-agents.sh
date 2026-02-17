#!/bin/bash
#
# PreChat Strands Agents 배포 스크립트
#
# 세 에이전트를 AgentCore Runtime에 배포하고,
# 산출된 Agent Runtime ARN을 SSM Parameter Store에 등록합니다.
# Lambda 함수들은 SSM 파라미터를 통해 에이전트 ARN을 참조합니다.
#
# 사용법:
#   ./deploy-agents.sh [AWS_PROFILE] [STAGE] [REGION] [BEDROCK_KB_ID]
#
# 예시:
#   ./deploy-agents.sh default dev ap-northeast-2
#   ./deploy-agents.sh default dev ap-northeast-2 ABCDEFGHIJ
#
# BEDROCK_KB_ID:
#   사전 생성된 Bedrock Knowledge Base의 ID입니다.
#   Consultation Agent와 Planning Agent가 유사 고객사례 검색에 사용합니다.
#   KB가 없으면 생략 가능하며, 해당 @tool은 "KB가 설정되지 않았습니다"를 반환합니다.
#
#   KB 생성 방법:
#     1. AWS Console > Amazon Bedrock > Knowledge bases > Create
#     2. S3에 고객 레퍼런스 문서 업로드
#     3. Data source 연결 및 Sync
#     4. 생성된 KB ID를 이 스크립트의 4번째 인자로 전달
#
# 사전 요구사항:
#   pip install bedrock-agentcore-starter-toolkit

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 파라미터 (deploy-full.sh와 동일한 기본값 유지)
PROFILE=${1:-default}
STAGE=${2:-dev}
REGION=${3:-ap-northeast-2}

# SSM 파라미터 경로 prefix
SSM_PREFIX="/prechat/${STAGE}/agents"

# Bedrock KB ID (선택 - 사전 생성된 Knowledge Base가 있는 경우)
BEDROCK_KB_ID=${4:-""}

echo "============================================"
echo "  PreChat Strands Agents 배포"
echo "============================================"
echo "  AWS Profile  : $PROFILE"
echo "  Stage        : $STAGE"
echo "  Region       : $REGION"
echo "  SSM Prefix   : $SSM_PREFIX"
echo "  Bedrock KB ID: ${BEDROCK_KB_ID:-"(없음 - KB RAG 비활성)"}"
echo "============================================"
echo ""

# KB ID를 SSM에 등록 (빈 값이라도 등록 - SAM의 resolve:ssm이 실패하지 않도록)
echo "📝 Registering Bedrock KB ID in SSM..."
aws ssm put-parameter \
    --name "${SSM_PREFIX}/bedrock-kb-id" \
    --value "${BEDROCK_KB_ID:-NONE}" \
    --type "String" \
    --overwrite \
    --region "${REGION}" \
    --profile "${PROFILE}" \
    --description "Bedrock Knowledge Base ID for PreChat agents (${STAGE}). NONE if not configured."
if [ -n "$BEDROCK_KB_ID" ]; then
    echo "✅ KB ID registered: ${BEDROCK_KB_ID}"
else
    echo "ℹ️  KB ID not provided - registered as NONE (KB RAG will be inactive)"
fi
echo ""

# 공통 함수: 에이전트 배포 → ARN 추출 → SSM 등록
deploy_agent() {
    local AGENT_DIR=$1
    local AGENT_ROLE=$2
    local SSM_KEY="${SSM_PREFIX}/${AGENT_ROLE}/runtime-arn"

    echo "──────────────────────────────────────────"
    echo "📦 Deploying ${AGENT_ROLE} agent..."
    echo "   Directory: ${AGENT_DIR}"
    echo "   SSM Key  : ${SSM_KEY}"
    echo "──────────────────────────────────────────"

    cd "${SCRIPT_DIR}/${AGENT_DIR}"

    # deploy_agent.py 실행 (stderr에 로그, stdout에 JSON 결과)
    # BEDROCK_KB_ID를 환경 변수로 전달 → AgentCore 런타임에서 agent.py가 참조
    DEPLOY_OUTPUT=$(AWS_PROFILE=$PROFILE AWS_DEFAULT_REGION=$REGION BEDROCK_KB_ID=$BEDROCK_KB_ID python deploy_agent.py 2>&1 | tee /dev/stderr | tail -1)

    # JSON에서 ARN 추출
    AGENT_ARN=$(echo "$DEPLOY_OUTPUT" | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    print(data.get('agent_runtime_arn', ''))
except:
    print('')
" 2>/dev/null)

    if [ -z "$AGENT_ARN" ]; then
        echo "⚠️  Warning: Could not extract ARN for ${AGENT_ROLE}. Skipping SSM registration."
        echo "   Raw output: ${DEPLOY_OUTPUT}"
        return 1
    fi

    echo ""
    echo "✅ ${AGENT_ROLE} agent deployed: ${AGENT_ARN}"

    # SSM Parameter Store에 ARN 등록
    echo "📝 Registering ARN in SSM: ${SSM_KEY}"
    aws ssm put-parameter \
        --name "${SSM_KEY}" \
        --value "${AGENT_ARN}" \
        --type "String" \
        --overwrite \
        --region "${REGION}" \
        --profile "${PROFILE}" \
        --description "PreChat ${AGENT_ROLE} agent runtime ARN (${STAGE})"

    echo "✅ SSM parameter registered: ${SSM_KEY}"
    echo ""

    cd "${SCRIPT_DIR}"
}

# ============================================
# 1. Consultation Agent (STM_ONLY)
# ============================================
deploy_agent "consultation-agent" "consultation"

# ============================================
# 2. Analysis Agent (NO_MEMORY)
# ============================================
deploy_agent "analysis-agent" "analysis"

# ============================================
# 3. Planning Agent (NO_MEMORY)
# ============================================
deploy_agent "planning-agent" "planning"

# ============================================
# 결과 요약
# ============================================
echo ""
echo "============================================"
echo "  배포 완료 - SSM 파라미터 확인"
echo "============================================"

aws ssm get-parameters-by-path \
    --path "${SSM_PREFIX}" \
    --recursive \
    --region "${REGION}" \
    --profile "${PROFILE}" \
    --query 'Parameters[].{Name:Name,Value:Value}' \
    --output table 2>/dev/null || echo "(SSM 조회 실패 - 권한을 확인하세요)"

echo ""
echo "============================================"
echo "  ✅ 모든 에이전트 배포 완료!"
echo "============================================"
echo ""
echo "Lambda 함수에서 에이전트를 사용하려면:"
echo "  환경 변수에 SSM 파라미터 경로를 설정하세요."
echo ""
echo "  CONSULTATION_AGENT_ARN_SSM: ${SSM_PREFIX}/consultation/runtime-arn"
echo "  ANALYSIS_AGENT_ARN_SSM    : ${SSM_PREFIX}/analysis/runtime-arn"
echo "  PLANNING_AGENT_ARN_SSM    : ${SSM_PREFIX}/planning/runtime-arn"
echo ""
