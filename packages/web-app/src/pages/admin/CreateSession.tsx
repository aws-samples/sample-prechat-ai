import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Box
} from '@cloudscape-design/components'
import { adminApi } from '../../services/api'
import { BEDROCK_MODELS } from '../../types'

export default function CreateSession() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerCompany: '',
    targetAuthority: '',
    salesRepId: ''
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await adminApi.createSession(formData)
      setSuccess(`Session created successfully! URL: ${response.sessionUrl}`)
      setTimeout(() => navigate('/admin'), 3000)
    } catch (err) {
      setError('Failed to create session')
    } finally {
      setLoading(false)
    }
  }

  const updateFormData = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Container>
      <SpaceBetween size="l">
        <Header
          variant="h1"
          actions={
            <Button variant="normal" onClick={() => navigate('/admin')}>
              Back to Dashboard
            </Button>
          }
        >
          Create Pre-consultation Session
        </Header>

        {error && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {success && (
          <SpaceBetween size="s" direction="horizontal">
            <Input
              value={success.split('URL: ')[1] || ''}
              readOnly
            />
            <Button
              onClick={() => navigator.clipboard.writeText(success.split('URL: ')[1] || '')}
            >
              Copy URL
            </Button>
          </SpaceBetween>
        )}

        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => navigate('/admin')}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={loading}
                disabled={!formData.customerName || !formData.customerEmail || !formData.salesRepId}
              >
                Create Session
              </Button>
            </SpaceBetween>
          }
        >
          <SpaceBetween size="l">
            <FormField label="Customer Name" stretch>
              <Input
                value={formData.customerName}
                onChange={({ detail }) => updateFormData('customerName', detail.value)}
                placeholder="Enter customer name"
              />
            </FormField>

            <FormField label="Customer Email" stretch>
              <Input
                value={formData.customerEmail}
                onChange={({ detail }) => updateFormData('customerEmail', detail.value)}
                placeholder="Enter customer email"
                type="email"
              />
            </FormField>

            <FormField label="Customer Company" stretch>
              <Input
                value={formData.customerCompany}
                onChange={({ detail }) => updateFormData('customerCompany', detail.value)}
                placeholder="Enter customer company"
              />
            </FormField>

            <FormField label="Target Authority" stretch>
              <Input
                value={formData.targetAuthority}
                onChange={({ detail }) => updateFormData('targetAuthority', detail.value)}
                placeholder="Enter target authority/decision maker"
              />
            </FormField>

            <FormField label="Sales Representative ID" stretch>
              <Input
                value={formData.salesRepId}
                onChange={({ detail }) => updateFormData('salesRepId', detail.value)}
                placeholder="Enter sales rep ID"
              />
            </FormField>


          </SpaceBetween>
        </Form>
      </SpaceBetween>
    </Container>
  )
}