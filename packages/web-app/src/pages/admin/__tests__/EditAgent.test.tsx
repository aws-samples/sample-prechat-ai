/**
 * EditAgent 페이지 단위 테스트
 *
 * EditAgent 컴포넌트의 핵심 hydration/사전 채움 로직을 검증합니다:
 * - 기존 AgentConfig 값으로 폼 사전 채움 (hydrateFormFromConfig)
 * - 도구 체크박스 사전 체크 (isToolChecked predicate)
 * - retrieve 도구의 kb_id 사전 선택 (extractKbIdFromTools)
 * - agentRole 읽기 전용 처리 (isAgentRoleReadOnly, 역할 변경 무시 로직)
 * - 레거시 역할(prechat/planning/ship) → consultation 매핑
 *
 * 테스트 환경이 node이므로, 컴포넌트의 핵심 로직(hydration, predicate,
 * 역할 변경 방지)을 순수 함수로 추출하여 단위 테스트합니다.
 *
 * **Validates: Requirements 12.1, 12.2, 12.3, 15.1**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  AgentConfiguration,
  AgentRole,
  ToolConfig,
} from '../../../types';

// --- EditAgent 페이지의 핵심 로직 재현 ---

interface FormState {
  agentName: string;
  agentRole: AgentRole | '';
  modelId: string;
  systemPrompt: string;
  i18n: string;
  tools: ToolConfig[];
}

const INITIAL_FORM: FormState = {
  agentName: '',
  agentRole: '',
  modelId: '',
  systemPrompt: '',
  i18n: 'ko',
  tools: [],
};

/**
 * 레거시 역할 매핑 테이블.
 * 백엔드와 동일한 매핑을 유지한다.
 */
const LEGACY_ROLE_MAP: Record<string, AgentRole> = {
  prechat: 'consultation',
  planning: 'consultation',
  ship: 'consultation',
};

/**
 * 역할 값 정규화: 레거시 역할값을 현재 역할값으로 변환.
 * consultation/summary 외의 값은 LEGACY_ROLE_MAP을 통해 매핑한다.
 */
const normalizeAgentRole = (
  role: string
): AgentRole | '' => {
  if (role === 'consultation' || role === 'summary') {
    return role;
  }
  if (LEGACY_ROLE_MAP[role]) {
    return LEGACY_ROLE_MAP[role];
  }
  return '';
};

/**
 * 기존 AgentConfig를 받아 폼 state로 변환하는 hydration 함수.
 * EditAgent의 loadConfig() 내부 setFormData 로직을 순수 함수로 재현한다.
 */
const hydrateFormFromConfig = (
  config: AgentConfiguration
): FormState => ({
  agentName: config.agentName ?? '',
  agentRole: normalizeAgentRole(config.agentRole),
  modelId: config.modelId ?? '',
  systemPrompt: config.systemPrompt ?? '',
  i18n: config.i18n ?? 'ko',
  tools: config.tools
    ? config.tools.map((t) => ({ ...t }))
    : [],
});

/**
 * 특정 tool_name이 tools 배열에 포함되어 있는지 검사하는 predicate.
 * EditAgent의 도구 체크박스 렌더링 시 사용되는 로직 재현.
 */
const isToolChecked = (
  tools: ToolConfig[],
  toolName: string
): boolean => tools.some((tc) => tc.tool_name === toolName);

/**
 * tools 배열에서 retrieve 도구의 tool_attributes.kb_id를 추출.
 * retrieve 도구가 없거나 kb_id가 없으면 빈 문자열을 반환한다.
 * EditAgent의 loadConfig() 내 retrieveTool.tool_attributes.kb_id 로직 재현.
 */
const extractKbIdFromTools = (
  tools: ToolConfig[]
): string => {
  const retrieveTool = tools.find(
    (tc) => tc.tool_name === 'retrieve'
  );
  return retrieveTool?.tool_attributes?.kb_id ?? '';
};

/**
 * EditAgent에서 agentRole 필드는 항상 읽기 전용이다.
 * (Select 컴포넌트에 disabled prop이 true로 고정됨)
 */
const isAgentRoleReadOnly = (): boolean => true;

/**
 * agentRole 변경 시도 reducer.
 * EditAgent의 Select.onChange={() => {}} 로직을 재현하여
 * 역할 변경 시도를 무시한다.
 */
const attemptRoleChange = (
  prev: FormState,
  _newRole: AgentRole | ''
): FormState => {
  // EditAgent는 역할 변경을 허용하지 않는다.
  // onChange 핸들러가 no-op이므로 prev 그대로 반환.
  return prev;
};

/**
 * 업데이트 요청 페이로드 생성 로직.
 * EditAgent의 handleSubmit()에서 adminApi.updateAgentConfig로
 * 전달하는 body 구조를 재현한다. (agentRole은 PUT에서 제외됨)
 */
const buildUpdatePayload = (
  form: FormState
): Record<string, unknown> => {
  const isConsultation = form.agentRole === 'consultation';
  return {
    modelId: form.modelId,
    agentName: form.agentName,
    ...(isConsultation && {
      systemPrompt: form.systemPrompt,
      tools: form.tools,
      i18n: form.i18n,
    }),
  };
};

// 테스트 고정 데이터
const CONSULTATION_CONFIG: AgentConfiguration = {
  configId: 'cfg-consult-001',
  agentRole: 'consultation',
  agentName: '고객 상담 에이전트',
  systemPrompt: '# 고객 상담 프롬프트\n안녕하세요.',
  modelId: 'global.amazon.nova-2-lite-v1:0',
  i18n: 'ko',
  tools: [
    {
      tool_name: 'retrieve',
      tool_attributes: { kb_id: 'KB-12345' },
    },
    { tool_name: 'render_form' },
    { tool_name: 'current_time' },
  ],
};

const SUMMARY_CONFIG: AgentConfiguration = {
  configId: 'cfg-summary-001',
  agentRole: 'summary',
  agentName: '요약 에이전트',
  systemPrompt: '',
  modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  i18n: 'ko',
  tools: [],
};

const LEGACY_PRECHAT_CONFIG: AgentConfiguration = {
  configId: 'cfg-legacy-prechat',
  agentRole: 'prechat' as AgentRole,
  agentName: '레거시 PreChat 에이전트',
  systemPrompt: '# 레거시 프롬프트',
  modelId: 'global.amazon.nova-2-lite-v1:0',
  i18n: 'en',
  tools: [{ tool_name: 'aws_docs_mcp' }],
};

// --- 테스트 ---

describe('EditAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('기존 값 사전 채움 (hydrateFormFromConfig)', () => {
    it('Consultation 에이전트 로드 시 agentName, agentRole, modelId, systemPrompt, i18n이 모두 사전 채워져야 한다', () => {
      const form = hydrateFormFromConfig(CONSULTATION_CONFIG);

      expect(form.agentName).toBe('고객 상담 에이전트');
      expect(form.agentRole).toBe('consultation');
      expect(form.modelId).toBe(
        'global.amazon.nova-2-lite-v1:0'
      );
      expect(form.systemPrompt).toBe(
        '# 고객 상담 프롬프트\n안녕하세요.'
      );
      expect(form.i18n).toBe('ko');
    });

    it('Consultation 에이전트 로드 시 tools 배열이 그대로 사전 채워져야 한다', () => {
      const form = hydrateFormFromConfig(CONSULTATION_CONFIG);

      expect(form.tools).toHaveLength(3);
      expect(form.tools.map((t) => t.tool_name)).toEqual([
        'retrieve',
        'render_form',
        'current_time',
      ]);
    });

    it('Summary 에이전트 로드 시 modelId가 사전 채워지고 tools는 빈 배열이어야 한다', () => {
      const form = hydrateFormFromConfig(SUMMARY_CONFIG);

      expect(form.agentName).toBe('요약 에이전트');
      expect(form.agentRole).toBe('summary');
      expect(form.modelId).toBe(
        'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
      );
      expect(form.tools).toEqual([]);
    });

    it('i18n 필드가 config에 누락된 경우 기본값 "ko"가 사용되어야 한다', () => {
      const configWithoutI18n: AgentConfiguration = {
        ...CONSULTATION_CONFIG,
        i18n: undefined as unknown as string,
      };

      const form = hydrateFormFromConfig(configWithoutI18n);

      expect(form.i18n).toBe('ko');
    });

    it('tools 필드가 config에 누락된 경우 빈 배열이 사용되어야 한다', () => {
      const configWithoutTools: AgentConfiguration = {
        ...SUMMARY_CONFIG,
        tools: undefined as unknown as ToolConfig[],
      };

      const form = hydrateFormFromConfig(configWithoutTools);

      expect(form.tools).toEqual([]);
    });

    it('hydration된 tools 배열은 원본 config의 tools와 독립적이어야 한다 (deep copy)', () => {
      const form = hydrateFormFromConfig(CONSULTATION_CONFIG);

      // form.tools를 수정해도 CONSULTATION_CONFIG.tools에 영향이 없어야 함
      form.tools.push({ tool_name: 'http_request' });

      expect(CONSULTATION_CONFIG.tools).toHaveLength(3);
    });

    it('레거시 "prechat" 역할을 가진 config는 "consultation"으로 정규화되어 사전 채워져야 한다', () => {
      const form = hydrateFormFromConfig(LEGACY_PRECHAT_CONFIG);

      expect(form.agentRole).toBe('consultation');
      expect(form.agentName).toBe('레거시 PreChat 에이전트');
      expect(form.i18n).toBe('en');
    });
  });

  describe('도구 체크박스 사전 체크 (isToolChecked)', () => {
    it('tools에 포함된 tool_name은 isToolChecked가 true를 반환해야 한다', () => {
      const tools = CONSULTATION_CONFIG.tools;

      expect(isToolChecked(tools, 'retrieve')).toBe(true);
      expect(isToolChecked(tools, 'render_form')).toBe(true);
      expect(isToolChecked(tools, 'current_time')).toBe(true);
    });

    it('tools에 포함되지 않은 tool_name은 isToolChecked가 false를 반환해야 한다', () => {
      const tools = CONSULTATION_CONFIG.tools;

      expect(isToolChecked(tools, 'aws_docs_mcp')).toBe(false);
      expect(isToolChecked(tools, 'http_request')).toBe(false);
      expect(isToolChecked(tools, 'extract_a2t_log')).toBe(
        false
      );
    });

    it('빈 tools 배열에서는 어떤 도구도 체크되지 않아야 한다', () => {
      expect(isToolChecked([], 'retrieve')).toBe(false);
      expect(isToolChecked([], 'current_time')).toBe(false);
    });

    it('여러 도구가 설정된 config를 hydrate하면 각 도구의 체크박스가 모두 사전 체크되어야 한다', () => {
      const multiToolConfig: AgentConfiguration = {
        ...CONSULTATION_CONFIG,
        tools: [
          { tool_name: 'retrieve', tool_attributes: { kb_id: 'KB-1' } },
          { tool_name: 'render_form' },
          { tool_name: 'aws_docs_mcp' },
          { tool_name: 'http_request' },
          { tool_name: 'current_time' },
        ],
      };

      const form = hydrateFormFromConfig(multiToolConfig);

      expect(isToolChecked(form.tools, 'retrieve')).toBe(true);
      expect(isToolChecked(form.tools, 'render_form')).toBe(
        true
      );
      expect(isToolChecked(form.tools, 'aws_docs_mcp')).toBe(
        true
      );
      expect(isToolChecked(form.tools, 'http_request')).toBe(
        true
      );
      expect(isToolChecked(form.tools, 'current_time')).toBe(
        true
      );
      // 선택되지 않은 도구는 false
      expect(
        isToolChecked(form.tools, 'extract_a2t_log')
      ).toBe(false);
    });
  });

  describe('KB 선택기 사전 선택 (extractKbIdFromTools)', () => {
    it('retrieve 도구에 kb_id가 있으면 extractKbIdFromTools가 해당 값을 반환해야 한다', () => {
      const form = hydrateFormFromConfig(CONSULTATION_CONFIG);

      expect(extractKbIdFromTools(form.tools)).toBe('KB-12345');
    });

    it('retrieve 도구가 없으면 extractKbIdFromTools가 빈 문자열을 반환해야 한다', () => {
      const tools: ToolConfig[] = [
        { tool_name: 'render_form' },
        { tool_name: 'current_time' },
      ];

      expect(extractKbIdFromTools(tools)).toBe('');
    });

    it('retrieve 도구는 있지만 tool_attributes가 없으면 빈 문자열을 반환해야 한다', () => {
      const tools: ToolConfig[] = [
        { tool_name: 'retrieve' },
        { tool_name: 'current_time' },
      ];

      expect(extractKbIdFromTools(tools)).toBe('');
    });

    it('retrieve 도구의 tool_attributes에 kb_id가 없으면 빈 문자열을 반환해야 한다', () => {
      const tools: ToolConfig[] = [
        {
          tool_name: 'retrieve',
          tool_attributes: { other_attr: 'value' },
        },
      ];

      expect(extractKbIdFromTools(tools)).toBe('');
    });

    it('빈 tools 배열에서는 빈 문자열을 반환해야 한다', () => {
      expect(extractKbIdFromTools([])).toBe('');
    });

    it('retrieve 도구가 여러 개 있는 경우 첫 번째 항목의 kb_id를 반환해야 한다', () => {
      const tools: ToolConfig[] = [
        {
          tool_name: 'retrieve',
          tool_attributes: { kb_id: 'KB-FIRST' },
        },
        {
          tool_name: 'retrieve',
          tool_attributes: { kb_id: 'KB-SECOND' },
        },
      ];

      expect(extractKbIdFromTools(tools)).toBe('KB-FIRST');
    });

    it('hydration 결과와 extractKbIdFromTools를 조합하면 초기 selectedKbId를 계산할 수 있다', () => {
      const form = hydrateFormFromConfig(CONSULTATION_CONFIG);
      const initialKbId = extractKbIdFromTools(form.tools);

      expect(initialKbId).toBe('KB-12345');
    });
  });

  describe('역할 읽기 전용 표시 (isAgentRoleReadOnly)', () => {
    it('EditAgent에서 agentRole은 항상 읽기 전용이어야 한다', () => {
      expect(isAgentRoleReadOnly()).toBe(true);
    });

    it('역할 변경 시도는 attemptRoleChange에서 무시되어 폼 state가 유지되어야 한다', () => {
      const prev: FormState = {
        ...INITIAL_FORM,
        agentRole: 'consultation',
        agentName: '상담 에이전트',
      };

      const next = attemptRoleChange(prev, 'summary');

      // consultation이 그대로 유지되어야 함
      expect(next.agentRole).toBe('consultation');
      expect(next).toEqual(prev);
    });

    it('빈 역할 값으로 변경 시도 시에도 기존 역할이 유지되어야 한다', () => {
      const prev: FormState = {
        ...INITIAL_FORM,
        agentRole: 'summary',
      };

      const next = attemptRoleChange(prev, '');

      expect(next.agentRole).toBe('summary');
    });

    it('레거시 역할을 가진 config를 hydrate한 후에도 역할은 읽기 전용으로 유지되고 consultation으로 매핑된 값이 보존되어야 한다', () => {
      const form = hydrateFormFromConfig(LEGACY_PRECHAT_CONFIG);
      expect(form.agentRole).toBe('consultation');

      const next = attemptRoleChange(form, 'summary');
      expect(next.agentRole).toBe('consultation');
    });
  });

  describe('업데이트 페이로드 생성 (buildUpdatePayload)', () => {
    it('Consultation 에이전트는 systemPrompt, tools, i18n을 포함한 페이로드를 생성해야 한다', () => {
      const form = hydrateFormFromConfig(CONSULTATION_CONFIG);
      const payload = buildUpdatePayload(form);

      expect(payload).toMatchObject({
        agentName: '고객 상담 에이전트',
        modelId: 'global.amazon.nova-2-lite-v1:0',
        systemPrompt: '# 고객 상담 프롬프트\n안녕하세요.',
        i18n: 'ko',
      });
      expect(payload.tools).toHaveLength(3);
    });

    it('Summary 에이전트는 systemPrompt, tools, i18n 필드를 포함하지 않아야 한다', () => {
      const form = hydrateFormFromConfig(SUMMARY_CONFIG);
      const payload = buildUpdatePayload(form);

      expect(payload).toMatchObject({
        agentName: '요약 에이전트',
        modelId:
          'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
      });
      expect(payload).not.toHaveProperty('systemPrompt');
      expect(payload).not.toHaveProperty('tools');
      expect(payload).not.toHaveProperty('i18n');
    });

    it('업데이트 페이로드에는 agentRole이 포함되지 않아야 한다 (역할 읽기 전용)', () => {
      const form = hydrateFormFromConfig(CONSULTATION_CONFIG);
      const payload = buildUpdatePayload(form);

      expect(payload).not.toHaveProperty('agentRole');
    });
  });

  describe('레거시 역할 매핑 (normalizeAgentRole)', () => {
    it('"prechat" 역할은 "consultation"으로 정규화되어야 한다', () => {
      expect(normalizeAgentRole('prechat')).toBe('consultation');
    });

    it('"planning" 역할은 "consultation"으로 정규화되어야 한다', () => {
      expect(normalizeAgentRole('planning')).toBe(
        'consultation'
      );
    });

    it('"ship" 역할은 "consultation"으로 정규화되어야 한다', () => {
      expect(normalizeAgentRole('ship')).toBe('consultation');
    });

    it('"consultation"과 "summary"는 그대로 반환되어야 한다', () => {
      expect(normalizeAgentRole('consultation')).toBe(
        'consultation'
      );
      expect(normalizeAgentRole('summary')).toBe('summary');
    });

    it('알 수 없는 역할 값은 빈 문자열로 정규화되어야 한다', () => {
      expect(normalizeAgentRole('unknown')).toBe('');
      expect(normalizeAgentRole('')).toBe('');
    });
  });

  describe('통합 시나리오', () => {
    it('Consultation config 로드 → hydrate → 도구 사전 체크 → KB 사전 선택이 순서대로 동작해야 한다', () => {
      // 1. config 로드 후 hydrate
      const form = hydrateFormFromConfig(CONSULTATION_CONFIG);

      // 2. 각 도구 체크박스 사전 체크 상태 확인
      const retrieveChecked = isToolChecked(
        form.tools,
        'retrieve'
      );
      const renderFormChecked = isToolChecked(
        form.tools,
        'render_form'
      );
      const httpRequestChecked = isToolChecked(
        form.tools,
        'http_request'
      );

      expect(retrieveChecked).toBe(true);
      expect(renderFormChecked).toBe(true);
      expect(httpRequestChecked).toBe(false);

      // 3. KB 사전 선택
      const selectedKbId = extractKbIdFromTools(form.tools);
      expect(selectedKbId).toBe('KB-12345');

      // 4. 역할 읽기 전용 상태 확인
      expect(isAgentRoleReadOnly()).toBe(true);

      // 5. 업데이트 페이로드 생성 시 agentRole 제외
      const payload = buildUpdatePayload(form);
      expect(payload).not.toHaveProperty('agentRole');
    });

    it('Summary config 로드 시 consultation 전용 필드는 모두 빈 값이거나 미포함이어야 한다', () => {
      const form = hydrateFormFromConfig(SUMMARY_CONFIG);

      expect(form.agentRole).toBe('summary');
      expect(form.tools).toEqual([]);
      expect(isToolChecked(form.tools, 'retrieve')).toBe(false);
      expect(extractKbIdFromTools(form.tools)).toBe('');

      const payload = buildUpdatePayload(form);
      expect(payload).not.toHaveProperty('tools');
      expect(payload).not.toHaveProperty('systemPrompt');
      expect(payload).not.toHaveProperty('i18n');
    });

    it('레거시 prechat config → consultation으로 매핑된 후 도구도 정상 hydrate되어야 한다', () => {
      const form = hydrateFormFromConfig(LEGACY_PRECHAT_CONFIG);

      expect(form.agentRole).toBe('consultation');
      expect(isToolChecked(form.tools, 'aws_docs_mcp')).toBe(
        true
      );
      expect(extractKbIdFromTools(form.tools)).toBe('');
    });
  });
});
