# nosemgrep
"""Admin Onboarding Landing 핸들러.

이 모듈은 `GET /api/admin/onboarding/status` 집계 엔드포인트를 제공한다.
현재 구성:
  - QuestStateDTO dataclass 및 6개 Quest builder 순수 함수 (Task 2.2)
  - Cognito / DynamoDB 읽기 전용 aggregator 함수 4종 (Task 3.2–3.5)
  - Future 예외 격리 헬퍼 `_safe_result` (Task 3.6)
핸들러 entry point(`get_onboarding_status`)는 Task 4에서 조립된다.

설계 참조: .kiro/specs/admin-onboarding-landing/design.md
  - "Data Models → Backend Aggregation DTO"
  - "Algorithmic Pseudocode → Sub-Algorithm: Quest Builder"
  - "Algorithmic Pseudocode → Sub-Algorithm: Count Agents by Role"
  - "Algorithmic Pseudocode → Sub-Algorithm: Count Active Campaigns"
"""

import logging
import os
from concurrent.futures import Future, ThreadPoolExecutor
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Attr, Key

from models.agent_config import LEGACY_ROLE_MAP
from utils import lambda_response

# 로거 설정 (다른 admin 핸들러와 동일한 패턴)
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Lazy 초기화되는 boto3 클라이언트/리소스 (Lambda 콜드 스타트 간 재사용)
cognito = boto3.client('cognito-idp')
dynamodb = boto3.resource('dynamodb')

# 환경 변수 (누락 시 빈 문자열 — Task 4 핸들러에서 검증/500 처리)
USER_POOL_ID = os.environ.get('USER_POOL_ID', '')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE', '')
CAMPAIGNS_TABLE = os.environ.get('CAMPAIGNS_TABLE', '')


@dataclass
class QuestStateDTO:
    """단일 Quest의 상태를 표현하는 응답 DTO.

    `asdict()`로 dict 직렬화 후 API 응답 `quests` 배열의 원소로 사용된다.
    필드 정의는 설계 문서의 OnboardingStatus 스키마와 1:1 대응한다.
    """

    questId: str
    status: str  # 'complete' | 'incomplete' | 'info-only'
    currentCount: Optional[int]
    requiredCount: Optional[int]
    subCounts: Optional[dict]
    ctaPath: Optional[str]


def _build_users_quest(user_count: int) -> dict:
    """Quest 1 (users) 상태를 조립한다. user_count >= 1 이면 complete."""
    status = 'complete' if user_count >= 1 else 'incomplete'
    return asdict(
        QuestStateDTO(
            questId='users',
            status=status,
            currentCount=user_count,
            requiredCount=1,
            subCounts=None,
            ctaPath=None,
        )
    )


def _build_agents_quest(consult_count: int, summary_count: int) -> dict:
    """Quest 2 (agents) 상태를 조립한다. consultation/summary 둘 다 1개 이상이면 complete."""
    is_complete = consult_count >= 1 and summary_count >= 1
    status = 'complete' if is_complete else 'incomplete'
    return asdict(
        QuestStateDTO(
            questId='agents',
            status=status,
            currentCount=consult_count + summary_count,
            requiredCount=2,
            subCounts={'consultation': consult_count, 'summary': summary_count},
            ctaPath='/admin/agents/create',
        )
    )


def _build_campaigns_quest(count: int) -> dict:
    """Quest 3 (campaigns) 상태를 조립한다. 활성 캠페인이 1개 이상이면 complete."""
    status = 'complete' if count >= 1 else 'incomplete'
    return asdict(
        QuestStateDTO(
            questId='campaigns',
            status=status,
            currentCount=count,
            requiredCount=1,
            subCounts=None,
            ctaPath='/admin/campaigns/create',
        )
    )


def _build_sessions_info_quest() -> dict:
    """Quest 4 (sessions) 정보 전용 상태. 완료 판정 없이 세션 생성 CTA만 제공."""
    return asdict(
        QuestStateDTO(
            questId='sessions',
            status='info-only',
            currentCount=None,
            requiredCount=None,
            subCounts=None,
            ctaPath='/admin/sessions/create',
        )
    )


def _build_invite_info_quest() -> dict:
    """Quest 5 (customer-invite) 정보 전용 상태. 외부 초대는 수동 프로세스이므로 평문 가이드만 노출."""
    return asdict(
        QuestStateDTO(
            questId='customer-invite',
            status='info-only',
            currentCount=None,
            requiredCount=None,
            subCounts=None,
            ctaPath=None,
        )
    )


def _build_analysis_quest(completed: int) -> dict:
    """Quest 6 (session-analysis) 정보 전용 상태. 완료 세션 수를 노출하며 대시보드로 이동."""
    return asdict(
        QuestStateDTO(
            questId='session-analysis',
            status='info-only',
            currentCount=completed,
            requiredCount=None,
            subCounts=None,
            ctaPath='/admin',
        )
    )



# ---------------------------------------------------------------------------
# Aggregator 함수들 (Task 3.2–3.6)
#
# 각 함수는 예외를 상위(`_safe_result`)에 그대로 전파하며, 호출측에서 폴백을
# 수행한다. 로깅도 상위에서 일괄 처리하므로 본 함수들은 순수 집계 책임만 진다.
# ---------------------------------------------------------------------------


def _count_cognito_users() -> int:
    """Cognito User Pool의 Enabled=True 사용자 수를 페이지네이션하여 반환.

    `cognito-idp.list_users`는 페이지당 최대 60명을 반환하므로,
    `PaginationToken`이 더 이상 없을 때까지 순회해야 정확한 카운트를 얻는다.
    """
    total = 0
    kwargs: dict = {'UserPoolId': USER_POOL_ID}
    while True:
        resp = cognito.list_users(**kwargs)
        users = resp.get('Users', []) or []
        total += sum(
            1 for user in users if user.get('Enabled', False) is True
        )
        next_token = resp.get('PaginationToken')
        if not next_token:
            break
        kwargs['PaginationToken'] = next_token
    return total


def _count_agents_by_role(role: str) -> int:
    """SessionsTable GSI1에서 지정한 역할(+레거시 매핑)의 AgentConfiguration 수를 반환.

    LEGACY_ROLE_MAP은 예전 역할값(prechat, planning, ship 등)을 신규 값으로
    매핑한다. 예: role='consultation'이면 legacy={'prechat','planning','ship'}도
    함께 조회하여 마이그레이션 전후 아이템을 누적 카운트한다.
    """
    legacy_roles = [
        legacy
        for legacy, mapped in LEGACY_ROLE_MAP.items()
        if mapped == role
    ]
    roles_to_query = [role] + legacy_roles

    table = dynamodb.Table(SESSIONS_TABLE)
    total = 0
    for r in roles_to_query:
        query_kwargs = {
            'IndexName': 'GSI1',
            'KeyConditionExpression': Key('GSI1PK').eq(f'AGENTCONFIG#{r}'),
        }
        while True:
            resp = table.query(**query_kwargs)
            items = resp.get('Items', []) or []
            total += len(items)
            last_key = resp.get('LastEvaluatedKey')
            if not last_key:
                break
            query_kwargs['ExclusiveStartKey'] = last_key
    return total


def _count_active_campaigns() -> int:
    """CampaignsTable에서 status='active' 캠페인 수를 scan + filter로 반환.

    CampaignsTable의 활성 상태 필드명은 `status`이며 값은 소문자 'active'이다
    (campaign_handler.py, campaign_analytics.py 규약과 일치).

    MVP에서는 ownerId 제한 없이 전체 테넌트의 활성 캠페인을 카운트한다.
    규모 증가 시 전용 GSI(CampaignStatusIndex) 도입을 후속 과제로 고려한다.
    """
    table = dynamodb.Table(CAMPAIGNS_TABLE)
    scan_kwargs = {
        'FilterExpression': Attr('status').eq('active'),
    }
    total = 0
    while True:
        resp = table.scan(**scan_kwargs)
        items = resp.get('Items', []) or []
        total += len(items)
        last_key = resp.get('LastEvaluatedKey')
        if not last_key:
            break
        scan_kwargs['ExclusiveStartKey'] = last_key
    return total


def _count_completed_sessions() -> int:
    """SessionsTable GSI2에서 status='completed' 세션 수를 쿼리하여 반환.

    GSI2 파티션 키는 status 필드이며, 동일 파티션 내에서 페이지네이션
    순회하여 누적 카운트를 집계한다.
    """
    table = dynamodb.Table(SESSIONS_TABLE)
    query_kwargs = {
        'IndexName': 'GSI2',
        'KeyConditionExpression': Key('status').eq('completed'),
    }
    total = 0
    while True:
        resp = table.query(**query_kwargs)
        items = resp.get('Items', []) or []
        total += len(items)
        last_key = resp.get('LastEvaluatedKey')
        if not last_key:
            break
        query_kwargs['ExclusiveStartKey'] = last_key
    return total


def _safe_result(
    future: 'Future[int]',
    quest_label: str,
    default: int = 0,
) -> int:
    """Future 예외 발생 시 default 반환 + WARN 로그.

    예외 메시지 본문 및 스택 트레이스는 기록하지 않고 예외 클래스명만 남긴다.
    이는 credential/PII/내부 경로 등이 로그에 누출되는 것을 방지하기 위한
    조치이다 (NFR-2.3 준수).
    """
    try:
        value = future.result()
        return int(value)
    except Exception as exc:  # noqa: BLE001 — 집계 실패는 모두 폴백 대상
        exc_class = type(exc).__name__
        logger.warning(
            'Onboarding aggregation fallback: quest=%s exception=%s',
            quest_label,
            exc_class,
        )
        return default

# ---------------------------------------------------------------------------
# 메인 Lambda 핸들러 entry point (Task 4.2)
#
# API Gateway 경로: GET /api/admin/onboarding/status (Cognito Authorizer 필수)
# 응답 스키마: { quests: QuestState[6], generatedAt: ISO 8601 UTC }
# 실패 정책:
#   - 개별 집계 실패는 `_safe_result`가 0으로 폴백 → 여전히 HTTP 200
#   - 환경 변수 누락 등 치명적 구성 오류 → HTTP 500 (generic 메시지)
#   - 예상치 못한 예외 → HTTP 500 (stack trace는 CloudWatch 로그에만)
# ---------------------------------------------------------------------------


def get_onboarding_status(event, context):
    """GET /api/admin/onboarding/status 엔드포인트 핸들러.

    5개 집계를 병렬 실행하여 6개 Quest 상태를 조립한다.
    부분 실패 시에도 HTTP 200을 반환하며 실패한 카운트는 0으로 폴백된다.
    환경 변수 누락 등 치명적 오류 시에만 HTTP 500을 반환한다.
    """
    # 환경 변수 검증 — 이름/값은 응답 본문에 노출하지 않고 일반 메시지만 반환
    if not USER_POOL_ID or not SESSIONS_TABLE or not CAMPAIGNS_TABLE:
        logger.error('Onboarding handler missing required env vars')
        return lambda_response(500, {'error': 'Service misconfigured'})

    try:
        # Step 1: 5개 집계를 병렬 실행 (ThreadPoolExecutor로 I/O 대기 중첩)
        with ThreadPoolExecutor(max_workers=4) as executor:
            f_users = executor.submit(_count_cognito_users)
            f_consult = executor.submit(_count_agents_by_role, 'consultation')
            f_summary = executor.submit(_count_agents_by_role, 'summary')
            f_camps = executor.submit(_count_active_campaigns)
            f_sess = executor.submit(_count_completed_sessions)

            # Step 2: 결과 수집 — 각 Future 예외는 0으로 폴백되며 WARN 로그만 남김
            user_count = _safe_result(f_users, 'users')
            consult_count = _safe_result(f_consult, 'agents.consultation')
            summary_count = _safe_result(f_summary, 'agents.summary')
            campaign_count = _safe_result(f_camps, 'campaigns')
            completed_session_count = _safe_result(f_sess, 'sessions.completed')

        # Step 3: 6개 Quest를 설계 문서 정의 순서대로 조립
        quests = [
            _build_users_quest(user_count),
            _build_agents_quest(consult_count, summary_count),
            _build_campaigns_quest(campaign_count),
            _build_sessions_info_quest(),
            _build_invite_info_quest(),
            _build_analysis_quest(completed_session_count),
        ]

        # Step 4: 응답 반환 (generatedAt은 ISO 8601 UTC)
        return lambda_response(
            200,
            {
                'quests': quests,
                'generatedAt': datetime.now(timezone.utc).isoformat(),
            },
        )
    except Exception:  # noqa: BLE001 — 집계 파이프라인 외곽의 마지막 방어선
        # stack trace는 CloudWatch에만, 응답 본문은 generic 메시지로 제한한다.
        # (NFR-2.3, Requirement 12.5 / 18.1 준수 — PII/credential/path 비노출)
        logger.exception('Unexpected error aggregating onboarding status')
        return lambda_response(
            500, {'error': 'Failed to aggregate onboarding status'}
        )
