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
    session_id: 'adminTriggers.fieldLabels.sessionId',
    campaign_id: 'adminTriggers.fieldLabels.campaignId',
    campaign_name: 'adminTriggers.fieldLabels.campaignName',
    customer_name: 'adminTriggers.fieldLabels.customerName',
    customer_company: 'adminTriggers.fieldLabels.customerCompany',
    customer_email: 'adminTriggers.fieldLabels.customerEmail',
    sales_rep_email: 'adminTriggers.fieldLabels.salesRepEmail',
    admin_url: 'adminTriggers.fieldLabels.adminUrl',
    event_time: 'adminTriggers.fieldLabels.eventTimeCreated',
  },
  SessionCompleted: {
    event_type: 'SessionCompleted',
    session_id: 'adminTriggers.fieldLabels.sessionId',
    campaign_id: 'adminTriggers.fieldLabels.campaignId',
    campaign_name: 'adminTriggers.fieldLabels.campaignName',
    customer_name: 'adminTriggers.fieldLabels.customerName',
    customer_company: 'adminTriggers.fieldLabels.customerCompany',
    customer_email: 'adminTriggers.fieldLabels.customerEmail',
    sales_rep_email: 'adminTriggers.fieldLabels.salesRepEmail',
    message_count: 'adminTriggers.fieldLabels.messageCount',
    duration_minutes: 'adminTriggers.fieldLabels.durationMinutes',
    admin_url: 'adminTriggers.fieldLabels.adminUrl',
    event_time: 'adminTriggers.fieldLabels.eventTimeCompleted',
  },
  SessionInactivated: {
    event_type: 'SessionInactivated',
    session_id: 'adminTriggers.fieldLabels.sessionId',
    campaign_id: 'adminTriggers.fieldLabels.campaignId',
    campaign_name: 'adminTriggers.fieldLabels.campaignName',
    customer_name: 'adminTriggers.fieldLabels.customerName',
    customer_company: 'adminTriggers.fieldLabels.customerCompany',
    customer_email: 'adminTriggers.fieldLabels.customerEmail',
    admin_url: 'adminTriggers.fieldLabels.adminUrl',
    event_time: 'adminTriggers.fieldLabels.eventTimeInactivated',
  },
  CampaignCreated: {
    event_type: 'CampaignCreated',
    campaign_id: 'adminTriggers.fieldLabels.campaignId',
    campaign_name: 'adminTriggers.fieldLabels.campaignName',
    sales_rep_email: 'adminTriggers.fieldLabels.ownerEmail',
    admin_url: 'adminTriggers.fieldLabels.adminUrl',
    event_time: 'adminTriggers.fieldLabels.eventTimeCreated',
  },
  CampaignCompleted: {
    event_type: 'CampaignCompleted',
    campaign_id: 'adminTriggers.fieldLabels.campaignId',
    campaign_name: 'adminTriggers.fieldLabels.campaignName',
    message_count: 'adminTriggers.fieldLabels.totalSessions',
    admin_url: 'adminTriggers.fieldLabels.adminUrl',
    event_time: 'adminTriggers.fieldLabels.eventTimeCompleted',
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
          description={t('adminTriggers.header.description')}
          actions={<Button variant="primary" onClick={openCreateModal}>{t('adminTriggers.header.createButton')}</Button>}
        >
          {t('adminTriggers.header.title')}
        </Header>

        {error && <Alert type="error" dismissible onDismiss={() => setError('')}>{error}</Alert>}

        <Table
          columnDefinitions={[
            { id: 'eventType', header: t('adminTriggers.table.eventHeader'), cell: item => getEventBadge(item.eventType), width: 180 },
            { id: 'triggerType', header: t('adminTriggers.table.typeHeader'), cell: item => getTypeBadge(item.triggerType), width: 100 },
            {
              id: 'scope', header: t('adminTriggers.table.scopeHeader'), width: 160,
              cell: item => item.isGlobal
                ? <Badge color="blue">{t('adminTriggers.table.globalBadge')}</Badge>
                : <Box fontSize="body-s">{campaigns.find(c => c.campaignId === item.campaignId)?.campaignName || item.campaignId}</Box>,
            },
            {
              id: 'endpoint', header: t('adminTriggers.table.endpointHeader'),
              cell: item => (
                <Box fontSize="body-s" variant="code">
                  {item.deliveryEndpoint.length > 50 ? item.deliveryEndpoint.substring(0, 50) + '...' : item.deliveryEndpoint}
                </Box>
              ),
            },
            {
              id: 'status', header: t('adminTriggers.table.statusHeader'), width: 130,
              cell: item => (
                <Toggle checked={item.status === 'active'} onChange={() => handleToggleStatus(item)}>
                  {item.status === 'active' ? t('adminTriggers.table.activeStatus') : t('adminTriggers.table.inactiveStatus')}
                </Toggle>
              ),
            },
            {
              id: 'actions', header: t('adminTriggers.table.actionsHeader'), width: 140,
              cell: item => (
                <SpaceBetween direction="horizontal" size="xs">
                  <Button variant="link" onClick={() => openEditModal(item)}>{t('adminTriggers.table.editButton')}</Button>
                  <Button variant="link" onClick={() => setDeleteTarget(item)}>{t('adminTriggers.table.deleteButton')}</Button>
                </SpaceBetween>
              ),
            },
          ]}
          items={paginatedTriggers}
          loading={loading}
          loadingText={t('adminTriggers.table.loadingText')}
          filter={
            <TextFilter
              filteringText={filteringText}
              onChange={({ detail }) => setFilteringText(detail.filteringText)}
              filteringPlaceholder={t('adminTriggers.table.searchPlaceholder')}
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
              <Box variant="strong">{t('adminTriggers.table.emptyTitle')}</Box>
              <Box variant="p" padding={{ bottom: 's' }}>{t('adminTriggers.table.emptyDescription')}</Box>
              <Button onClick={openCreateModal}>{t('adminTriggers.table.emptyCreateButton')}</Button>
            </Box>
          }
        />
      </SpaceBetween>

      {/* 생성/수정 모달 */}
      <Modal
        visible={modalVisible}
        onDismiss={() => setModalVisible(false)}
        header={editingTrigger ? t('adminTriggers.modal.editTitle') : t('adminTriggers.modal.createTitle')}
        size="large"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setModalVisible(false)}>{t('adminTriggers.modal.cancelButton')}</Button>
              <Button variant="primary" loading={saving} onClick={handleSave}>
                {editingTrigger ? t('adminTriggers.modal.saveButton') : t('adminTriggers.modal.createButton')}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size="l">
          {modalError && <Alert type="error">{modalError}</Alert>}

          <ColumnLayout columns={2}>
            <FormField label={t('adminTriggers.modal.triggerTypeLabel')}>
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
            <FormField label={t('adminTriggers.modal.eventTypeLabel')}>
              <Select
                selectedOption={EVENT_TYPE_OPTIONS.find(o => o.value === form.eventType) || null}
                onChange={({ detail }) => setForm(prev => ({ ...prev, eventType: detail.selectedOption.value as TriggerEventType }))}
                options={EVENT_TYPE_OPTIONS}
              />
            </FormField>
          </ColumnLayout>

          <FormField
            label={t('adminTriggers.modal.endpointLabel')}
            description={form.triggerType === 'slack' ? t('adminTriggers.modal.endpointSlackDescription') : t('adminTriggers.modal.endpointSnsDescription')}
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
                placeholder={t('adminTriggers.modal.snsPlaceholder')}
                filteringType="auto"
                statusType={snsTopicsLoading ? 'loading' : 'finished'}
                loadingText={t('adminTriggers.modal.snsLoadingText')}
                empty={t('adminTriggers.modal.snsEmptyText')}
              />
            ) : (
              <Input
                value={form.deliveryEndpoint}
                onChange={({ detail }) => setForm(prev => ({ ...prev, deliveryEndpoint: detail.value }))}
                placeholder="https://hooks.slack.com/triggers/..."
              />
            )}
          </FormField>

          <FormField label={t('adminTriggers.modal.scopeLabel')}>
            <Toggle
              checked={form.isGlobal}
              onChange={({ detail }) => setForm(prev => ({ ...prev, isGlobal: detail.checked }))}
            >
              {t('adminTriggers.modal.globalToggle')}
            </Toggle>
          </FormField>

          {!form.isGlobal && (
            <FormField label={t('adminTriggers.modal.campaignLabel')}>
              <Select
                selectedOption={
                  campaigns.find(c => c.campaignId === form.campaignId)
                    ? { label: campaigns.find(c => c.campaignId === form.campaignId)!.campaignName, value: form.campaignId }
                    : null
                }
                onChange={({ detail }) => setForm(prev => ({ ...prev, campaignId: detail.selectedOption.value || '' }))}
                options={campaigns.map(c => ({ label: c.campaignName, value: c.campaignId }))}
                placeholder={t('adminTriggers.modal.campaignPlaceholder')}
                filteringType="auto"
              />
            </FormField>
          )}

          {editingTrigger && (
            <FormField label={t('adminTriggers.modal.statusLabel')}>
              <Toggle
                checked={form.status === 'active'}
                onChange={({ detail }) => setForm(prev => ({ ...prev, status: detail.checked ? 'active' : 'inactive' }))}
              >
                {form.status === 'active' ? t('adminTriggers.modal.activeStatus') : t('adminTriggers.modal.inactiveStatus')}
              </Toggle>
            </FormField>
          )}

          {EVENT_ACTIVE_FIELD_KEYS[form.eventType] && (
            <ExpandableSection
              headerText={`${t('adminTriggers.modal.webhookSchemaHeader')} (${form.eventType})`}
              defaultExpanded={!editingTrigger}
            >
              <SpaceBetween size="xs">
                <Box fontSize="body-s" color="text-status-inactive">
                  {t(`adminTriggers.eventDescription.${
                    form.eventType === 'SessionCompleted' ? 'sessionCompleted' :
                    form.eventType === 'SessionCreated' ? 'sessionCreated' :
                    form.eventType === 'SessionInactivated' ? 'sessionInactivated' :
                    form.eventType === 'CampaignCreated' ? 'campaignCreated' :
                    'campaignCompleted'
                  }`)}
                  {' '}{t('adminTriggers.modal.schemaEmptyFieldsNote')}
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
        header={t('adminTriggers.modal.deleteTitle')}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteTarget(null)}>{t('adminTriggers.modal.cancelButton')}</Button>
              <Button variant="primary" onClick={handleDelete}>{t('adminTriggers.modal.deleteButton')}</Button>
            </SpaceBetween>
          </Box>
        }
      >
        <Box>
          {t('adminTriggers.modal.deleteConfirm')}
          {deleteTarget && (
            <Box margin={{ top: 's' }}>
              <Box fontSize="body-s">{t('adminTriggers.modal.deleteEventLabel')}: {deleteTarget.eventType}</Box>
              <Box fontSize="body-s">{t('adminTriggers.modal.deleteTypeLabel')}: {deleteTarget.triggerType}</Box>
              <Box fontSize="body-s">{t('adminTriggers.modal.deleteEndpointLabel')}: {deleteTarget.deliveryEndpoint}</Box>
            </Box>
          )}
        </Box>
      </Modal>
    </Container>
  )
}
