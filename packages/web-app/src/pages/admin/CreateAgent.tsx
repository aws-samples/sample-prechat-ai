// nosemgrep
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Header,
  Form,
  FormField,
  Input,
  Button,
  SpaceBetween,
  Alert,
  Select,
  Textarea,
  Checkbox,
  Box,
} from '@cloudscape-design/components';
import { adminApi } from '../../services/api';
import { BEDROCK_MODELS } from '../../types';
import type {
  AgentRole,
  ToolConfig,
  KnowledgeBase,
} from '../../types';
import { PlaceholderTooltip } from '../../components';
import consultationPrompt from '../../assets/prechat-agent-prompt.md?raw';
import { useI18n } from '../../i18n';

const AGENT_ROLES: {
  value: AgentRole;
  label: string;
}[] = [
  { value: 'consultation', label: 'Consultation Agent' },
  { value: 'summary', label: 'Summary Agent' },
];

const DEFAULT_PROMPTS: Record<string, string> = {
  consultation: consultationPrompt,
};

const I18N_OPTIONS = [
  { value: 'ko', label: '한국어 (Korean)' },
  { value: 'en', label: 'English' },
];

interface AvailableTool {
  name: string;
  label: string;
  description: string;
  hasAttributes?: boolean;
  alwaysEnabled?: boolean;
}

const SALES_STRATEGY_PROMPT = `# 영업 전략 상담 AI 에이전트

## 역할

AWS 영업 전략 수립을 지원하는 대화형 AI 에이전트입니다.
고객의 비즈니스 상황을 파악하고, 경쟁 분석, 가격 전략,
Go-to-Market 전략 수립을 지원합니다.

## 대화 흐름

1. 고객사의 현재 클라우드 전략과 예산 규모를 파악합니다.
2. 주요 경쟁사 대비 AWS의 차별화 포인트를 분석합니다.
3. 가격 모델(On-Demand, RI, Savings Plans)을 비교 설명합니다.
4. 고객 맞춤형 영업 전략과 다음 단계를 제안합니다.
`;

const SECURITY_CONSULTATION_PROMPT = `# 보안 상담 AI 에이전트

## 역할

AWS 보안 평가 및 컴플라이언스 상담을 수행하는 AI 에이전트입니다.
고객의 보안 현황을 파악하고, AWS 보안 서비스 활용 방안과
SHIP(Security Health Improvement Program) 평가를 지원합니다.

## 대화 흐름

1. 고객의 현재 보안 체계와 컴플라이언스 요구사항을 파악합니다.
2. AWS 보안 서비스(GuardDuty, SecurityHub 등) 활용 현황을 확인합니다.
3. SHIP 보안 점검 프로세스와 기대 효과를 안내합니다.
4. 보안 개선 로드맵과 다음 단계를 제안합니다.
`;

interface ConsultationTemplate {
  id: string;
  labelKey: string;
  descriptionKey: string;
  systemPrompt: string;
  tools: ToolConfig[];
  modelId: string;
  i18n: string;
}

const CONSULTATION_TEMPLATES: ConsultationTemplate[] = [
  {
    id: 'customer',
    labelKey: 'adminAgentCreate.form.templateCustomer',
    descriptionKey: 'adminAgentCreate.form.templateCustomerDesc',
    systemPrompt: consultationPrompt,
    tools: [
      { tool_name: 'retrieve' },
      { tool_name: 'render_form' },
      { tool_name: 'current_time' },
    ],
    modelId: 'global.amazon.nova-2-lite-v1:0',
    i18n: 'ko',
  },
  {
    id: 'sales',
    labelKey: 'adminAgentCreate.form.templateSales',
    descriptionKey: 'adminAgentCreate.form.templateSalesDesc',
    systemPrompt: SALES_STRATEGY_PROMPT,
    tools: [
      { tool_name: 'retrieve' },
      { tool_name: 'aws_docs_mcp' },
      { tool_name: 'current_time' },
    ],
    modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
    i18n: 'ko',
  },
  {
    id: 'security',
    labelKey: 'adminAgentCreate.form.templateSecurity',
    descriptionKey: 'adminAgentCreate.form.templateSecurityDesc',
    systemPrompt: SECURITY_CONSULTATION_PROMPT,
    tools: [
      { tool_name: 'retrieve' },
      { tool_name: 'extract_a2t_log' },
      { tool_name: 'current_time' },
    ],
    modelId: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
    i18n: 'ko',
  },
];

const AVAILABLE_TOOLS: AvailableTool[] = [
  {
    name: 'retrieve',
    label: 'Knowledge Base 검색',
    description: 'Bedrock KB에서 유사 사례 검색',
    hasAttributes: true,
  },
  {
    name: 'current_time',
    label: '현재 시간',
    description: '현재 시간 조회 (항상 포함)',
    alwaysEnabled: true,
  },
  {
    name: 'render_form',
    label: 'HTML Form 생성',
    description: '고객 정보 수집용 동적 폼',
  },
  {
    name: 'aws_docs_mcp',
    label: 'AWS 문서 검색',
    description: 'AWS 공식 문서 MCP 검색',
  },
  {
    name: 'http_request',
    label: 'HTTP 요청',
    description: '외부 API 호출',
  },
  {
    name: 'extract_a2t_log',
    label: 'A2T 로그 추출',
    description: 'A2T 로그 데이터 추출',
  },
];

export default function CreateAgent() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [overridePrompt, setOverridePrompt] =
    useState(false);
  const [selectedKbId, setSelectedKbId] = useState('');
  const [knowledgeBases, setKnowledgeBases] = useState<
    KnowledgeBase[]
  >([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbError, setKbError] = useState('');
  const [selectedTemplate, setSelectedTemplate] =
    useState('');
  const [formData, setFormData] = useState({
    agentName: '',
    agentRole: '' as AgentRole | '',
    modelId: 'global.amazon.nova-2-lite-v1:0',
    systemPrompt: consultationPrompt,
    i18n: 'ko',
    tools: [] as ToolConfig[],
  });

  const isConsultation =
    formData.agentRole === 'consultation';
  const isSummary =
    formData.agentRole === 'summary';

  // retrieve 도구가 선택되었는지 확인
  const isRetrieveChecked = formData.tools.some(
    (t) => t.tool_name === 'retrieve'
  );

  // retrieve 체크 + KB 미선택 시 제출 비활성화
  const isRetrieveMissingKb =
    isRetrieveChecked && !selectedKbId;

  // KB 목록 조회: retrieve 체크 시 fetch
  useEffect(() => {
    if (!isRetrieveChecked) return;
    if (knowledgeBases.length > 0) return;
    setKbLoading(true);
    setKbError('');
    adminApi
      .fetchKnowledgeBases()
      .then((res) => {
        setKnowledgeBases(res.knowledgeBases || []);
      })
      .catch(() => {
        setKbError(
          t('adminAgentCreate.form.kbLoadError')
        );
      })
      .finally(() => {
        setKbLoading(false);
      });
  }, [isRetrieveChecked]); // eslint-disable-line

  // 도구 체크박스 토글 핸들러
  const handleToolToggle = (
    toolName: string,
    checked: boolean
  ) => {
    setFormData((prev) => {
      let updatedTools: ToolConfig[];
      if (checked) {
        updatedTools = [
          ...prev.tools,
          { tool_name: toolName },
        ];
      } else {
        updatedTools = prev.tools.filter(
          (t) => t.tool_name !== toolName
        );
        // retrieve 해제 시 KB 선택 초기화
        if (toolName === 'retrieve') {
          setSelectedKbId('');
        }
      }
      return { ...prev, tools: updatedTools };
    });
  };

  // KB 선택 핸들러
  const handleKbSelect = (kbId: string) => {
    setSelectedKbId(kbId);
    setFormData((prev) => {
      const updatedTools = prev.tools.map((t) => {
        if (t.tool_name === 'retrieve') {
          return {
            ...t,
            tool_attributes: { kb_id: kbId },
          };
        }
        return t;
      });
      return { ...prev, tools: updatedTools };
    });
  };

  // 템플릿 선택 핸들러
  const handleTemplateSelect = (
    templateId: string
  ) => {
    setSelectedTemplate(templateId);
    if (templateId === 'custom') return;
    const tpl = CONSULTATION_TEMPLATES.find(
      (t) => t.id === templateId
    );
    if (!tpl) return;
    setSelectedKbId('');
    setOverridePrompt(false);
    setFormData((prev) => ({
      ...prev,
      systemPrompt: tpl.systemPrompt,
      tools: tpl.tools.map((tool) => ({
        ...tool,
      })),
      modelId: tpl.modelId,
      i18n: tpl.i18n,
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await adminApi.createAgentConfig({
        agentRole: formData.agentRole as AgentRole,
        modelId: formData.modelId,
        agentName: formData.agentName,
        ...(isConsultation && {
          systemPrompt: formData.systemPrompt,
          tools: formData.tools,
          i18n: formData.i18n,
        }),
      });
      setSuccess(
        t('adminAgentCreate.alert.createdSuccess', {
          name: formData.agentName,
        })
      );
      setTimeout(
        () => navigate('/admin/agents'),
        3000
      );
    } catch (err) {
      setError(
        t('adminAgentCreate.alert.failedCreate')
      );
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (
    field: string,
    value: string
  ) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // 역할 변경 시 기본 프롬프트 및 상태 초기화
      if (field === 'agentRole') {
        if (value === 'consultation') {
          updated.systemPrompt =
            DEFAULT_PROMPTS.consultation;
          updated.i18n = 'ko';
          updated.tools = [];
        } else {
          updated.systemPrompt = '';
          updated.tools = [];
          updated.i18n = 'ko';
          setOverridePrompt(false);
        }
        setSelectedKbId('');
        setSelectedTemplate('');
      }
      return updated;
    });
  };

  const modelOptions = BEDROCK_MODELS.map((m) => ({
    label: `${m.name} (${m.provider})`,
    value: m.id,
  }));

  const kbOptions = knowledgeBases.map((kb) => ({
    label: `${kb.name} (${kb.knowledgeBaseId})`,
    value: kb.knowledgeBaseId,
  }));

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          actions={
            <Button
              variant="normal"
              onClick={() =>
                navigate('/admin/agents')
              }
            >
              {t(
                'adminAgentCreate.header.toDashboardButton'
              )}
            </Button>
          }
        >
          {t('adminAgentCreate.header.title')}
        </Header>

        {error && (
          <Alert type="error">{error}</Alert>
        )}
        {success && (
          <Alert type="success">{success}</Alert>
        )}

        <Form
          actions={
            <SpaceBetween
              direction="horizontal"
              size="xs"
            >
              <Button
                variant="link"
                onClick={() =>
                  navigate('/admin/agents')
                }
              >
                {t(
                  'adminAgentCreate.form.cancelButton'
                )}
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={
                  !formData.agentName ||
                  !formData.agentRole ||
                  !formData.modelId ||
                  isRetrieveMissingKb
                }
              >
                {t(
                  'adminAgentCreate.form.createAgentButton'
                )}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            {/* 에이전트 이름 */}
            <FormField
              label={t(
                'adminAgentCreate.form.agentNameLabel'
              )}
              description={t(
                'adminAgentCreate.form.agentNameDescription'
              )}
              stretch
            >
              <Input
                value={formData.agentName}
                onChange={({ detail }) =>
                  updateFormData(
                    'agentName',
                    detail.value
                  )
                }
                placeholder={t(
                  'adminAgentCreate.form.agentNamePlaceholder'
                )}
              />
            </FormField>

            {/* 역할 선택기 */}
            <FormField
              label={t(
                'adminAgentCreate.form.agentRoleLabel'
              )}
              description={t(
                'adminAgentCreate.form.agentRoleDescription'
              )}
              stretch
            >
              <Select
                selectedOption={
                  formData.agentRole
                    ? AGENT_ROLES.find(
                        (r) =>
                          r.value ===
                          formData.agentRole
                      ) || null
                    : null
                }
                onChange={({ detail }) =>
                  updateFormData(
                    'agentRole',
                    detail.selectedOption?.value ||
                      ''
                  )
                }
                options={AGENT_ROLES}
                placeholder={t(
                  'adminAgentCreate.form.agentRolePlaceholder'
                )}
              />
            </FormField>

            {/* 템플릿 선택기 (Consultation 전용) */}
            {isConsultation && (
              <FormField
                label={t(
                  'adminAgentCreate.form.templateLabel'
                )}
                description={t(
                  'adminAgentCreate.form.templateDescription'
                )}
                stretch
              >
                <Select
                  selectedOption={
                    selectedTemplate
                      ? [
                          ...CONSULTATION_TEMPLATES.map(
                            (tpl) => ({
                              value: tpl.id,
                              label: t(tpl.labelKey),
                              description: t(
                                tpl.descriptionKey
                              ),
                            })
                          ),
                          {
                            value: 'custom',
                            label: t(
                              'adminAgentCreate.form.templateCustom'
                            ),
                            description: t(
                              'adminAgentCreate.form.templateCustomDesc'
                            ),
                          },
                        ].find(
                          (o) =>
                            o.value ===
                            selectedTemplate
                        ) || null
                      : null
                  }
                  onChange={({ detail }) =>
                    handleTemplateSelect(
                      detail.selectedOption
                        ?.value || ''
                    )
                  }
                  options={[
                    ...CONSULTATION_TEMPLATES.map(
                      (tpl) => ({
                        value: tpl.id,
                        label: t(tpl.labelKey),
                        description: t(
                          tpl.descriptionKey
                        ),
                      })
                    ),
                    {
                      value: 'custom',
                      label: t(
                        'adminAgentCreate.form.templateCustom'
                      ),
                      description: t(
                        'adminAgentCreate.form.templateCustomDesc'
                      ),
                    },
                  ]}
                  placeholder={t(
                    'adminAgentCreate.form.templatePlaceholder'
                  )}
                />
              </FormField>
            )}

            {/* 모델 선택 (공통) */}
            {(isConsultation || isSummary) && (
              <FormField
                label={t(
                  'adminAgentCreate.form.foundationModelLabel'
                )}
                description={t(
                  'adminAgentCreate.form.foundationModelDescription'
                )}
                stretch
              >
                <Select
                  selectedOption={
                    formData.modelId
                      ? modelOptions.find(
                          (opt) =>
                            opt.value ===
                            formData.modelId
                        ) || null
                      : null
                  }
                  onChange={({ detail }) =>
                    updateFormData(
                      'modelId',
                      detail.selectedOption
                        ?.value || ''
                    )
                  }
                  options={modelOptions}
                  placeholder={t(
                    'adminAgentCreate.form.foundationModelPlaceholder'
                  )}
                />
              </FormField>
            )}

            {/* Consultation 전용 필드 */}
            {isConsultation && (
              <>
                {/* i18n 언어 선택 */}
                <FormField
                  label={t(
                    'adminAgentCreate.form.i18nLabel'
                  )}
                  description={t(
                    'adminAgentCreate.form.i18nDescription'
                  )}
                  stretch
                >
                  <Select
                    selectedOption={
                      I18N_OPTIONS.find(
                        (opt) =>
                          opt.value ===
                          formData.i18n
                      ) || I18N_OPTIONS[0]
                    }
                    onChange={({ detail }) =>
                      updateFormData(
                        'i18n',
                        detail.selectedOption
                          ?.value || 'ko'
                      )
                    }
                    options={I18N_OPTIONS}
                  />
                </FormField>

                {/* 도구 체크박스 목록 */}
                <FormField
                  label={t(
                    'adminAgentCreate.form.toolsLabel'
                  )}
                  description={t(
                    'adminAgentCreate.form.toolsDescription'
                  )}
                  stretch
                  errorText={
                    isRetrieveMissingKb
                      ? t(
                          'adminAgentCreate.form.kbRequiredError'
                        )
                      : undefined
                  }
                >
                  <SpaceBetween size="xs">
                    {AVAILABLE_TOOLS.map((tool) => {
                      const isChecked =
                        tool.alwaysEnabled ||
                        formData.tools.some(
                          (tc) =>
                            tc.tool_name ===
                            tool.name
                        );
                      return (
                        <div key={tool.name}>
                          <Checkbox
                            checked={isChecked}
                            disabled={
                              tool.alwaysEnabled
                            }
                            onChange={({
                              detail,
                            }) =>
                              handleToolToggle(
                                tool.name,
                                detail.checked
                              )
                            }
                          >
                            <span>
                              <Box
                                variant="span"
                                fontWeight="bold"
                              >
                                {tool.label}
                              </Box>
                              {' — '}
                              {tool.description}
                            </span>
                          </Checkbox>
                          {/* retrieve 체크 시 KB 선택기 */}
                          {tool.name ===
                            'retrieve' &&
                            isRetrieveChecked && (
                              <div
                                style={{
                                  marginLeft: 28,
                                  marginTop: 4,
                                }}
                              >
                                {kbError && (
                                  <Alert
                                    type="error"
                                  >
                                    {kbError}
                                  </Alert>
                                )}
                                <Select
                                  selectedOption={
                                    selectedKbId
                                      ? kbOptions.find(
                                          (o) =>
                                            o.value ===
                                            selectedKbId
                                        ) || null
                                      : null
                                  }
                                  onChange={({
                                    detail,
                                  }) =>
                                    handleKbSelect(
                                      detail
                                        .selectedOption
                                        ?.value ||
                                        ''
                                    )
                                  }
                                  options={
                                    kbOptions
                                  }
                                  placeholder={t(
                                    'adminAgentCreate.form.kbPlaceholder'
                                  )}
                                  loadingText={t(
                                    'adminAgentCreate.form.kbLoading'
                                  )}
                                  statusType={
                                    kbLoading
                                      ? 'loading'
                                      : 'finished'
                                  }
                                  empty={t(
                                    'adminAgentCreate.form.kbEmpty'
                                  )}
                                />
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </SpaceBetween>
                </FormField>

                {/* 시스템 프롬프트 오버라이드 */}
                <FormField
                  label={t(
                    'adminAgentCreate.form.promptOverrideLabel'
                  )}
                  description={t(
                    'adminAgentCreate.form.promptOverrideDescription'
                  )}
                  stretch
                >
                  <Checkbox
                    checked={overridePrompt}
                    onChange={({ detail }) =>
                      setOverridePrompt(
                        detail.checked
                      )
                    }
                  >
                    {t(
                      'adminAgentCreate.form.promptOverrideCheckbox'
                    )}
                  </Checkbox>
                </FormField>

                {overridePrompt && (
                  <FormField
                    label={
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span>
                          {t(
                            'adminAgentCreate.form.agentInstructionsLabel'
                          )}
                        </span>
                        <PlaceholderTooltip />
                      </div>
                    }
                    description={t(
                      'adminAgentCreate.form.agentInstructionsDescription'
                    )}
                    stretch
                    secondaryControl={
                      <Button
                        variant="normal"
                        iconName="refresh"
                        onClick={() =>
                          updateFormData(
                            'systemPrompt',
                            DEFAULT_PROMPTS
                              .consultation
                          )
                        }
                      >
                        {t(
                          'adminAgentCreate.form.defaultInstructionsButton'
                        )}
                      </Button>
                    }
                  >
                    <Textarea
                      value={
                        formData.systemPrompt
                      }
                      onChange={({ detail }) =>
                        updateFormData(
                          'systemPrompt',
                          detail.value
                        )
                      }
                      placeholder={t(
                        'adminAgentCreate.form.agentInstructionsPlaceholder'
                      )}
                      rows={15}
                    />
                  </FormField>
                )}
              </>
            )}
          </SpaceBetween>
        </Form>
      </SpaceBetween>
    </Container>
  );
}