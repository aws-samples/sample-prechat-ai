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
  Toggle,
  ColumnLayout,
  ExpandableSection
} from '@cloudscape-design/components'
import { triggerApi, campaignApi } from '../../services/api'
import { useI18n } from '../../i18n'
import type {
  Trigger,
  TriggerType,
  TriggerEventType,
  Campaign
} from '../../types'

const EVENT_TYPE_OPTIONS = [
  { label: 'Session Created', value: 'SessionCreated' },
  { label: 'Session Completed', value: 'SessionCompleted' },
  { label: 'Session Inactivated', value: 'SessionInactivated' },
  { label: 'Campaign Created', value: 'CampaignCreated' },
  { label: 'Campaign Completed', value: 'CampaignCompleted' },
]

const TRIGGER_TYPE_OPTIONS = [
  { label: 'Slack', value: 'slack' },
  { label: 'SNS', value: 'sns' },
]

// 이벤트별 실제 값이 차는 필드 (i18n key 매핑)
const EVENT_ACTIVE_FIELD_KEYS: Record<string, Record<string, string>> = {
  SessionCreated: {
    event_type: 'SessionCreated',
    session_id: 'trigger_field_session_id',
    campaign_id: 'trigger_field_campaign_id',
    campaign_name: 'trigger_field_campaign_name',
    customer_name: 'trigger_field_customer_name',
    customer_company: 'trigger_field_customer_company',
    customer_email: 'trigger_field_customer_email',
    sales_rep_email: 'trigger_field_sales_rep_email',
    admin_url: 'trigger_field_admin_url',
    event_time: 'trigger_field_event_time_created',
  },
  SessionCompleted: {
    event_type: 'SessionCompleted',
    session_id: 'trigger_field_session_id',
    campaign_id: 'trigger_field_campaign_id',
    campaign_name: 'trigger_field_campaign_name',
    customer_name: 'trigger_field_customer_name',
    customer_company: 'trigger_field_customer_company',
    customer_email: 'trigger_field_customer_email',
    sales_rep_email: 'trigger_field_sales_rep_email',
    message_count: 'trigger_field_message_count',
    duration_minutes: 'trigger_field_duration_minutes',
    admin_url: 'trigger_field_admin_url',
    event_time: 'trigger_field_event_time_completed',
  },
  SessionInactivated: {
    event_type: 'SessionInactivated',
    session_id: 'trigger_field_session_id',
    campaign_id: 'trigger_field_campaign_id',
    campaign_name: 'trigger_field_campaign_name',
    customer_name: 'trigger_field_customer_name',
    customer_company: 'trigger_field_customer_company',
    customer_email: 'trigger_field_customer_email',
    admin_url: 'trigger_field_admin_url',
    event_time: 'trigger_field_event_time_inactivated',
  },
  CampaignCreated: {
    event_type: 'CampaignCreated',
    campaign_id: 'trigger_field_campaign_id',
    campaign_name: 'trigger_field_campaign_name',
    sales_rep_email: 'trigger_field_owner_email',
    admin_url: 'trigger_field_admin_url',
    event_time: 'trigger_field_event_time_created',
  },
  CampaignCompleted: {
    event_type: 'CampaignCompleted',
    campaign_id: 'trigger_field_campaign_id',
    campaign_name: 'trigger_field_campaign_name',
    message_count: 'trigger_field_total_sessions',
    admin_url: 'trigger_field_admin_url',
    event_time: 'trigger_field_event_time_completed',
  },
}

interface TriggerFormState {
  triggerType: TriggerType
  eventType: TriggerEventType
  deliveryEndpoint: string
  isGlobal: boolean
  campaignId: string
  status: 'active' | 'inactive'
}

const INITIAL_FORM: TriggerFormState = {
  triggerType: 'slack',
  eventType: 'SessionCompleted',
  deliveryEndpoint: '',
  isGlobal: true,
  campaignId: '',
  status: 'active',
}

export default function TriggerDashboard() {
  const { t } = useI18n()
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filteringText, setFilteringText] = useState('')
  const [currentPageIndex, setCurrentPageIndex] = useState(1)
  const pageSize = 10

  const [modalVisible, setModalVisible] = useState(false)
  const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null)
  const [form, setForm] = useState<TriggerFormState>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [modalError, setModalError] = useState('')

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [snsTopics, setSnsTopics] = useState<Array<{ topicArn: string; topicName: string }>>([])
  const [snsTopicsLoading, setSnsTopicsLoading] = useState(false)
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

  const loadCampaigns = useCallback(async () => {
    try {
      const resp = await campaignApi.listCampaigns()
      setCampaigns(resp.campaigns)
    } catch { /* ignore */ }
  }, [])

  const loadSnsTopics = useCallback(async () => {
    try {
      setSnsTopicsLoading(true)
      const resp = await triggerApi.listSnsTopics()
      setSnsTopics(resp.topics)
    } catch { /* ignore */ }
    finally { setSnsTopicsLoading(false) }
  }, [])

  useEffect(() => {
    loadTriggers()
    loadCampaigns()
  }, [loadTriggers, loadCampaigns])

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
      isGlobal: trigger.isGlobal,
      campaignId: trigger.campaignId || '',
      status: trigger.status,
    })
    setModalError('')
    setModalVisible(true)
    if (trigger.triggerType === 'sns') loadSnsTopics()
  }

  const handleSave = async () => {
    setSaving(true)
    setModalError('')
    try {
      if (editingTrigger) {
        await triggerApi.updateTrigger(editingTrigger.triggerId, {
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

  const filteredTriggers = triggers.filter(tr =>
    tr.eventType.toLowerCase().includes(filteringText.toLowerCase()) ||
    tr.triggerType.toLowerCase().includes(filteringText.toLowerCase()) ||
    tr.deliveryEndpoint.toLowerCase().includes(filteringText.toLowerCase())
  )

  const startIndex = (currentPageIndex - 1) * pageSize
  const paginatedTriggers = filteredTriggers.slice(startIndex, startIndex + pageSize)

  const getEventBadge = (eventType: string) => {
    const colors: Record<string, 'blue' | 'green' | 'grey' | 'red'> = {
      SessionCreated: 'blue', SessionCompleted: 'green', SessionInactivated: 'grey',
      CampaignCreated: 'blue', CampaignCompleted: 'green',
    }
    return <Badge color={colors[eventType] || 'grey'}>{eventType}</Badge>
  }

  const getTypeBadge = (type: string) => (
    <Badge color={type === 'slack' ? 'blue' : 'grey'}>{type.toUpperCase()}</Badge>
  )

  // 이벤트별 스키마를 i18n 번역된 값으로 구성
  const getTranslatedSchema = (eventType: string) => {
    const fieldKeys = EVENT_ACTIVE_FIELD_KEYS[eventType]
    if (!fieldKeys) return {}
    const result: Record<string, string> = {}
    for (const [key, val] of Object.entries(fieldKeys)) {
      result[key] = key === 'event_type' ? val : t(val)
    }
    return result
  }

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          description={t('trigger_management_description')}
          actions={<Button variant="primary" onClick={openCreateModal}>{t('trigger_create')}</Button>}
        >
          {t('trigger_management')}
        </Header>

        {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}

        <Table
          columnDefinitions={[
            { id: 'eventType', header: t('trigger_event'), cell: item => getEventBadge(item.eventType), width: 180 },
            { id: 'triggerType', header: t('trigger_type'), cell: item => getTypeBadge(item.triggerType), width: 100 },
            {
              id: 'scope', header: t('trigger_scope'), width: 160,
              cell: item => item.isGlobal
                ? <Badge color="blue">{t('trigger_global')}</Badge>
                : <Box fontSize="body-s">{campaigns.find(c => c.campaignId === item.campaignId)?.campaignName || item.campaignId}</Box>,
            },
            {
              id: 'endpoint', header: t('trigger_endpoint'),
              cell: item => (
                <Box fontSize="body-s" variant="code">
                  {item.deliveryEndpoint.length > 50 ? item.deliveryEndpoint.substring(0, 50) + '...' : item.deliveryEndpoint}
                </Box>
              ),
            },
            {
              id: 'status', header: t('trigger_status'), width: 130,
              cell: item => (
                <Toggle checked={item.status === 'active'} onChange={() => handleToggleStatus(item)}>
                  {item.status === 'active' ? t('trigger_active') : t('trigger_inactive')}
                </Toggle>
              ),
            },
            {
              id: 'actions', header: t('trigger_actions'), width: 140,
              cell: item => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="link" onClick={() => openEditModal(item)}>{t('trigger_edit_btn')}</Button>
                  <Button variant="link" onClick={() => setDeleteTarget(item)}>{t('trigger_delete_btn')}</Button>
                </SpaceBetween>
              ),
            },
          ]}
          items={paginatedTriggers}
          loading={loading}
          loadingText={t('trigger_loading')}
          filter={
            <TextFilter
              filteringText={filteringText}
              onChange={({ detail }) => setFilteringText(detail.filteringText)}
              filteringPlaceholder={t('trigger_search_placeholder')}
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
              <Box variant="strong">{t('trigger_empty_title')}</Box>
              <Box variant="p" padding={{ bottom: 's' }}>{t('trigger_empty_description')}</Box>
              <Button onClick={openCreateModal}>{t('trigger_create')}</Button>
            </Box>
          }
        />
      </SpaceBetween>

      {/* 생성/수정 모달 */}
      <Modal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        header={editingTrigger ? t('trigger_edit') : t('trigger_create')}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setModalVisible(false)}>{t('trigger_cancel')}</Button>
              <Button variant="primary" loading={saving} onClick={handleSave}>
                {editingTrigger ? t('trigger_save') : t('trigger_create')}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="l">
          {modalError && <Alert type="error">{modalError}</Alert>}

          <ColumnLayout columns={2}>
            <FormField label={t('trigger_type_label')}>
              <Select
                selectedOption={TRIGGER_TYPE_OPTIONS.find(o => o.value === form.triggerType) || null}
                onChange={({ detail }) => {
                  const newType = detail.selectedOption.value as TriggerType
                  setForm(prev => ({ ...prev, triggerType: newType, deliveryEndpoint: '' }))
                  if (newType === 'sns') loadSnsTopics()
                }}
                options={TRIGGER_TYPE_OPTIONS}
                disabled={!!editingTrigger}
              />
            </FormField>
            <FormField label={t('trigger_event_type_label')}>
              <Select
                selectedOption={EVENT_TYPE_OPTIONS.find(o => o.value === form.eventType) || null}
                onChange={({ detail }) => setForm(prev => ({ ...prev, eventType: detail.selectedOption.value as TriggerEventType }))}
                options={EVENT_TYPE_OPTIONS}
              />
            </FormField>
          </ColumnLayout>

          <FormField
            label={t('trigger_endpoint_label')}
            description={form.triggerType === 'slack' ? t('trigger_endpoint_slack_description') : t('trigger_endpoint_sns_description')}
          >
            {form.triggerType === 'sns' ? (
              <Select
                selectedOption={
                  form.deliveryEndpoint
                    ? { label: snsTopics.find(tp => tp.topicArn === form.deliveryEndpoint)?.topicName || form.deliveryEndpoint, value: form.deliveryEndpoint }
                    : null
                }
                onChange={({ detail }) => setForm(prev => ({ ...prev, deliveryEndpoint: detail.selectedOption.value || '' }))}
                options={snsTopics.map(tp => ({ label: tp.topicName, value: tp.topicArn, description: tp.topicArn }))}
                placeholder={t('trigger_sns_placeholder')}
                filteringType="auto"
                statusType={snsTopicsLoading ? 'loading' : 'finished'}
                loadingText={t('trigger_sns_loading')}
                empty={t('trigger_sns_empty')}
              />
            ) : (
              <Input
                value={form.deliveryEndpoint}
                onChange={({ detail }) => setForm(prev => ({ ...prev, deliveryEndpoint: detail.value }))}
                placeholder="https://hooks.slack.com/triggers/..."
              />
            )}
          </FormField>

          <FormField label={t('trigger_scope_label')}>
            <Toggle
              checked={form.isGlobal}
              onChange={({ detail }) => setForm(prev => ({ ...prev, isGlobal: detail.checked }))}
            >
              {t('trigger_global_toggle')}
            </Toggle>
          </FormField>

          {!form.isGlobal && (
            <FormField label={t('trigger_campaign_label')}>
              <Select
                selectedOption={
                  campaigns.find(c => c.campaignId === form.campaignId)
                    ? { label: campaigns.find(c => c.campaignId === form.campaignId)!.campaignName, value: form.campaignId }
                    : null
                }
                onChange={({ detail }) => setForm(prev => ({ ...prev, campaignId: detail.selectedOption.value || '' }))}
                options={campaigns.map(c => ({ label: c.campaignName, value: c.campaignId }))}
                placeholder={t('trigger_campaign_placeholder')}
                filteringType="auto"
              />
            </FormField>
          )}

          {editingTrigger && (
            <FormField label={t('trigger_status_label')}>
              <Toggle
                checked={form.status === 'active'}
                onChange={({ detail }) => setForm(prev => ({ ...prev, status: detail.checked ? 'active' : 'inactive' }))}
              >
                {form.status === 'active' ? t('trigger_active') : t('trigger_inactive')}
              </Toggle>
            </FormField>
          )}

          {EVENT_ACTIVE_FIELD_KEYS[form.eventType] && (
            <ExpandableSection
              headerText={`${t('trigger_webhook_schema_header')} (${form.eventType})`}
              defaultExpanded={!editingTrigger}
            >
              <SpaceBetween size="xs">
                <Box fontSize="body-s" color="text-status-inactive">
                  {t(`trigger_event_desc_${form.eventType}`)}
                  {' '}{t('trigger_schema_empty_fields_note')}
                </Box>
                <Box variant="code">
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '13px' }}>
                    {JSON.stringify(getTranslatedSchema(form.eventType), null, 2)}
                  </pre>
                </Box>
              </SpaceBetween>
            </ExpandableSection>
          )}
        </SpaceBetween>
      </Modal>

      {/* 삭제 확인 모달 */}
      <Modal
        visible={!!deleteTarget}
        onDismiss={() => setDeleteTarget(null)}
        header={t('trigger_delete')}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteTarget(null)}>{t('trigger_cancel')}</Button>
              <Button variant="primary" onClick={handleDelete}>{t('trigger_delete_btn')}</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Box>
          {t('trigger_delete_confirm')}
          {deleteTarget && (
            <Box margin={{ top: 's' }}>
              <Box fontSize="body-s">{t('trigger_delete_event')}: {deleteTarget.eventType}</Box>
              <Box fontSize="body-s">{t('trigger_delete_type')}: {deleteTarget.triggerType}</Box>
              <Box fontSize="body-s">{t('trigger_delete_endpoint')}: {deleteTarget.deliveryEndpoint}</Box>
            </Box>
          )}
        </Box>
      </Modal>
    </Container>
  )
}
