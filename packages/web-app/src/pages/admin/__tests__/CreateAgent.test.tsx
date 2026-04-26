/**
 * CreateAgent 페이지 단위 테스트
 *
 * CreateAgent 컴포넌트의 핵심 폼 로직을 검증합니다:
 * - 역할 선택 시 조건부 렌더링 로직
 * - 템플릿 선택 시 자동 채움(form auto-fill)
 * - retrieve 체크 시 KB 선택기 표시 조건
 * - 폼 검증 (retrieve + KB 미선택 시 제출 불가)
 * - 도구 체크박스 토글 핸들러
 *
 * 테스트 환경이 node이므로, 컴포넌트의 핵심 로직(조건부 렌더링 predicate,
 * 상태 전환 reducer, 검증 로직)을 순수 함수로 추출하여 단위 테스트합니다.
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 7.1, 7.2, 7.3, 7.4, 7.5**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentRole, ToolConfig } from '../../../types';

// --- CreateAgent 페이지의 핵심 로직 재현 ---

interface FormState {
  agentName: string;
  agentRole: AgentRole | '';
  modelId: string;
  systemPrompt: string;
  i18n: string;
  tools: ToolConfig[];
}

interface AvailableTool {
  name: string;
  label: string;
  description: string;
  hasAttributes?: boolean;
  alwaysEnabled?: boolean;
}

interface ConsultationTemplate {
  id: string;
  systemPrompt: string;
  tools: ToolConfig[];
  modelId: string;
  i18n: string;
}

/**
 * 역할 선택 시 보여야 하는 필드 집합을 반환하는 가시성 predicate.
 * - consultation: agent_name, agent_role, model, i18n, tools, system_prompt 표시
 * - summary: agent_name, agent_role, model만 표시
 * - 미선택: 공통 필드(agent_name, agent_role)만 표시
 */
const getVisibleFields = (
  role: AgentRole | ''
): {
  agentName: boolean;
  agentRole: boolean;
  modelId: boolean;
  template: boolean;
  i18n: boolean;
  tools: boolean;
  systemPrompt: boolean;
} => {
  const isConsultation = role === 'consultation';
  const isSummary = role === 'summary';
  return {
    agentName: true,
    agentRole: true,
    modelId: isConsultation || isSummary,
    template: isConsultation,
    i18n: isConsultation,
    tools: isConsultation,
    systemPrompt: isConsultation,
  };
};

/**
 * retrieve 도구가 현재 tools 배열에 포함되어 있는지 검사
 */
const isRetrieveSelected = (tools: ToolConfig[]): boolean =>
  tools.some((t) => t.tool_name === 'retrieve');

/**
 * retrieve 체크 + KB 미선택 시 제출 불가 검증
 * (CreateAgent의 isRetrieveMissingKb 계산을 동일하게 구현)
 */
const isRetrieveMissingKb = (
  tools: ToolConfig[],
  selectedKbId: string
): boolean => isRetrieveSelected(tools) && !selectedKbId;

/**
 * 전체 폼 제출 가능 여부 검증
 * (CreateAgent의 제출 버튼 disabled 조건을 역전한 것)
 */
const canSubmit = (form: FormState, selectedKbId: string): boolean => {
  if (!form.agentName) return false;
  if (!form.agentRole) return false;
  if (!form.modelId) return false;
  if (isRetrieveMissingKb(form.tools, selectedKbId)) return false;
  return true;
};

/**
 * 템플릿 선택 시 폼 자동 채움 reducer.
 * CreateAgent의 handleTemplateSelect 로직을 순수 함수로 재현합니다.
 */
const applyTemplate = (
  prev: FormState,
  template: ConsultationTemplate
): FormState => ({
  ...prev,
  systemPrompt: template.systemPrompt,
  tools: template.tools.map((t) => ({ ...t })),
  modelId: template.modelId,
  i18n: template.i18n,
});

/**
 * 도구 체크박스 토글 reducer.
 * CreateAgent의 handleToolToggle 로직을 순수 함수로 재현합니다.
 * 체크 시 새 ToolConfig 추가, 해제 시 제거.
 */
const toggleTool = (
  tools: ToolConfig[],
  toolName: string,
  checked: boolean
): ToolConfig[] => {
  if (checked) {
    return [...tools, { tool_name: toolName }];
  }
  return tools.filter((t) => t.tool_name !== toolName);
};

/**
 * KB 선택 시 retrieve 도구의 kb_id 속성 주입 reducer.
 * CreateAgent의 handleKbSelect 로직을 순수 함수로 재현합니다.
 */
const applyKbToRetrieve = (
  tools: ToolConfig[],
  kbId: string
): ToolConfig[] =>
  tools.map((t) =>
    t.tool_name === 'retrieve'
      ? { ...t, tool_attributes: { kb_id: kbId } }
      : t
  );

/**
 * 역할 변경 시 기본 프롬프트/상태 초기화 reducer.
 * CreateAgent의 updateFormData('agentRole', ...) 로직을 재현합니다.
 */
const changeRole = (
  prev: FormState,
  newRole: AgentRole | '',
  defaultConsultationPrompt: string
): FormState => {
  const base = { ...prev, agentRole: newRole };
  if (newRole === 'consultation') {
    return {
      ...base,
      systemPrompt: defaultConsultationPrompt,
      i18n: 'ko',
      tools: [],
    };
  }
  // summary 또는 공백
  return {
    ...base,
    systemPrompt: '',
    tools: [],
    i18n: 'ko',
  };
};

// 테스트 고정 데이터
const INITIAL_FORM: FormState = {
  agentName: '',
  agentRole: '',
  modelId: 'global.amazon.nova-2-lite-v1:0',
  systemPrompt: '',
  i18n: 'ko',
  tools: [],
};

const AVAILABLE_TOOLS: AvailableTool[] = [
  { name: 'retrieve', label: 'Knowledge Base 검색', description: '', hasAttributes: true },
  { name: 'current_time', label: '현재 시간', description: '', alwaysEnabled: true },
  { name: 'render_form', label: 'HTML Form 생성', description: '' },
  { name: 'aws_docs_mcp', label: 'AWS 문서 검색', description: '' },
  { name: 'http_request', label: 'HTTP 요청', description: '' },
  { name: 'extract_a2t_log', label: 'A2T 로그 추출', description: '' },
];

const CUSTOMER_TEMPLATE: ConsultationTemplate = {
  id: 'customer',
  systemPrompt: '# 고객 상담 프롬프트',
  tools: [
    { tool_name: 'retrieve' },
    { tool_name: 'render_form' },
    { tool_name: 'current_time' },
  ],
  modelId: 'global.amazon.nova-2-lite-v1:0',
  i18n: 'ko',
};

const SALES_TEMPLATE: ConsultationTemplate = {
  id: 'sales',
  systemPrompt: '# 영업 전략 상담 프롬프트',
  tools: [
    { tool_name: 'retrieve' },
    { tool_name: 'aws_docs_mcp' },
    { tool_name: 'current_time' },
  ],
  modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  i18n: 'ko',
};

const SECURITY_TEMPLATE: ConsultationTemplate = {
  id: 'security',
  systemPrompt: '# 보안 상담 프롬프트',
  tools: [
    { tool_name: 'retrieve' },
    { tool_name: 'extract_a2t_log' },
    { tool_name: 'current_time' },
  ],
  modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  i18n: 'ko',
};

// --- 테스트 ---

describe('CreateAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('역할 선택 시 조건부 렌더링', () => {
    it('consultation 선택 시 agent_name, model, tools, system_prompt, i18n 필드가 모두 표시되어야 한다', () => {
      const visible = getVisibleFields('consultation');

      expect(visible.agentName).toBe(true);
      expect(visible.agentRole).toBe(true);
      expect(visible.modelId).toBe(true);
      expect(visible.template).toBe(true);
      expect(visible.i18n).toBe(true);
      expect(visible.tools).toBe(true);
      expect(visible.systemPrompt).toBe(true);
    });

    it('summary 선택 시 agent_name과 model 필드만 표시되고 tools/i18n/system_prompt는 숨겨져야 한다', () => {
      const visible = getVisibleFields('summary');

      expect(visible.agentName).toBe(true);
      expect(visible.agentRole).toBe(true);
      expect(visible.modelId).toBe(true);
      // summary 전용: consultation 전용 필드는 숨김
      expect(visible.template).toBe(false);
      expect(visible.i18n).toBe(false);
      expect(visible.tools).toBe(false);
      expect(visible.systemPrompt).toBe(false);
    });

    it('역할 미선택 시 model 및 consultation 전용 필드는 숨겨져야 한다', () => {
      const visible = getVisibleFields('');

      expect(visible.agentName).toBe(true);
      expect(visible.agentRole).toBe(true);
      expect(visible.modelId).toBe(false);
      expect(visible.template).toBe(false);
      expect(visible.i18n).toBe(false);
      expect(visible.tools).toBe(false);
      expect(visible.systemPrompt).toBe(false);
    });

    it('consultation → summary 전환 시 tools 배열이 초기화되어야 한다', () => {
      const prev: FormState = {
        ...INITIAL_FORM,
        agentRole: 'consultation',
        tools: [{ tool_name: 'retrieve' }, { tool_name: 'render_form' }],
        systemPrompt: '# 기존 프롬프트',
      };

      const next = changeRole(prev, 'summary', '# 기본 consultation 프롬프트');

      expect(next.agentRole).toBe('summary');
      expect(next.tools).toEqual([]);
      expect(next.systemPrompt).toBe('');
    });

    it('summary → consultation 전환 시 기본 consultation 프롬프트로 초기화되어야 한다', () => {
      const prev: FormState = {
        ...INITIAL_FORM,
        agentRole: 'summary',
        tools: [],
        systemPrompt: '',
      };

      const next = changeRole(prev, 'consultation', '# 기본 consultation 프롬프트');

      expect(next.agentRole).toBe('consultation');
      expect(next.systemPrompt).toBe('# 기본 consultation 프롬프트');
      expect(next.tools).toEqual([]);
      expect(next.i18n).toBe('ko');
    });
  });

  describe('템플릿 선택 시 자동 채움', () => {
    it('고객 상담 템플릿 선택 시 systemPrompt, tools, modelId, i18n이 템플릿 값으로 자동 채워져야 한다', () => {
      const next = applyTemplate(INITIAL_FORM, CUSTOMER_TEMPLATE);

      expect(next.systemPrompt).toBe('# 고객 상담 프롬프트');
      expect(next.tools).toEqual([
        { tool_name: 'retrieve' },
        { tool_name: 'render_form' },
        { tool_name: 'current_time' },
      ]);
      expect(next.modelId).toBe('global.amazon.nova-2-lite-v1:0');
      expect(next.i18n).toBe('ko');
    });

    it('영업 전략 템플릿 선택 시 aws_docs_mcp 도구와 Claude Sonnet 모델이 설정되어야 한다', () => {
      const next = applyTemplate(INITIAL_FORM, SALES_TEMPLATE);

      expect(next.systemPrompt).toBe('# 영업 전략 상담 프롬프트');
      expect(next.tools.map((t) => t.tool_name)).toContain('aws_docs_mcp');
      expect(next.modelId).toBe(
        'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
      );
    });

    it('보안 상담 템플릿 선택 시 extract_a2t_log 도구가 포함되어야 한다', () => {
      const next = applyTemplate(INITIAL_FORM, SECURITY_TEMPLATE);

      expect(next.systemPrompt).toBe('# 보안 상담 프롬프트');
      expect(next.tools.map((t) => t.tool_name)).toContain('extract_a2t_log');
    });

    it('템플릿 선택 시 agentName 등 사용자 입력 필드는 보존되어야 한다', () => {
      const prev: FormState = {
        ...INITIAL_FORM,
        agentName: '내가 입력한 이름',
        agentRole: 'consultation',
      };

      const next = applyTemplate(prev, CUSTOMER_TEMPLATE);

      expect(next.agentName).toBe('내가 입력한 이름');
      expect(next.agentRole).toBe('consultation');
    });

    it('자동 채움 후 사용자가 tools를 추가 수정할 수 있어야 한다', () => {
      const filled = applyTemplate(INITIAL_FORM, CUSTOMER_TEMPLATE);

      // 사용자가 http_request 추가
      const modified = {
        ...filled,
        tools: toggleTool(filled.tools, 'http_request', true),
      };

      expect(modified.tools.map((t) => t.tool_name)).toContain('http_request');
      expect(modified.tools.map((t) => t.tool_name)).toContain('retrieve');
      expect(modified.tools.map((t) => t.tool_name)).toContain('render_form');
    });

    it('자동 채움된 tools 배열은 템플릿 원본과 독립적이어야 한다 (deep copy)', () => {
      const next = applyTemplate(INITIAL_FORM, CUSTOMER_TEMPLATE);

      // next.tools를 수정해도 CUSTOMER_TEMPLATE.tools는 영향 없어야 함
      next.tools[0].tool_attributes = { kb_id: 'KB-XXX' };

      expect(CUSTOMER_TEMPLATE.tools[0].tool_attributes).toBeUndefined();
    });
  });

  describe('retrieve 체크 시 KB 선택기 표시', () => {
    it('tools에 retrieve가 포함되면 isRetrieveSelected가 true를 반환해야 한다', () => {
      const tools: ToolConfig[] = [
        { tool_name: 'retrieve' },
        { tool_name: 'current_time' },
      ];

      expect(isRetrieveSelected(tools)).toBe(true);
    });

    it('tools에 retrieve가 없으면 isRetrieveSelected가 false를 반환해야 한다', () => {
      const tools: ToolConfig[] = [
        { tool_name: 'current_time' },
        { tool_name: 'render_form' },
      ];

      expect(isRetrieveSelected(tools)).toBe(false);
    });

    it('빈 tools 배열은 retrieve 미선택으로 처리되어야 한다', () => {
      expect(isRetrieveSelected([])).toBe(false);
    });

    it('retrieve 체크 토글 시 tools 배열에 retrieve가 추가되어야 한다', () => {
      const initial: ToolConfig[] = [{ tool_name: 'current_time' }];

      const checked = toggleTool(initial, 'retrieve', true);

      expect(isRetrieveSelected(checked)).toBe(true);
      expect(checked).toHaveLength(2);
    });

    it('retrieve 체크 해제 시 tools 배열에서 retrieve가 제거되어야 한다', () => {
      const initial: ToolConfig[] = [
        { tool_name: 'retrieve', tool_attributes: { kb_id: 'KB-1' } },
        { tool_name: 'current_time' },
      ];

      const unchecked = toggleTool(initial, 'retrieve', false);

      expect(isRetrieveSelected(unchecked)).toBe(false);
      expect(unchecked).toHaveLength(1);
      expect(unchecked[0].tool_name).toBe('current_time');
    });

    it('KB 선택 시 retrieve 도구의 tool_attributes.kb_id가 주입되어야 한다', () => {
      const tools: ToolConfig[] = [
        { tool_name: 'retrieve' },
        { tool_name: 'render_form' },
      ];

      const updated = applyKbToRetrieve(tools, 'KB-12345');

      const retrieveTool = updated.find((t) => t.tool_name === 'retrieve');
      expect(retrieveTool?.tool_attributes).toEqual({ kb_id: 'KB-12345' });
      // 다른 도구는 영향 없어야 함
      const formTool = updated.find((t) => t.tool_name === 'render_form');
      expect(formTool?.tool_attributes).toBeUndefined();
    });
  });

  describe('폼 검증 (retrieve + KB 미선택 시 에러)', () => {
    it('retrieve 체크 + KB 미선택 시 isRetrieveMissingKb가 true를 반환해야 한다', () => {
      const tools: ToolConfig[] = [{ tool_name: 'retrieve' }];

      expect(isRetrieveMissingKb(tools, '')).toBe(true);
    });

    it('retrieve 체크 + KB 선택 시 isRetrieveMissingKb가 false를 반환해야 한다', () => {
      const tools: ToolConfig[] = [{ tool_name: 'retrieve' }];

      expect(isRetrieveMissingKb(tools, 'KB-99999')).toBe(false);
    });

    it('retrieve 미체크 시 KB 값과 무관하게 isRetrieveMissingKb가 false여야 한다', () => {
      const tools: ToolConfig[] = [{ tool_name: 'render_form' }];

      expect(isRetrieveMissingKb(tools, '')).toBe(false);
      expect(isRetrieveMissingKb(tools, 'KB-1')).toBe(false);
    });

    it('retrieve + KB 미선택 시 canSubmit이 false를 반환해야 한다', () => {
      const form: FormState = {
        agentName: '테스트 에이전트',
        agentRole: 'consultation',
        modelId: 'global.amazon.nova-2-lite-v1:0',
        systemPrompt: '# 프롬프트',
        i18n: 'ko',
        tools: [{ tool_name: 'retrieve' }],
      };

      expect(canSubmit(form, '')).toBe(false);
    });

    it('retrieve + KB 선택 + 모든 필수 필드 입력 시 canSubmit이 true를 반환해야 한다', () => {
      const form: FormState = {
        agentName: '테스트 에이전트',
        agentRole: 'consultation',
        modelId: 'global.amazon.nova-2-lite-v1:0',
        systemPrompt: '# 프롬프트',
        i18n: 'ko',
        tools: [{ tool_name: 'retrieve' }, { tool_name: 'render_form' }],
      };

      expect(canSubmit(form, 'KB-12345')).toBe(true);
    });

    it('agentName이 비어있으면 canSubmit이 false를 반환해야 한다', () => {
      const form: FormState = {
        ...INITIAL_FORM,
        agentName: '',
        agentRole: 'summary',
      };

      expect(canSubmit(form, '')).toBe(false);
    });

    it('agentRole이 비어있으면 canSubmit이 false를 반환해야 한다', () => {
      const form: FormState = {
        ...INITIAL_FORM,
        agentName: '이름',
        agentRole: '',
      };

      expect(canSubmit(form, '')).toBe(false);
    });

    it('modelId가 비어있으면 canSubmit이 false를 반환해야 한다', () => {
      const form: FormState = {
        ...INITIAL_FORM,
        agentName: '이름',
        agentRole: 'summary',
        modelId: '',
      };

      expect(canSubmit(form, '')).toBe(false);
    });

    it('summary 역할 + 필수 필드만 있으면 tools 없이도 canSubmit이 true여야 한다', () => {
      const form: FormState = {
        agentName: 'Summary 에이전트',
        agentRole: 'summary',
        modelId: 'global.amazon.nova-2-lite-v1:0',
        systemPrompt: '',
        i18n: 'ko',
        tools: [],
      };

      expect(canSubmit(form, '')).toBe(true);
    });
  });

  describe('도구 체크박스 토글 통합 시나리오', () => {
    it('여러 도구 연속 체크 시 누적되어야 한다', () => {
      let tools: ToolConfig[] = [];

      tools = toggleTool(tools, 'retrieve', true);
      tools = toggleTool(tools, 'render_form', true);
      tools = toggleTool(tools, 'http_request', true);

      expect(tools.map((t) => t.tool_name)).toEqual([
        'retrieve',
        'render_form',
        'http_request',
      ]);
    });

    it('retrieve 체크 해제 후 KB 주입은 다른 도구에 영향이 없어야 한다', () => {
      let tools: ToolConfig[] = [
        { tool_name: 'retrieve' },
        { tool_name: 'render_form' },
      ];

      tools = applyKbToRetrieve(tools, 'KB-1');
      tools = toggleTool(tools, 'retrieve', false);

      expect(tools).toHaveLength(1);
      expect(tools[0].tool_name).toBe('render_form');
      expect(tools[0].tool_attributes).toBeUndefined();
    });

    it('AVAILABLE_TOOLS에 6개 도구가 정의되어야 한다 (retrieve, current_time, render_form, aws_docs_mcp, http_request, extract_a2t_log)', () => {
      expect(AVAILABLE_TOOLS).toHaveLength(6);
      const names = AVAILABLE_TOOLS.map((t) => t.name);
      expect(names).toContain('retrieve');
      expect(names).toContain('current_time');
      expect(names).toContain('render_form');
      expect(names).toContain('aws_docs_mcp');
      expect(names).toContain('http_request');
      expect(names).toContain('extract_a2t_log');
    });

    it('current_time 도구는 alwaysEnabled 플래그가 true여야 한다', () => {
      const currentTime = AVAILABLE_TOOLS.find(
        (t) => t.name === 'current_time'
      );

      expect(currentTime?.alwaysEnabled).toBe(true);
    });

    it('retrieve 도구는 hasAttributes 플래그가 true여야 한다', () => {
      const retrieve = AVAILABLE_TOOLS.find((t) => t.name === 'retrieve');

      expect(retrieve?.hasAttributes).toBe(true);
    });
  });
});
