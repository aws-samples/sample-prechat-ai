import { useState, useEffect, useCallback } from 'react'
import {
  Container,
  Header,
  Table,
  Button,
  SpaceBetween,
  Box,
  Badge,
  TextFilter,
  Pagination,
  Alert,
  Modal,
  FormField,
  Input,
  Select,
  Textarea,
  Toggle,
  ColumnLayout,
  Tabs
} from '@cloudscape-design/components'
import { triggerApi, campaignApi } from '../../services/api'
import type {
  Trigger,
  TriggerType,
  TriggerEventType,
  TriggerTemplatesResponse,
  Campaign
} from '../../types'

const EVENT_TYPE_OPTIONS = [
  { label: 'Session Created', value: 'SessionCreated' },
  { label: 'Session Completed', value: 'SessionCompleted' },
  { label: 'Session Inactivated', value: 'SessionInactivated' },
  { label: 'Campaign Created', value: 'CampaignCreated' },
  { label: 'Campaign Closed', value: 'CampaignClosed' },
]

const TRIGGER_TYPE_OPTIONS = [
  { label: 'Slack', value: 'slack' },
  { label: 'SNS', value: 'sns' },
]

interface TriggerFormState {
  triggerType: TriggerType
  eventType: TriggerEventType
  deliveryEndpoint: string
  messageTemplate: string
  isGlobal: boolean
  campaignId: string
  status: 'active' | 'inactive'
}

const INITIAL_FORM: TriggerFormState = {
  triggerType: 'slack',
  eventType: 'SessionCompleted',
  deliveryEndpoint: '',
  messageTemplate: '',
  isGlobal: true,
  campaignId: '',
  status: 'active',
}

export default function TriggerDashboard() {
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filteringText, setFilteringText] = useState('')
  const [currentPageIndex, setCurrentPageIndex] = useState(1)
  const pageSize = 10

  // Modal state
  const [modalVisible, setModalVisible] = useState(false)
  const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null)
  const [form, setForm] = useState<TriggerFormState>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  // Templates & campaigns
  const [templates, setTemplates] = useState<TriggerTemplatesResponse | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Trigger | null>(null)

  const loadTriggers = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const response = await triggerApi.listTriggers()
      setTriggers(response.triggers)
    } catch (err: any) {
      setError(err.message || 'Failed to load triggers')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTemplates = useCallback(async () => {
    try {
      const resp = await triggerApi.getDefaultTemplates()
      setTemplates(resp)
    } catch {
      // 템플릿 로드 실패는 무시
    }
  }, [])

  const loadCampaigns = useCallback(async () => {
    try {
      const resp = await campaignApi.listCampaigns()
      setCampaigns(resp.campaigns)
    } catch {
      // 캠페인 로드 실패는 무시
    }
  }, [])

  useEffect(() => {
    loadTriggers()
    loadTemplates()
    loadCampaigns()
  }, [loadTriggers, loadTemplates, loadCampaigns])

  const openCreateModal = () => {
    setEditingTrigger(null)
    setForm(INITIAL_FORM)
    setModalError('')
    setModalVisible(true)
  }

  const openEditModal = (trigger: Trigger) => {
    setEditingTrigger(trigger)
    setForm({
      triggerType: trigger.triggerType,
      eventType: trigger.eventType,
      deliveryEndpoint: trigger.deliveryEndpoint,
      messageTemplate: trigger.messageTemplate,
      isGlobal: trigger.isGlobal,
      campaignId: trigger.campaignId || '',
      status: trigger.status,
    })
    setModalError('')
    setModalVisible(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setModalError('')
    try {
      if (editingTrigger) {
        await triggerApi.updateTrigger(editingTrigger.triggerId, {
          messageTemplate: form.messageTemplate,
          deliveryEndpoint: form.deliveryEndpoint,
          status: form.status,
          eventType: form.eventType,
          isGlobal: form.isGlobal,
          campaignId: form.isGlobal ? undefined : form.campaignId,
        })
      } else {
        await triggerApi.createTrigger({
          triggerType: form.triggerType,
          eventType: form.eventType,
          deliveryEndpoint: form.deliveryEndpoint,
          messageTemplate: form.messageTemplate || undefined,
          isGlobal: form.isGlobal,
          campaignId: form.isGlobal ? undefined : form.campaignId,
        })
      }
      setModalVisible(false)
      await loadTriggers()
    } catch (err: any) {
      setModalError(err.message || 'Failed to save trigger')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await triggerApi.deleteTrigger(deleteTarget.triggerId)
      setDeleteTarget(null)
      await loadTriggers()
    } catch (err: any) {
      setError(err.message || 'Failed to delete trigger')
      setDeleteTarget(null)
    }
  }

  const handleToggleStatus = async (trigger: Trigger) => {
    try {
      const newStatus = trigger.status === 'active' ? 'inactive' : 'active'
      await triggerApi.updateTrigger(trigger.triggerId, { status: newStatus })
      await loadTriggers()
    } catch (err: any) {
      setError(err.message || 'Failed to update trigger status')
    }
  }

  // 이벤트 타입 변경 시 기본 템플릿 자동 적용
  const handleEventTypeChange = (eventType: TriggerEventType) => {
    setForm(prev => {
      const newForm = { ...prev, eventType }
      if (prev.triggerType === 'slack' && !prev.messageTemplate && templates) {
        const tpl = templates.templates[eventType]
        if (tpl) newForm.messageTemplate = tpl.template
      }
      return newForm
    })
  }

  // 필터링
  const filteredTriggers = triggers.filter(t =>
    t.eventType.toLowerCase().includes(filteringText.toLowerCase()) ||
    t.triggerType.toLowerCase().includes(filteringText.toLowerCase()) ||
    t.deliveryEndpoint.toLowerCase().includes(filteringText.toLowerCase())
  )

  const startIndex = (currentPageIndex - 1) * pageSize
  const paginatedTriggers = filteredTriggers.slice(startIndex, startIndex + pageSize)

  const getEventBadge = (eventType: string) => {
    const colors: Record<string, 'blue' | 'green' | 'grey' | 'red'> = {
      SessionCreated: 'blue',
      SessionCompleted: 'green',
      SessionInactivated: 'grey',
      CampaignCreated: 'blue',
      CampaignClosed: 'red',
    }
    return <Badge color={colors[eventType] || 'grey'}>{eventType}</Badge>
  }


  const getTypeBadge = (type: string) => (
    <Badge color={type === 'slack' ? 'blue' : 'grey'}>{type.toUpperCase()}</Badge>
  )

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description="도메인 이벤트에 반응하여 Slack, SNS 등으로 알림을 전송하는 트리거를 관리합니다."
          actions={
            <Button variant="primary" onClick={openCreateModal}>
              트리거 생성
            </Button>
          }
        >
          트리거 관리
        </Header>

        {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}

        <Table
          columnDefinitions={[
            {
              id: 'eventType',
              header: '이벤트',
              cell: item => getEventBadge(item.eventType),
              width: 180,
            },
            {
              id: 'triggerType',
              header: '유형',
              cell: item => getTypeBadge(item.triggerType),
              width: 100,
            },
            {
              id: 'scope',
              header: '범위',
              cell: item => item.isGlobal
                ? <Badge color="blue">전역</Badge>
                : <Box fontSize="body-s">{campaigns.find(c => c.campaignId === item.campaignId)?.campaignName || item.campaignId}</Box>,
              width: 160,
            },
            {
              id: 'endpoint',
              header: '엔드포인트',
              cell: item => (
                <Box fontSize="body-s" variant="code">
                  {item.deliveryEndpoint.length > 50
                    ? item.deliveryEndpoint.substring(0, 50) + '...'
                    : item.deliveryEndpoint}
                </Box>
              ),
            },
            {
              id: 'status',
              header: '상태',
              cell: item => (
                <Toggle
                  checked={item.status === 'active'}
                  onChange={() => handleToggleStatus(item)}
                >
                  {item.status === 'active' ? '활성' : '비활성'}
                </Toggle>
              ),
              width: 130,
            },
            {
              id: 'actions',
              header: '작업',
              cell: item => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="link" onClick={() => openEditModal(item)}>수정</Button>
                  <Button variant="link" onClick={() => setDeleteTarget(item)}>삭제</Button>
                </SpaceBetween>
              ),
              width: 140,
            },
          ]}
          items={paginatedTriggers}
          loading={loading}
          loadingText="트리거 로딩 중..."
          filter={
            <TextFilter
              filteringText={filteringText}
              onChange={({ detail }) => setFilteringText(detail.filteringText)}
              filteringPlaceholder="트리거 검색..."
            />
          }
          pagination={
            <Pagination
              currentPageIndex={currentPageIndex}
              pagesCount={Math.ceil(filteredTriggers.length / pageSize)}
              onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
            />
          }
          empty={
            <Box textAlign="center" color="inherit">
              <Box variant="strong">등록된 트리거가 없습니다</Box>
              <Box variant="p" padding={{ bottom: 's' }}>
                트리거를 생성하여 도메인 이벤트 알림을 설정하세요.
              </Box>
              <Button onClick={openCreateModal}>트리거 생성</Button>
            </Box>
          }
        />
      </SpaceBetween>

      {/* 생성/수정 모달 */}
      <Modal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        header={editingTrigger ? '트리거 수정' : '트리거 생성'}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setModalVisible(false)}>취소</Button>
              <Button variant="primary" loading={saving} onClick={handleSave}>
                {editingTrigger ? '저장' : '생성'}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="l">
          {modalError && <Alert type="error">{modalError}</Alert>}

          <ColumnLayout columns={2}>
            <FormField label="트리거 유형">
              <Select
                selectedOption={TRIGGER_TYPE_OPTIONS.find(o => o.value === form.triggerType) || null}
                onChange={({ detail }) =>
                  setForm(prev => ({ ...prev, triggerType: detail.selectedOption.value as TriggerType }))
                }
                options={TRIGGER_TYPE_OPTIONS}
                disabled={!!editingTrigger}
              />
            </FormField>

            <FormField label="이벤트 유형">
              <Select
                selectedOption={EVENT_TYPE_OPTIONS.find(o => o.value === form.eventType) || null}
                onChange={({ detail }) =>
                  handleEventTypeChange(detail.selectedOption.value as TriggerEventType)
                }
                options={EVENT_TYPE_OPTIONS}
              />
            </FormField>
          </ColumnLayout>

          <FormField
            label="전달 엔드포인트"
            description={form.triggerType === 'slack'
              ? 'Slack Workflow Webhook URL (https://hooks.slack.com/...)'
              : 'SNS Topic ARN (arn:aws:sns:...)'
            }
          >
            <Input
              value={form.deliveryEndpoint}
              onChange={({ detail }) => setForm(prev => ({ ...prev, deliveryEndpoint: detail.value }))}
              placeholder={form.triggerType === 'slack'
                ? 'https://hooks.slack.com/triggers/...'
                : 'arn:aws:sns:ap-northeast-2:123456789:my-topic'
              }
            />
          </FormField>

          <FormField label="범위">
            <Toggle
              checked={form.isGlobal}
              onChange={({ detail }) => setForm(prev => ({ ...prev, isGlobal: detail.checked }))}
            >
              전역 트리거 (모든 캠페인에 적용)
            </Toggle>
          </FormField>

          {!form.isGlobal && (
            <FormField label="캠페인">
              <Select
                selectedOption={
                  campaigns.find(c => c.campaignId === form.campaignId)
                    ? { label: campaigns.find(c => c.campaignId === form.campaignId)!.campaignName, value: form.campaignId }
                    : null
                }
                onChange={({ detail }) =>
                  setForm(prev => ({ ...prev, campaignId: detail.selectedOption.value || '' }))
                }
                options={campaigns.map(c => ({ label: c.campaignName, value: c.campaignId }))}
                placeholder="캠페인 선택..."
                filteringType="auto"
              />
            </FormField>
          )}

          {editingTrigger && (
            <FormField label="상태">
              <Toggle
                checked={form.status === 'active'}
                onChange={({ detail }) =>
                  setForm(prev => ({ ...prev, status: detail.checked ? 'active' : 'inactive' }))
                }
              >
                {form.status === 'active' ? '활성' : '비활성'}
              </Toggle>
            </FormField>
          )}

          <Tabs
            tabs={[
              {
                label: '메시지 템플릿',
                id: 'template',
                content: (
                  <SpaceBetween size="s">
                    <FormField
                      description="Jinja2 문법을 사용합니다. 비워두면 이벤트 유형별 기본 템플릿이 적용됩니다."
                    >
                      <Textarea
                        value={form.messageTemplate}
                        onChange={({ detail }) => setForm(prev => ({ ...prev, messageTemplate: detail.value }))}
                        rows={12}
                        placeholder="기본 템플릿이 자동 적용됩니다..."
                      />
                    </FormField>
                    {templates?.templates[form.eventType] && (
                      <Box>
                        <Button
                          variant="link"
                          onClick={() =>
                            setForm(prev => ({
                              ...prev,
                              messageTemplate: templates!.templates[form.eventType].template
                            }))
                          }
                        >
                          기본 템플릿 불러오기
                        </Button>
                        <Box fontSize="body-s" color="text-status-inactive" margin={{ top: 'xxs' }}>
                          사용 가능한 변수: {templates.templates[form.eventType].variables.join(', ')}
                        </Box>
                      </Box>
                    )}
                  </SpaceBetween>
                ),
              },
            ]}
          />
        </SpaceBetween>
      </Modal>

      {/* 삭제 확인 모달 */}
      <Modal
        visible={!!deleteTarget}
        onDismiss={() => setDeleteTarget(null)}
        header="트리거 삭제"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteTarget(null)}>취소</Button>
              <Button variant="primary" onClick={handleDelete}>삭제</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Box>
          이 트리거를 삭제하시겠습니까?
          {deleteTarget && (
            <Box margin={{ top: 's' }}>
              <Box fontSize="body-s">이벤트: {deleteTarget.eventType}</Box>
              <Box fontSize="body-s">유형: {deleteTarget.triggerType}</Box>
              <Box fontSize="body-s">엔드포인트: {deleteTarget.deliveryEndpoint}</Box>
            </Box>
          )}
        </Box>
      </Modal>
    </Container>
  )
}
