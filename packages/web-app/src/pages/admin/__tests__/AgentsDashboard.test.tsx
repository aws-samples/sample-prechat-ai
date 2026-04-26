/**
 * AgentsDashboard 페이지 단위 테스트
 *
 * AgentsDashboard 컴포넌트의 핵심 목록 표시 로직을 검증합니다:
 * - 역할 필터링 (filterByRole): 'all' / 'consultation' / 'summary'
 *   및 레거시 역할(prechat/planning/ship) 포함 처리
 * - 도구 Badge 표시 (getToolBadgeLabels): Consultation 에이전트의
 *   tool_name 배열을 Badge 라벨로 반환, Summary는 빈 배열
 * - 레거시 역할 매핑 표시 (getDisplayRoleLabel):
 *   prechat/planning/ship → 'Consultation' 표시 라벨 매핑
 *
 * 테스트 환경이 node이므로, 컴포넌트의 핵심 로직(필터 predicate,
 * Badge 라벨 추출, 역할 라벨 매핑)을 순수 함수로 추출하여 단위
 * 테스트합니다.
 *
 * **Validates: Requirements 14.1, 14.2, 14.4**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  AgentConfiguration,
  AgentRole,
  ToolConfig,
} from '../../../types';

// --- AgentsDashboard 페이지의 핵심 로직 재현 ---

/**
 * 레거시 역할 목록.
 * AgentsDashboard.tsx의 LEGACY_ROLES 상수를 동일하게 재현한다.
 */
const LEGACY_ROLES = ['prechat', 'planning', 'ship'] as const;

type RoleFilterValue = 'all' | 'consultation' | 'summary';

/**
 * 역할 필터 헬퍼: roleFilter 값에 따라 AgentConfig 목록을 필터링.
 * - 'all': 전체 반환 (필터 없음)
 * - 'consultation': consultation + 레거시 역할(prechat/planning/ship)
 *   모두 포함
 * - 'summary': summary 역할만 반환
 *
 * AgentsDashboard의 tools 컬럼 isConsultation 판정 로직과
 * 동일한 규칙으로 레거시 역할을 consultation으로 취급한다.
 */
const filterByRole = (
  configs: AgentConfiguration[],
  roleFilter: RoleFilterValue
): AgentConfiguration[] => {
  if (roleFilter === 'all') {
    return configs;
  }
  if (roleFilter === 'consultation') {
    return configs.filter(
      (c) =>
        c.agentRole === 'consultation' ||
        (LEGACY_ROLES as readonly string[]).includes(c.agentRole)
    );
  }
  // 'summary'
  return configs.filter((c) => c.agentRole === 'summary');
};

/**
 * 도구 Badge 라벨 추출 헬퍼.
 * AgentsDashboard의 'tools' 컬럼 cell 렌더링 로직을 재현한다.
 * - Consultation 또는 레거시 역할의 에이전트: tools 배열에서
 *   각 tool_name을 Badge 라벨로 반환
 * - Summary 에이전트: 도구 컬럼에 '—' 표시 → 빈 배열
 * - tools 가 없거나 빈 배열: 빈 배열
 */
const getToolBadgeLabels = (
  agent: AgentConfiguration
): string[] => {
  const role = agent.agentRole as string;
  const isConsultation =
    role === 'consultation' ||
    (LEGACY_ROLES as readonly string[]).includes(role);

  if (!isConsultation) {
    return [];
  }
  if (!agent.tools || agent.tools.length === 0) {
    return [];
  }
  return agent.tools.map((t) => t.tool_name);
};

/**
 * 에이전트 역할 표시 라벨 매핑 헬퍼.
 * AgentsDashboard의 getDisplayRole 함수를 재현한다.
 * - 'consultation' → 'Consultation'
 * - 'summary' → 'Summary'
 * - 레거시 역할(prechat/planning/ship) → 'Consultation'
 *   (하위 호환성 매핑)
 */
const getDisplayRoleLabel = (role: string): string => {
  if (role === 'summary') return 'Summary';
  // consultation 또는 레거시 역할 모두 Consultation
  return 'Consultation';
};

// --- 테스트 고정 데이터 ---

const CONSULTATION_AGENT: AgentConfiguration = {
  configId: 'cfg-consult-001',
  agentRole: 'consultation',
  agentName: '고객 상담 에이전트',
  systemPrompt: '# 고객 상담 프롬프트',
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

const SUMMARY_AGENT: AgentConfiguration = {
  configId: 'cfg-summary-001',
  agentRole: 'summary',
  agentName: '요약 에이전트',
  systemPrompt: '',
  modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
  i18n: 'ko',
  tools: [],
};

const LEGACY_PRECHAT_AGENT: AgentConfiguration = {
  configId: 'cfg-legacy-prechat',
  agentRole: 'prechat' as AgentRole,
  agentName: '레거시 PreChat 에이전트',
  systemPrompt: '# 레거시 프롬프트',
  modelId: 'global.amazon.nova-2-lite-v1:0',
  i18n: 'ko',
  tools: [{ tool_name: 'aws_docs_mcp' }],
};

const LEGACY_PLANNING_AGENT: AgentConfiguration = {
  configId: 'cfg-legacy-planning',
  agentRole: 'planning' as AgentRole,
  agentName: '레거시 Planning 에이전트',
  systemPrompt: '# 플래닝 프롬프트',
  modelId: 'global.amazon.nova-2-lite-v1:0',
  i18n: 'ko',
  tools: [
    { tool_name: 'http_request' },
    { tool_name: 'current_time' },
  ],
};

const LEGACY_SHIP_AGENT: AgentConfiguration = {
  configId: 'cfg-legacy-ship',
  agentRole: 'ship' as AgentRole,
  agentName: '레거시 SHIP 에이전트',
  systemPrompt: '# SHIP 프롬프트',
  modelId: 'global.amazon.nova-2-lite-v1:0',
  i18n: 'ko',
  tools: [{ tool_name: 'extract_a2t_log' }],
};

const ALL_AGENTS: AgentConfiguration[] = [
  CONSULTATION_AGENT,
  SUMMARY_AGENT,
  LEGACY_PRECHAT_AGENT,
  LEGACY_PLANNING_AGENT,
  LEGACY_SHIP_AGENT,
];

// --- 테스트 ---

describe('AgentsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('역할 필터링 (filterByRole)', () => {
    it('필터가 "all"이면 전체 에이전트 목록을 반환해야 한다', () => {
      const result = filterByRole(ALL_AGENTS, 'all');

      expect(result).toHaveLength(5);
      expect(result).toEqual(ALL_AGENTS);
    });

    it('필터가 "consultation"이면 consultation 역할 에이전트만 반환해야 한다', () => {
      const configs: AgentConfiguration[] = [
        CONSULTATION_AGENT,
        SUMMARY_AGENT,
      ];

      const result = filterByRole(configs, 'consultation');

      expect(result).toHaveLength(1);
      expect(result[0].configId).toBe('cfg-consult-001');
    });

    it('필터가 "consultation"이면 레거시 역할(prechat)도 함께 반환해야 한다', () => {
      const configs: AgentConfiguration[] = [
        CONSULTATION_AGENT,
        LEGACY_PRECHAT_AGENT,
        SUMMARY_AGENT,
      ];

      const result = filterByRole(configs, 'consultation');

      expect(result).toHaveLength(2);
      expect(result.map((c) => c.configId)).toEqual([
        'cfg-consult-001',
        'cfg-legacy-prechat',
      ]);
    });

    it('필터가 "consultation"이면 레거시 역할(planning, ship)도 모두 포함해야 한다', () => {
      const result = filterByRole(ALL_AGENTS, 'consultation');

      expect(result).toHaveLength(4);
      const ids = result.map((c) => c.configId);
      expect(ids).toContain('cfg-consult-001');
      expect(ids).toContain('cfg-legacy-prechat');
      expect(ids).toContain('cfg-legacy-planning');
      expect(ids).toContain('cfg-legacy-ship');
      expect(ids).not.toContain('cfg-summary-001');
    });

    it('필터가 "summary"이면 summary 역할 에이전트만 반환해야 한다', () => {
      const result = filterByRole(ALL_AGENTS, 'summary');

      expect(result).toHaveLength(1);
      expect(result[0].configId).toBe('cfg-summary-001');
      expect(result[0].agentRole).toBe('summary');
    });

    it('필터가 "summary"이면 레거시 역할 에이전트는 제외되어야 한다', () => {
      const configs: AgentConfiguration[] = [
        SUMMARY_AGENT,
        LEGACY_PRECHAT_AGENT,
        LEGACY_PLANNING_AGENT,
      ];

      const result = filterByRole(configs, 'summary');

      expect(result).toHaveLength(1);
      expect(result[0].agentRole).toBe('summary');
    });

    it('빈 목록에 어떤 필터를 적용해도 빈 배열이 반환되어야 한다', () => {
      expect(filterByRole([], 'all')).toEqual([]);
      expect(filterByRole([], 'consultation')).toEqual([]);
      expect(filterByRole([], 'summary')).toEqual([]);
    });

    it('consultation 에이전트만 있을 때 "summary" 필터는 빈 배열을 반환해야 한다', () => {
      const configs = [CONSULTATION_AGENT];

      const result = filterByRole(configs, 'summary');

      expect(result).toEqual([]);
    });
  });

  describe('도구 Badge 표시 (getToolBadgeLabels)', () => {
    it('Consultation 에이전트는 tools 배열의 각 tool_name을 Badge 라벨로 반환해야 한다', () => {
      const labels = getToolBadgeLabels(CONSULTATION_AGENT);

      expect(labels).toEqual([
        'retrieve',
        'render_form',
        'current_time',
      ]);
    });

    it('Summary 에이전트는 tools 가 있어도 빈 배열을 반환해야 한다', () => {
      const summaryWithTools: AgentConfiguration = {
        ...SUMMARY_AGENT,
        tools: [{ tool_name: 'retrieve' }],
      };

      const labels = getToolBadgeLabels(summaryWithTools);

      expect(labels).toEqual([]);
    });

    it('Summary 에이전트(빈 tools)는 빈 배열을 반환해야 한다', () => {
      const labels = getToolBadgeLabels(SUMMARY_AGENT);

      expect(labels).toEqual([]);
    });

    it('Consultation 에이전트의 tools 가 빈 배열이면 빈 배열을 반환해야 한다', () => {
      const emptyConsult: AgentConfiguration = {
        ...CONSULTATION_AGENT,
        tools: [],
      };

      const labels = getToolBadgeLabels(emptyConsult);

      expect(labels).toEqual([]);
    });

    it('Consultation 에이전트의 tools 필드가 누락되어도 빈 배열을 반환해야 한다', () => {
      const noToolsConsult: AgentConfiguration = {
        ...CONSULTATION_AGENT,
        tools: undefined as unknown as ToolConfig[],
      };

      const labels = getToolBadgeLabels(noToolsConsult);

      expect(labels).toEqual([]);
    });

    it('레거시 prechat 역할 에이전트도 Consultation으로 취급되어 도구 Badge 라벨을 반환해야 한다', () => {
      const labels = getToolBadgeLabels(LEGACY_PRECHAT_AGENT);

      expect(labels).toEqual(['aws_docs_mcp']);
    });

    it('레거시 planning 역할 에이전트도 도구 Badge 라벨을 반환해야 한다', () => {
      const labels = getToolBadgeLabels(
        LEGACY_PLANNING_AGENT
      );

      expect(labels).toEqual(['http_request', 'current_time']);
    });

    it('레거시 ship 역할 에이전트도 도구 Badge 라벨을 반환해야 한다', () => {
      const labels = getToolBadgeLabels(LEGACY_SHIP_AGENT);

      expect(labels).toEqual(['extract_a2t_log']);
    });

    it('도구가 여러 개인 Consultation 에이전트는 정의된 순서대로 Badge 라벨을 반환해야 한다', () => {
      const multiToolConsult: AgentConfiguration = {
        ...CONSULTATION_AGENT,
        tools: [
          { tool_name: 'retrieve' },
          { tool_name: 'render_form' },
          { tool_name: 'aws_docs_mcp' },
          { tool_name: 'http_request' },
          { tool_name: 'extract_a2t_log' },
          { tool_name: 'current_time' },
        ],
      };

      const labels = getToolBadgeLabels(multiToolConsult);

      expect(labels).toEqual([
        'retrieve',
        'render_form',
        'aws_docs_mcp',
        'http_request',
        'extract_a2t_log',
        'current_time',
      ]);
    });
  });

  describe('레거시 역할 매핑 표시 (getDisplayRoleLabel)', () => {
    it('"consultation" 역할은 "Consultation" 라벨로 표시되어야 한다', () => {
      expect(getDisplayRoleLabel('consultation')).toBe(
        'Consultation'
      );
    });

    it('"summary" 역할은 "Summary" 라벨로 표시되어야 한다', () => {
      expect(getDisplayRoleLabel('summary')).toBe('Summary');
    });

    it('레거시 "prechat" 역할은 "Consultation" 라벨로 매핑되어 표시되어야 한다', () => {
      expect(getDisplayRoleLabel('prechat')).toBe(
        'Consultation'
      );
    });

    it('레거시 "planning" 역할은 "Consultation" 라벨로 매핑되어 표시되어야 한다', () => {
      expect(getDisplayRoleLabel('planning')).toBe(
        'Consultation'
      );
    });

    it('레거시 "ship" 역할은 "Consultation" 라벨로 매핑되어 표시되어야 한다', () => {
      expect(getDisplayRoleLabel('ship')).toBe(
        'Consultation'
      );
    });

    it('알 수 없는 역할 값은 기본적으로 "Consultation"으로 표시되어야 한다 (fallback)', () => {
      // AgentsDashboard는 summary가 아니면 모두 Consultation으로 처리
      expect(getDisplayRoleLabel('unknown')).toBe(
        'Consultation'
      );
      expect(getDisplayRoleLabel('')).toBe('Consultation');
    });
  });

  describe('통합 시나리오', () => {
    it('전체 목록에서 "consultation" 필터 적용 후 각 에이전트의 도구 Badge를 추출할 수 있어야 한다', () => {
      const filtered = filterByRole(
        ALL_AGENTS,
        'consultation'
      );

      const toolsByAgent = filtered.map((a) => ({
        configId: a.configId,
        tools: getToolBadgeLabels(a),
      }));

      expect(toolsByAgent).toEqual([
        {
          configId: 'cfg-consult-001',
          tools: ['retrieve', 'render_form', 'current_time'],
        },
        {
          configId: 'cfg-legacy-prechat',
          tools: ['aws_docs_mcp'],
        },
        {
          configId: 'cfg-legacy-planning',
          tools: ['http_request', 'current_time'],
        },
        {
          configId: 'cfg-legacy-ship',
          tools: ['extract_a2t_log'],
        },
      ]);
    });

    it('전체 목록에서 "summary" 필터 적용 후 도구 Badge는 빈 배열이어야 한다', () => {
      const filtered = filterByRole(ALL_AGENTS, 'summary');

      const badges = filtered.map((a) =>
        getToolBadgeLabels(a)
      );

      expect(filtered).toHaveLength(1);
      expect(badges).toEqual([[]]);
    });

    it('레거시 에이전트는 "consultation" 필터로 포함되고 "Consultation" 라벨로 표시되어야 한다', () => {
      const filtered = filterByRole(
        ALL_AGENTS,
        'consultation'
      );

      const labels = filtered.map((a) =>
        getDisplayRoleLabel(a.agentRole)
      );

      // 필터링된 4개 에이전트 모두 'Consultation' 라벨
      expect(labels).toEqual([
        'Consultation',
        'Consultation',
        'Consultation',
        'Consultation',
      ]);
    });

    it('"all" 필터에서 각 에이전트 역할 라벨은 consultation/summary/레거시별로 올바르게 매핑되어야 한다', () => {
      const labels = ALL_AGENTS.map((a) =>
        getDisplayRoleLabel(a.agentRole)
      );

      expect(labels).toEqual([
        'Consultation', // consultation
        'Summary', // summary
        'Consultation', // prechat → Consultation
        'Consultation', // planning → Consultation
        'Consultation', // ship → Consultation
      ]);
    });
  });
});
