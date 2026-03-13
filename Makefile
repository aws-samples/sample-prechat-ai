# ============================================================
# PreChat Makefile - 변경 파일 기반 선택적 배포
# ============================================================
# 사용법:
#   make deploy                    # git diff 기반 변경분만 배포
#   make deploy-all                # 전체 배포 (기존 deploy-full.sh 동일)
#   make deploy-backend            # SAM 백엔드만
#   make deploy-website            # 프론트엔드만
#   make deploy-agents             # 변경된 Strands Agents만
#   make deploy-agents-all         # 전체 Strands Agents
#   make deploy-agent-consultation # 개별 에이전트
#   make deploy-agent-summary
#   make deploy-agent-planning
#   make deploy-agent-ship
#   make plan                      # 배포 계획만 출력 (dry-run)
# ============================================================

# 설정 (환경변수로 오버라이드 가능)
PROFILE        ?= default
STAGE          ?= dev
REGION         ?= ap-northeast-2
BEDROCK_REGION ?= $(REGION)
STACK_NAME     ?= mte-prechat
BEDROCK_KB_ID  ?=

# diff 기준 (기본: 마지막 커밋 대비 워킹트리)
DIFF_BASE      ?= HEAD

# ============================================================
# 변경 감지
# ============================================================
CHANGED_FILES := $(shell git diff --name-only $(DIFF_BASE) 2>/dev/null)

HAS_BACKEND_SHARED := $(findstring packages/backend/shared,$(CHANGED_FILES))
HAS_BACKEND_DOMAIN := $(filter packages/backend/%,$(CHANGED_FILES))
HAS_TEMPLATE       := $(findstring template.yaml,$(CHANGED_FILES))
HAS_WEBSITE        := $(filter packages/web-app/%,$(CHANGED_FILES))
HAS_AGENT_CONSULT  := $(filter packages/strands-agents/consultation-agent/%,$(CHANGED_FILES))
HAS_AGENT_SUMMARY  := $(filter packages/strands-agents/summary-agent/%,$(CHANGED_FILES))
HAS_AGENT_PLANNING := $(filter packages/strands-agents/planning-agent/%,$(CHANGED_FILES))
HAS_AGENT_SHIP     := $(filter packages/strands-agents/ship-agent/%,$(CHANGED_FILES))
HAS_ANY_AGENT      := $(or $(HAS_AGENT_CONSULT),$(HAS_AGENT_SUMMARY),$(HAS_AGENT_PLANNING),$(HAS_AGENT_SHIP))

NEEDS_SAM    := $(or $(HAS_BACKEND_DOMAIN),$(HAS_TEMPLATE))
NEEDS_WEB    := $(HAS_WEBSITE)
NEEDS_AGENTS := $(HAS_ANY_AGENT)

.PHONY: deploy plan deploy-all deploy-backend deploy-website \
        deploy-agents deploy-agents-all \
        deploy-agent-consultation deploy-agent-summary \
        deploy-agent-planning deploy-agent-ship \
        build-backend build-website install info

# ============================================================
# 정보 출력
# ============================================================
info:
	@echo "══════════════════════════════════════════"
	@echo "  PreChat 배포 ($(STAGE))"
	@echo "══════════════════════════════════════════"
	@echo "  Profile : $(PROFILE)"
	@echo "  Region  : $(REGION)"
	@echo "  Bedrock : $(BEDROCK_REGION)"
	@echo "  Stack   : $(STACK_NAME)"
	@echo "  KB ID   : $(or $(BEDROCK_KB_ID),(없음))"
	@echo "  Diff    : $(DIFF_BASE)"
	@echo "══════════════════════════════════════════"
	@echo "  변경 파일: $(words $(CHANGED_FILES))개"
	@if [ -n "$(CHANGED_FILES)" ]; then echo "$(CHANGED_FILES)" | tr ' ' '\n' | head -20 | sed 's/^/    /'; fi

# ============================================================
# 배포 계획 (dry-run)
# ============================================================
plan: info
	@echo ""
	@echo "📋 배포 계획:"
	@echo "──────────────────────────────────────"
	@PLAN=0; \
	if [ -n "$(HAS_AGENT_CONSULT)" ]; then echo "  🤖 consultation-agent"; PLAN=1; fi; \
	if [ -n "$(HAS_AGENT_SUMMARY)" ]; then echo "  🤖 summary-agent"; PLAN=1; fi; \
	if [ -n "$(HAS_AGENT_PLANNING)" ]; then echo "  🤖 planning-agent"; PLAN=1; fi; \
	if [ -n "$(HAS_AGENT_SHIP)" ]; then echo "  🤖 ship-agent"; PLAN=1; fi; \
	if [ -n "$(HAS_TEMPLATE)" ]; then echo "  🏗️  SAM 전체 (template.yaml 변경)"; PLAN=1; \
	elif [ -n "$(HAS_BACKEND_SHARED)" ]; then echo "  🏗️  SAM 배포 (shared Layer → 전체 Lambda 영향)"; PLAN=1; \
	elif [ -n "$(HAS_BACKEND_DOMAIN)" ]; then echo "  🏗️  SAM 배포 (도메인 Lambda 변경)"; PLAN=1; fi; \
	if [ -n "$(NEEDS_WEB)" ]; then echo "  🌐 웹사이트 배포"; PLAN=1; fi; \
	if [ $$PLAN -eq 0 ]; then echo "  ✅ 배포 대상 없음"; fi
	@echo "──────────────────────────────────────"

# ============================================================
# 선택적 배포 (git diff 기반)
# ============================================================
deploy: info
	@echo ""
	@DEPLOYED=0; \
	if [ -n "$(NEEDS_AGENTS)" ]; then \
		$(MAKE) deploy-agents --no-print-directory; \
		DEPLOYED=1; \
	fi; \
	if [ -n "$(NEEDS_SAM)" ]; then \
		$(MAKE) deploy-backend --no-print-directory; \
		DEPLOYED=1; \
	fi; \
	if [ -n "$(NEEDS_WEB)" ]; then \
		$(MAKE) deploy-website --no-print-directory; \
		DEPLOYED=1; \
	fi; \
	if [ $$DEPLOYED -eq 0 ]; then \
		echo "✅ 변경사항 없음 — 배포 스킵"; \
	else \
		echo ""; echo "✅ 선택적 배포 완료!"; \
	fi

# ============================================================
# 전체 배포 (deploy-full.sh 대체)
# ============================================================
deploy-all: info install deploy-agents-all build-backend
	@echo "🏗️  SAM 배포..."
	sam deploy \
		--profile $(PROFILE) \
		--region $(REGION) \
		--stack-name $(STACK_NAME) \
		--resolve-s3 \
		--capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
		--parameter-overrides "Stage=\"$(STAGE)\" BedrockRegion=\"$(BEDROCK_REGION)\""
	@echo "🔧 환경변수 업데이트..."
	./update-env-vars.sh $(PROFILE) $(STAGE) $(REGION) $(STACK_NAME)
	$(MAKE) deploy-website --no-print-directory
	@echo ""
	@echo "✅ 전체 배포 완료!"

# ============================================================
# 개별 배포 타겟
# ============================================================

## SAM 백엔드 배포
deploy-backend: install build-backend
	@echo "🏗️  SAM 배포..."
	sam deploy \
		--profile $(PROFILE) \
		--region $(REGION) \
		--stack-name $(STACK_NAME) \
		--resolve-s3 \
		--capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
		--parameter-overrides "Stage=\"$(STAGE)\" BedrockRegion=\"$(BEDROCK_REGION)\""
	@echo "🔧 환경변수 업데이트..."
	./update-env-vars.sh $(PROFILE) $(STAGE) $(REGION) $(STACK_NAME)
	@echo "✅ 백엔드 배포 완료"

## 프론트엔드 배포
deploy-website: build-website
	@echo "🌐 웹사이트 배포..."
	./deploy-website.sh $(STAGE) $(PROFILE) $(REGION) $(STACK_NAME)
	@echo "✅ 웹사이트 배포 완료"

## 변경된 에이전트만 배포
deploy-agents:
	@echo "🤖 변경된 에이전트 배포..."
	@if [ -n "$(HAS_AGENT_CONSULT)" ]; then $(MAKE) deploy-agent-consultation --no-print-directory; fi
	@if [ -n "$(HAS_AGENT_SUMMARY)" ]; then $(MAKE) deploy-agent-summary --no-print-directory; fi
	@if [ -n "$(HAS_AGENT_PLANNING)" ]; then $(MAKE) deploy-agent-planning --no-print-directory; fi
	@if [ -n "$(HAS_AGENT_SHIP)" ]; then $(MAKE) deploy-agent-ship --no-print-directory; fi
	@echo "✅ 에이전트 배포 완료"

## 전체 에이전트 배포
deploy-agents-all:
	@echo "🤖 전체 에이전트 배포..."
	./packages/strands-agents/deploy-agents.sh $(PROFILE) $(STAGE) $(REGION) $(or $(BEDROCK_KB_ID),)
	@echo "✅ 전체 에이전트 배포 완료"

# ============================================================
# 개별 에이전트 배포 + SSM 등록
# ============================================================
SSM_PREFIX = /prechat/$(STAGE)/agents

# 에이전트 배포 → ARN 추출 → SSM 등록
# $(1): 에이전트 디렉토리명, $(2): SSM 역할 키
define agent_deploy_and_register
	@echo "🤖 $(1) 배포..."
	@cd packages/strands-agents/$(1) && \
	DEPLOY_OUTPUT=$$(AWS_PROFILE=$(PROFILE) AWS_DEFAULT_REGION=$(REGION) \
		STAGE=$(STAGE) BEDROCK_KB_ID=$(or $(BEDROCK_KB_ID),NONE) \
		python deploy_agent.py 2>&1 | tee /dev/stderr | tail -1) && \
	AGENT_ARN=$$(echo "$$DEPLOY_OUTPUT" | python3 -c "\
import sys, json; \
data = json.loads(sys.stdin.read()); \
print(data.get('agent_runtime_arn', ''))" 2>/dev/null) && \
	if [ -n "$$AGENT_ARN" ]; then \
		echo "📝 SSM 등록: $(SSM_PREFIX)/$(2)/runtime-arn"; \
		aws ssm put-parameter \
			--name "$(SSM_PREFIX)/$(2)/runtime-arn" \
			--value "$$AGENT_ARN" \
			--type "String" \
			--overwrite \
			--region "$(REGION)" \
			--profile "$(PROFILE)" \
			--description "PreChat $(2) agent runtime ARN ($(STAGE))"; \
		echo "✅ $(1) 배포 + SSM 등록 완료: $$AGENT_ARN"; \
	else \
		echo "⚠️  ARN 추출 실패 — SSM 등록 스킵"; \
	fi
endef

deploy-agent-consultation:
	$(call agent_deploy_and_register,consultation-agent,consultation)

deploy-agent-summary:
	$(call agent_deploy_and_register,summary-agent,summary)

deploy-agent-planning:
	$(call agent_deploy_and_register,planning-agent,planning)

deploy-agent-ship:
	$(call agent_deploy_and_register,ship-agent,ship)

# ============================================================
# 빌드 타겟
# ============================================================
install:
	@echo "📦 의존성 설치..."
	yarn install

build-backend:
	@echo "🔨 SAM 빌드..."
	sam build --profile $(PROFILE)

build-website:
	@echo "🔨 웹사이트 빌드..."
	cd packages/web-app && NODE_ENV=production yarn build
