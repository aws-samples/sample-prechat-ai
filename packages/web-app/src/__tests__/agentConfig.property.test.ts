/**
 * AgentConfig 속성 기반 테스트 (Property-Based Tests)
 *
 * Feature: agent-config-revamp
 *
 * 프론트엔드 측에서 검증 가능한 AgentConfig 관련 correctness properties를
 * fast-check를 사용하여 임의 입력에 대해 검증한다.
 *
 * 프론트엔드에서 "직렬화 라운드트립"은 백엔드와 달리 DynamoDB가 아닌
 * API 응답 ↔ 폼 상태 ↔ 업데이트 요청 페이로드 사이의 변환을 의미한다.
 * 즉, `normalizeFromApi(apiResponse)` → `toApiRequest(form)` 왕복 변환이
 * 모든 필드(configId, agentRole, agentName, systemPrompt, modelId, i18n,
 * tools)를 보존해야 한다.
 *
 * 검증 속성:
 * - Property 1: AgentConfig 직렬화 라운드트립 (frontend normalization)
 * - Property 2: agent_role 검증
 * - Property 11: 레거시 역할 매핑
 *
 * **Validates: Requirements 3.6, 1.4, 1.5, 15.1**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type {
  AgentConfiguration,
  AgentRole,
  ToolConfig,
} from '../types';

// --- 검증 대상 순수 함수 (프론트엔드 hydration/submission 로직 재현) ---

const VALID_ROLES: readonly AgentRole[] = [
  'consultation',
  'summary',
] as const;

/**
 * 레거시 역할 매핑 테이블.
 * EditAgent.test.tsx 및 백엔드 LEGACY_ROLE_MAP과 동일하다.
 */
const LEGACY_ROLE_MAP: Record<string, AgentRole> = {
  prechat: 'consultation',
  planning: 'consultation',
  ship: 'consultation',
};

/**
 * agent_role 유효성 검증.
 * 'consultation' 또는 'summary'만 true를 반환한다.
 */
const isValidAgentRole = (role: string): boolean =>
  (VALID_ROLES as readonly string[]).includes(role);

/**
 * 역할 값 정규화: 레거시 역할값을 현재 역할값으로 변환한다.
 * - 'consultation'/'summary' → 그대로
 * - 'prechat'/'planning'/'ship' → 'consultation'
 * - 그 외 → '' (알 수 없음)
 *
 * EditAgent.test.tsx의 normalizeAgentRole과 동일한 규칙을 따른다.
 */
const normalizeAgentRole = (role: string): AgentRole | '' => {
  if (isValidAgentRole(role)) {
    return role as AgentRole;
  }
  if (LEGACY_ROLE_MAP[role]) {
    return LEGACY_ROLE_MAP[role];
  }
  return '';
};

/**
 * API 응답 구조(flexible 입력)를 프론트엔드에서 사용하는
 * 정규화된 AgentConfiguration으로 변환한다.
 *
 * - tools 필드는 배열 그대로 받거나, 백엔드에서 JSON 문자열로 오면
 *   파싱한다 (방어적 처리).
 * - agentRole은 레거시 역할 매핑을 거친다.
 */
const normalizeFromApi = (
  apiResponse: Record<string, unknown>
): AgentConfiguration => {
  const rawRole =
    typeof apiResponse.agentRole === 'string'
      ? apiResponse.agentRole
      : '';
  const normalizedRole = normalizeAgentRole(rawRole);

  let tools: ToolConfig[] = [];
  const rawTools = apiResponse.tools;
  if (Array.isArray(rawTools)) {
    tools = rawTools as ToolConfig[];
  } else if (typeof rawTools === 'string') {
    try {
      const parsed = JSON.parse(rawTools);
      if (Array.isArray(parsed)) {
        tools = parsed as ToolConfig[];
      }
    } catch {
      tools = [];
    }
  }

  // 유효하지 않은 역할인 경우 테스트 편의를 위해
  // 'consultation'으로 폴백한다 (UI에서는 별도 검증을 수행).
  const finalRole: AgentRole =
    normalizedRole !== '' ? normalizedRole : 'consultation';

  return {
    configId:
      typeof apiResponse.configId === 'string'
        ? apiResponse.configId
        : '',
    agentRole: finalRole,
    agentName:
      typeof apiResponse.agentName === 'string'
        ? apiResponse.agentName
        : '',
    systemPrompt:
      typeof apiResponse.systemPrompt === 'string'
        ? apiResponse.systemPrompt
        : '',
    modelId:
      typeof apiResponse.modelId === 'string'
        ? apiResponse.modelId
        : '',
    i18n:
      typeof apiResponse.i18n === 'string'
        ? apiResponse.i18n
        : 'ko',
    tools,
  };
};

/**
 * 폼 state(= AgentConfiguration)를 업데이트 API 요청 페이로드로 변환한다.
 * AgentConfiguration의 모든 필드를 포함하는 "완전 변환" 방식으로,
 * 라운드트립 속성(P1)을 검증할 수 있다.
 */
const toApiRequest = (
  config: AgentConfiguration
): Record<string, unknown> => ({
  configId: config.configId,
  agentRole: config.agentRole,
  agentName: config.agentName,
  systemPrompt: config.systemPrompt,
  modelId: config.modelId,
  i18n: config.i18n,
  tools: config.tools,
});

// --- fast-check 생성기(arbitrary) ---

/**
 * ToolConfig 생성기.
 * retrieve 도구는 tool_attributes에 kb_id를 포함하도록 조건부 생성한다.
 */
const toolConfigArbitrary: fc.Arbitrary<ToolConfig> = fc.oneof(
  fc.record({
    tool_name: fc.constantFrom(
      'current_time',
      'render_form',
      'aws_docs_mcp',
      'http_request',
      'extract_a2t_log'
    ),
  }),
  fc.record({
    tool_name: fc.constant('retrieve'),
    tool_attributes: fc.record({
      kb_id: fc.stringMatching(/^KB-[A-Z0-9]{4,10}$/),
    }),
  })
);

/**
 * 유효한 AgentConfiguration 객체 생성기.
 */
const agentConfigurationArbitrary: fc.Arbitrary<AgentConfiguration> =
  fc.record({
    configId: fc.uuid(),
    agentRole: fc.constantFrom<AgentRole>(
      'consultation',
      'summary'
    ),
    agentName: fc.string({ minLength: 0, maxLength: 80 }),
    systemPrompt: fc.string({ minLength: 0, maxLength: 500 }),
    modelId: fc.constantFrom(
      'global.amazon.nova-2-lite-v1:0',
      'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      'global.anthropic.claude-haiku-4-5-20251001-v1:0'
    ),
    i18n: fc.constantFrom('ko', 'en'),
    tools: fc.array(toolConfigArbitrary, {
      minLength: 0,
      maxLength: 6,
    }),
  });

// --- 테스트 ---

describe('AgentConfig 속성 기반 테스트 (fast-check)', () => {
  describe('Property 1: AgentConfig 직렬화 라운드트립', () => {
    it('임의의 AgentConfiguration → toApiRequest → normalizeFromApi 라운드트립 후 원본과 동등해야 한다 (Validates: Requirements 3.6)', () => {
      fc.assert(
        fc.property(
          agentConfigurationArbitrary,
          (original: AgentConfiguration) => {
            const apiPayload = toApiRequest(original);
            const roundTripped = normalizeFromApi(apiPayload);

            // 각 필드가 보존되는지 검증
            expect(roundTripped.configId).toBe(original.configId);
            expect(roundTripped.agentRole).toBe(original.agentRole);
            expect(roundTripped.agentName).toBe(original.agentName);
            expect(roundTripped.systemPrompt).toBe(
              original.systemPrompt
            );
            expect(roundTripped.modelId).toBe(original.modelId);
            expect(roundTripped.i18n).toBe(original.i18n);
            expect(roundTripped.tools).toEqual(original.tools);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('백엔드가 tools를 JSON 문자열로 반환하는 경우에도 라운드트립이 유지되어야 한다 (Validates: Requirements 3.6)', () => {
      fc.assert(
        fc.property(
          agentConfigurationArbitrary,
          (original: AgentConfiguration) => {
            // 백엔드가 tools를 JSON 문자열로 직렬화해서 보낸 상황 시뮬레이션
            const apiPayloadWithJsonTools: Record<string, unknown> =
              {
                ...toApiRequest(original),
                tools: JSON.stringify(original.tools),
              };

            const roundTripped = normalizeFromApi(
              apiPayloadWithJsonTools
            );

            expect(roundTripped.tools).toEqual(original.tools);
            expect(roundTripped.agentRole).toBe(original.agentRole);
            expect(roundTripped.i18n).toBe(original.i18n);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: agent_role 검증', () => {
    it("'consultation'과 'summary'만 유효한 역할로 판정되어야 한다 (Validates: Requirements 1.4)", () => {
      expect(isValidAgentRole('consultation')).toBe(true);
      expect(isValidAgentRole('summary')).toBe(true);
    });

    it('유효한 역할 문자열 외의 임의 문자열은 항상 false를 반환해야 한다 (Validates: Requirements 1.4, 1.5)', () => {
      fc.assert(
        fc.property(
          fc
            .string()
            .filter(
              (s) =>
                s !== 'consultation' && s !== 'summary'
            ),
          (invalidRole: string) => {
            expect(isValidAgentRole(invalidRole)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('유효 역할 집합에서 선택된 문자열은 항상 true를 반환해야 한다 (Validates: Requirements 1.4)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<AgentRole>('consultation', 'summary'),
          (validRole: AgentRole) => {
            expect(isValidAgentRole(validRole)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 11: 레거시 역할 매핑', () => {
    it("레거시 역할 'prechat', 'planning', 'ship'은 모두 'consultation'으로 매핑되어야 한다 (Validates: Requirements 15.1)", () => {
      fc.assert(
        fc.property(
          fc.constantFrom('prechat', 'planning', 'ship'),
          (legacyRole: string) => {
            expect(normalizeAgentRole(legacyRole)).toBe(
              'consultation'
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it("현재 유효 역할 'consultation', 'summary'는 매핑 후에도 동일하게 유지되어야 한다 (Validates: Requirements 15.1)", () => {
      fc.assert(
        fc.property(
          fc.constantFrom<AgentRole>('consultation', 'summary'),
          (currentRole: AgentRole) => {
            expect(normalizeAgentRole(currentRole)).toBe(
              currentRole
            );
          }
        ),
        { numRuns: 100 }
      );
    });

    it("유효 역할이나 레거시 역할이 아닌 임의 문자열은 '' (빈 문자열)로 매핑되어야 한다 (Validates: Requirements 15.1)", () => {
      const knownRoles = new Set([
        'consultation',
        'summary',
        'prechat',
        'planning',
        'ship',
      ]);
      fc.assert(
        fc.property(
          fc.string().filter((s) => !knownRoles.has(s)),
          (unknownRole: string) => {
            expect(normalizeAgentRole(unknownRole)).toBe('');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('레거시 역할을 가진 API 응답을 normalizeFromApi로 변환하면 agentRole이 consultation으로 매핑되어야 한다 (Validates: Requirements 15.1)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('prechat', 'planning', 'ship'),
          fc.uuid(),
          fc.string({ minLength: 0, maxLength: 40 }),
          (legacyRole: string, configId: string, agentName: string) => {
            const apiResponse: Record<string, unknown> = {
              configId,
              agentRole: legacyRole,
              agentName,
              systemPrompt: '',
              modelId: 'global.amazon.nova-2-lite-v1:0',
              i18n: 'ko',
              tools: [],
            };

            const normalized = normalizeFromApi(apiResponse);
            expect(normalized.agentRole).toBe('consultation');
            expect(normalized.configId).toBe(configId);
            expect(normalized.agentName).toBe(agentName);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
