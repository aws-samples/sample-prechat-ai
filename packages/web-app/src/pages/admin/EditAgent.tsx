// nosemgrep
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Spinner,
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

export default function EditAgent() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { agentId: configId } = useParams<{
    agentId: string;
  }>();
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] =
    useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [overridePrompt, setOverridePrompt] =
    useState(false);
  const [selectedKbId, setSelectedKbId] =
    useState('');
  const [knowledgeBases, setKnowledgeBases] =
    useState<KnowledgeBase[]>([]);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbError, setKbError] = useState('');
  const [formData, setFormData] = useState({
    agentName: '',
    agentRole: '' as AgentRole | '',
    modelId: '',
    systemPrompt: '',
    i18n: 'ko',
    tools: [] as ToolConfig[],
  });

  const isConsultation =
    formData.agentRole === 'consultation';

  // retrieve 도구가 선택되었는지 확인
  const isRetrieveChecked = formData.tools.some(
    (tc) => tc.tool_name === 'retrieve'
  );

  // retrieve 체크 + KB 미선택 시 제출 비활성화
  const isRetrieveMissingKb =
    isRetrieveChecked && !selectedKbId;

  // 기존 AgentConfig 로드
  useEffect(() => {
    if (configId) {
      loadConfig();
    }
  }, [configId]); // eslint-disable-line

  const loadConfig = async () => {
    if (!configId) return;
    try {
      setLoadingConfig(true);
      const config =
        await adminApi.getAgentConfig(configId);
      setFormData({
        agentName: config.agentName,
        agentRole: config.agentRole,
        modelId: config.modelId,
        systemPrompt: config.systemPrompt || '',
        i18n: config.i18n || 'ko',
        tools: config.tools || [],
      });
      // 시스템 프롬프트가 기본값과 다르면 오버라이드 활성화
      if (
        config.systemPrompt &&
        config.systemPrompt !==
          DEFAULT_PROMPTS[config.agentRole]
      ) {
        setOverridePrompt(true);
      }
      // retrieve 도구의 kb_id 사전 선택
      const retrieveTool = (config.tools || []).find(
        (tc) => tc.tool_name === 'retrieve'
      );
      if (retrieveTool?.tool_attributes?.kb_id) {
        setSelectedKbId(
          retrieveTool.tool_attributes.kb_id
        );
      }
    } catch (err) {
      setError(
        t('adminAgentEdit.alert.failedLoadAgent')
      );
    } finally {
      setLoadingConfig(false);
    }
  };

  // KB 목록 조회: retrieve 체크 시 fetch
  useEffect(() => {
    if (!isRetrieveChecked) return;
    if (knowledgeBases.length > 0) return;
    setKbLoading(true);
    setKbError('');
    adminApi
      .fetchKnowledgeBases()
      .then((res) => {
        setKnowledgeBases(
          res.knowledgeBases || []
        );
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
          (tc) => tc.tool_name !== toolName
        );
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
      const updatedTools = prev.tools.map((tc) => {
        if (tc.tool_name === 'retrieve') {
          return {
            ...tc,
            tool_attributes: { kb_id: kbId },
          };
        }
        return tc;
      });
      return { ...prev, tools: updatedTools };
    });
  };

  const handleSubmit = async () => {
    if (!configId) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await adminApi.updateAgentConfig(configId, {
        modelId: formData.modelId,
        agentName: formData.agentName,
        ...(isConsultation && {
          systemPrompt: formData.systemPrompt,
          tools: formData.tools,
          i18n: formData.i18n,
        }),
      });
      setSuccess(
        t('adminAgentEdit.alert.updatedSuccess', {
          name: formData.agentName,
        })
      );
      setTimeout(
        () => navigate('/admin/agents'),
        3000
      );
    } catch (err) {
      setError(
        t('adminAgentEdit.alert.failedUpdateAgent')
      );
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (
    field: string,
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const modelOptions = BEDROCK_MODELS.map((m) => ({
    label: `${m.name} (${m.provider})`,
    value: m.id,
  }));

  const kbOptions = knowledgeBases.map((kb) => ({
    label: `${kb.name} (${kb.knowledgeBaseId})`,
    value: kb.knowledgeBaseId,
  }));

  if (loadingConfig) {
    return (
      <Container>
        <SpaceBetween size="l">
          <Header variant="h1">
            {t('adminAgentEdit.loading.pageTitle')}
          </Header>
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
            }}
          >
            <Spinner size="large" />
            <div style={{ marginTop: '1rem' }}>
              {t(
                'adminAgentEdit.loading.agentDetails'
              )}
            </div>
          </div>
        </SpaceBetween>
      </Container>
    );
  }

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
                'adminAgentEdit.header.toDashboardButton'
              )}
            </Button>
          }
        >
          {t('adminAgentEdit.header.title')}
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
                  'adminAgentEdit.form.cancelButton'
                )}
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={
                  !formData.agentName ||
                  !formData.modelId ||
                  isRetrieveMissingKb
                }
              >
                {t(
                  'adminAgentEdit.form.updateAgentButton'
                )}
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            {/* 에이전트 이름 */}
            <FormField
              label={t(
                'adminAgentEdit.form.agentNameLabel'
              )}
              description={t(
                'adminAgentEdit.form.agentNameDescription'
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
                  'adminAgentEdit.form.agentNamePlaceholder'
                )}
              />
            </FormField>

            {/* 역할 선택기 (읽기 전용) */}
            <FormField
              label={t(
                'adminAgentEdit.form.agentRoleLabel'
              )}
              description={t(
                'adminAgentEdit.form.agentRoleReadonlyDescription'
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
                onChange={() => {}}
                options={AGENT_ROLES}
                disabled
              />
            </FormField>

            {/* 모델 선택 (공통) */}
            <FormField
              label={t(
                'adminAgentEdit.form.foundationModelLabel'
              )}
              description={t(
                'adminAgentEdit.form.foundationModelDescription'
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
                  'adminAgentEdit.form.foundationModelPlaceholder'
                )}
              />
            </FormField>

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
                    'adminAgentEdit.form.promptOverrideLabel'
                  )}
                  description={t(
                    'adminAgentEdit.form.promptOverrideDescription'
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
                      'adminAgentEdit.form.promptOverrideCheckbox'
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
                            'adminAgentEdit.form.agentInstructionsLabel'
                          )}
                        </span>
                        <PlaceholderTooltip />
                      </div>
                    }
                    description={t(
                      'adminAgentEdit.form.agentInstructionsDescription'
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
                          'adminAgentEdit.form.defaultInstructionsButton'
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
                        'adminAgentEdit.form.agentInstructionsPlaceholder'
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
