#!/bin/bash
#
# PreChat Strands Agents 배포 스크립트
#
# 두 에이전트를 AgentCore Runtime에 배포하고,
# 산출된 Agent Runtime ARN을 SSM Parameter Store에 등록합니다.
# Lambda 함수들은 SSM 파라미터를 통해 에이전트 ARN을 참조합니다.
#
# Knowledge Base는 AgentConfig의 retrieve 도구 tool_attributes.kb_id로
# 런타임에 주입되므로, 배포 시 KB ID 기입이 필요하지 않습니다.
#
# 사용법:
#   ./deploy-agents.sh [AWS_PROFILE] [STAGE] [REGION]
#
# 예시:
#   ./deploy-agents.sh default dev ap-northeast-2
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

echo "============================================"
echo "  PreChat Strands Agents 배포"
echo "============================================"
echo "  AWS Profile  : $PROFILE"
echo "  Stage        : $STAGE"
echo "  Region       : $REGION"
echo "  SSM Prefix   : $SSM_PREFIX"
echo "============================================"
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

    # deploy_agent.py 실행 (STAGE만 컨테이너 환경변수로 주입)
    DEPLOY_OUTPUT=$(AWS_PROFILE=$PROFILE AWS_DEFAULT_REGION=$REGION STAGE=$STAGE python deploy_agent.py 2>&1 | tee /dev/stderr | tail -1)

    # JSON에서 ARN 추출
    AGENT_ARN=$(echo "$DEPLOY_OUTPUT" | python3 -c "
import sys, json
try:
    data = json.loads(sys.stdin.read())
    arn = data.get('agent_runtime_arn', '')
    print(arn)
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

    # SSM Parameter Store에 ARN만 등록
    echo "📝 Registering ARN in SSM: ${SSM_KEY}"
    aws ssm put-parameter \
        --name "${SSM_KEY}" \
        --value "${AGENT_ARN}" \
        --type "String" \
        --overwrite \
        --region "${REGION}" \
        --profile "${PROFILE}" \
        --description "PreChat ${AGENT_ROLE} agent runtime ARN (${STAGE})"

    echo "✅ SSM parameter registered: ${SSM_KEY} = ${AGENT_ARN}"
    echo ""

    cd "${SCRIPT_DIR}"
}

# ============================================
# 1. Consultation Agent (STM_ONLY, KB는 AgentConfig에서 런타임 주입)
# ============================================
deploy_agent "consultation-agent" "consultation"

# ============================================
# 2. Summary Agent (NO_MEMORY)
# ============================================
deploy_agent "summary-agent" "summary"

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
echo "✅ 모든 에이전트 배포 완료!"
echo ""
