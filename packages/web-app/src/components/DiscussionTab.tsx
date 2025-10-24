import { useState, useEffect } from 'react'
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Alert,
  Spinner,
  Button,
  Textarea,
  FormField,
  Badge,
  Modal
} from '@cloudscape-design/components'
import { adminApi } from '../services/api'
import { Discussion } from '../types'
import { useI18n } from '../i18n'



interface DiscussionTabProps {
  sessionId: string
}

export default function DiscussionTab({ sessionId }: DiscussionTabProps) {
  const { t } = useI18n()
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('')

  useEffect(() => {
    loadDiscussions()
    
    // localStorage에서 현재 사용자 이메일 가져오기
    const userEmail = localStorage.getItem('userEmail') || ''
    setCurrentUserEmail(userEmail)
  }, [sessionId])

  const loadDiscussions = async () => {
    try {
      setError('')
      const response = await adminApi.listDiscussions(sessionId)
      setDiscussions(response.discussions || [])
    } catch (err) {
      setError(t('discussion_failed_load'))
      console.error('Error loading discussions:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return

    try {
      setSubmitting(true)
      setError('')
      await adminApi.createDiscussion(sessionId, newComment.trim())
      setNewComment('')
      await loadDiscussions()
    } catch (err) {
      setError(t('discussion_failed_create'))
      console.error('Error creating discussion:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartEdit = (discussion: Discussion) => {
    setEditingId(discussion.id)
    setEditContent(discussion.content)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  const handleSaveEdit = async (discussionId: string) => {
    if (!editContent.trim()) return

    try {
      setError('')
      await adminApi.updateDiscussion(sessionId, discussionId, editContent.trim())
      setEditingId(null)
      setEditContent('')
      await loadDiscussions()
    } catch (err) {
      setError(t('discussion_failed_update'))
      console.error('Error updating discussion:', err)
    }
  }

  const handleDeleteClick = (discussionId: string) => {
    setDeleteTargetId(discussionId)
    setDeleteModalVisible(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return

    try {
      setError('')
      await adminApi.deleteDiscussion(sessionId, deleteTargetId)
      setDeleteModalVisible(false)
      setDeleteTargetId(null)
      await loadDiscussions()
    } catch (err) {
      setError(t('discussion_failed_delete'))
      console.error('Error deleting discussion:', err)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }



  if (loading) {
    return (
      <Container>
        <Box textAlign="center" padding="xxl">
          <Spinner size="large" />
        </Box>
      </Container>
    )
  }

  return (
    <Container>
      <SpaceBetween size="l">
        <Header variant="h3" description={t('discussion_description')}>
          {t('discussion')}
        </Header>

        {error && (
          <Alert type="error" dismissible onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* New Comment Form */}
        <Container>
          <SpaceBetween size="m">
            <FormField label={t('discussion_new_comment')}>
              <Textarea
                value={newComment}
                onChange={({ detail }) => setNewComment(detail.value)}
                placeholder={t('discussion_comment_placeholder')}
                rows={3}
                disabled={submitting}
              />
            </FormField>
            <Box float="right">
              <Button
                variant="primary"
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submitting}
                loading={submitting}
              >
                {t('discussion_submit_comment')}
              </Button>
            </Box>
          </SpaceBetween>
        </Container>

        {/* Discussion List */}
        {discussions.length === 0 ? (
          <Box textAlign="center" color="text-status-inactive" padding="xxl">
            {t('discussion_no_comments')}
          </Box>
        ) : (
          <SpaceBetween size="m">
            {discussions.map((item) => (
              <Container key={item.id}>
                <SpaceBetween size="s">
                  {/* Header */}
                  <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                    <Box fontWeight="bold">{item.authorName}</Box>
                    <Badge color="grey">{item.authorEmail}</Badge>
                    {item.updatedAt && (
                      <Badge color="blue">{t('discussion_edited')}</Badge>
                    )}
                  </SpaceBetween>

                  {/* Content */}
                  {editingId === item.id ? (
                    <SpaceBetween size="s">
                      <Textarea
                        value={editContent}
                        onChange={({ detail }) => setEditContent(detail.value)}
                        rows={3}
                      />
                      <SpaceBetween direction="horizontal" size="xs">
                        <Button
                          variant="primary"
                          onClick={() => handleSaveEdit(item.id)}
                          disabled={!editContent.trim()}
                        >
                          {t('save')}
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                        >
                          {t('cancel')}
                        </Button>
                      </SpaceBetween>
                    </SpaceBetween>
                  ) : (
                    <Box>
                      <Box padding={{ bottom: 's' }}>
                        {item.content}
                      </Box>
                      <SpaceBetween direction="horizontal" size="xs" alignItems="center">
                        <Box fontSize="body-s" color="text-status-inactive">
                          {formatTimestamp(item.updatedAt || item.createdAt)}
                        </Box>
                        {/* Show edit/delete options for own comments - simple localStorage check */}
                        {currentUserEmail && item.authorEmail === currentUserEmail && (
                          <SpaceBetween direction="horizontal" size="xxs">
                            <Button
                              variant="icon"
                              iconName="edit"
                              onClick={() => handleStartEdit(item)}
                              ariaLabel={t('discussion_edit_comment')}
                            />
                            <Button
                              variant="icon"
                              iconName="remove"
                              onClick={() => handleDeleteClick(item.id)}
                              ariaLabel={t('discussion_delete_comment')}
                            />
                          </SpaceBetween>
                        )}
                      </SpaceBetween>
                    </Box>
                  )}
                </SpaceBetween>
              </Container>
            ))}
          </SpaceBetween>
        )}

        {/* Delete Confirmation Modal */}
        <Modal
          visible={deleteModalVisible}
          onDismiss={() => setDeleteModalVisible(false)}
          header={t('discussion_delete_comment')}
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => setDeleteModalVisible(false)}>
                  {t('cancel')}
                </Button>
                <Button variant="primary" onClick={handleConfirmDelete}>
                  {t('delete')}
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <Box>
            {t('discussion_delete_confirmation')}
          </Box>
        </Modal>
      </SpaceBetween>
    </Container>
  )
}