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



interface DiscussionTabProps {
  sessionId: string
}

export default function DiscussionTab({ sessionId }: DiscussionTabProps) {
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
      setError('Failed to load discussions')
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
      setError('Failed to create discussion')
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
      setError('Failed to update discussion')
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
      setError('Failed to delete discussion')
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
        <Header variant="h3" description="팀원들과 어카운트 전략을 논의하세요">
          Discussion
        </Header>

        {error && (
          <Alert type="error" dismissible onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* New Comment Form */}
        <Container>
          <SpaceBetween size="m">
            <FormField label="새 댓글 작성">
              <Textarea
                value={newComment}
                onChange={({ detail }) => setNewComment(detail.value)}
                placeholder="어카운트 전략에 대한 의견을 작성해주세요..."
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
                댓글 작성
              </Button>
            </Box>
          </SpaceBetween>
        </Container>

        {/* Discussion List */}
        {discussions.length === 0 ? (
          <Box textAlign="center" color="text-status-inactive" padding="xxl">
            아직 작성된 댓글이 없습니다. 첫 번째 댓글을 작성해보세요!
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
                      <Badge color="blue">수정됨</Badge>
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
                          저장
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                        >
                          취소
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
                              ariaLabel="댓글 수정"
                            />
                            <Button
                              variant="icon"
                              iconName="remove"
                              onClick={() => handleDeleteClick(item.id)}
                              ariaLabel="댓글 삭제"
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
          header="댓글 삭제"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => setDeleteModalVisible(false)}>
                  취소
                </Button>
                <Button variant="primary" onClick={handleConfirmDelete}>
                  삭제
                </Button>
              </SpaceBetween>
            </Box>
          }
        >
          <Box>
            이 댓글을 삭제하시겠습니까? 삭제된 댓글은 복구할 수 없습니다.
          </Box>
        </Modal>
      </SpaceBetween>
    </Container>
  )
}