// nosemgrep
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Container,
  Header,
  SpaceBetween,
  Box,
  Form,
  FormField,
  Input,
  Alert,
  Tabs
} from '@cloudscape-design/components'
import AnimatedButton from '../../components/AnimatedButton'
import { authService, SignupRequest, SigninRequest, ConfirmSignupRequest } from '../../services/auth'
import { useI18n } from '../../i18n'

export default function Login() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [signinData, setSigninData] = useState<SigninRequest>({
    email: '',
    password: ''
  })

  const [signupData, setSignupData] = useState<SignupRequest>({
    email: '',
    password: '',
    name: '',
    phoneNumber: ''
  })

  const [confirmData, setConfirmData] = useState<ConfirmSignupRequest>({
    email: '',
    confirmationCode: ''
  })

  const [showConfirmation, setShowConfirmation] = useState(false)

  const handleSignin = async () => {
    if (!signinData.email || !signinData.password) {
      setError(t('login.error.fillAllFields'))
      return
    }

    setLoading(true)
    setError('')

    try {
      await authService.signin(signinData)
      navigate('/admin')
    } catch (err: any) {
      setError(err.response?.data?.error || t('login.error.loginFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirmData.email || !confirmData.confirmationCode) {
      setError(t('login.error.enterConfirmationCode'))
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await authService.confirmSignup(confirmData)
      setSuccess(result.message)
      setShowConfirmation(false)
      setConfirmData({ email: '', confirmationCode: '' })
    } catch (err: any) {
      setError(err.response?.data?.error || t('login.error.confirmationFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    if (!signupData.email || !signupData.password || !signupData.name || !signupData.phoneNumber) {
      setError(t('login.error.fillAllFields'))
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await authService.signup(signupData)
      setSuccess(result.message)
      setConfirmData({ email: signupData.email, confirmationCode: '' })
      setShowConfirmation(true)
      setSignupData({ email: '', password: '', name: '', phoneNumber: '' })
    } catch (err: any) {
      setError(err.response?.data?.error || t('login.error.signupFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container>
      <div className="fade-in-up">
        <Box textAlign="center" padding={{ vertical: 'xl' }}>
          <Header variant="h1">{t('login.header.title')}</Header>
          <Box color="text-status-inactive">
            {t('login.header.subtitle')}
          </Box>
        </Box>

        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <style>{`
            .awsui_input_2rhyz_x45v2_149 { width: 100% !important; min-width: 300px !important; }
          `}</style>
          {error && (
            <Alert type="error" dismissible onDismiss={() => setError('')}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert type="success" dismissible onDismiss={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          {showConfirmation && (
            <Alert type="info" header={t('login.confirmEmail.alertHeader')}>
              {t('login.confirmEmail.alertDescription')}
            </Alert>
          )}

          <Tabs
            tabs={[
              {
                label: t('login.signIn.tabLabel'),
                id: 'signin',
                content: (
                  <Form
                    actions={
                      <AnimatedButton
                        variant="primary"
                        loading={loading}
                        onClick={handleSignin}
                        animation="pulse"
                      >
                        {t('login.signIn.submitButton')}
                      </AnimatedButton>
                    }
                  >
                    <SpaceBetween size="m">
                      <FormField label={t('login.signIn.emailLabel')}>
                        <Input
                          value={signinData.email}
                          onChange={({ detail }) =>
                            setSigninData(prev => ({ ...prev, email: detail.value }))
                          }
                          type="email"
                          placeholder={t('login.signIn.emailPlaceholder')}
                        />
                      </FormField>

                      <FormField label={t('login.signIn.passwordLabel')}>
                        <Input
                          value={signinData.password}
                          onChange={({ detail }) =>
                            setSigninData(prev => ({ ...prev, password: detail.value }))
                          }
                          type="password"
                          placeholder={t('login.signIn.passwordPlaceholder')}
                        />
                      </FormField>
                    </SpaceBetween>
                  </Form>
                )
              },
              {
                label: showConfirmation ? t('login.confirmEmail.tabLabel') : t('login.signUp.tabLabel'),
                id: 'signup',
                content: showConfirmation ? (
                  <Form
                    actions={
                      <SpaceBetween direction="horizontal" size="xs">
                        <AnimatedButton
                          variant="normal"
                          onClick={() => setShowConfirmation(false)}
                          animation="pulse"
                        >
                          {t('login.confirmEmail.backButton')}
                        </AnimatedButton>
                        <AnimatedButton
                          variant="primary"
                          loading={loading}
                          onClick={handleConfirm}
                          animation="pulse"
                        >
                          {t('login.confirmEmail.submitButton')}
                        </AnimatedButton>
                      </SpaceBetween>
                    }
                  >
                    <SpaceBetween size="m">
                      <FormField label={t('login.confirmEmail.emailLabel')}>
                        <Input
                          value={confirmData.email}
                          onChange={({ detail }) =>
                            setConfirmData(prev => ({ ...prev, email: detail.value }))
                          }
                          type="email"
                          placeholder={t('login.confirmEmail.emailPlaceholder')}
                        />
                      </FormField>

                      <FormField
                        label={t('login.confirmEmail.confirmationCodeLabel')}
                        description={t('login.confirmEmail.confirmationCodeDescription')}
                      >
                        <Input
                          value={confirmData.confirmationCode}
                          onChange={({ detail }) =>
                            setConfirmData(prev => ({ ...prev, confirmationCode: detail.value }))
                          }
                          placeholder={t('login.confirmEmail.confirmationCodePlaceholder')}
                        />
                      </FormField>
                    </SpaceBetween>
                  </Form>
                ) : (
                  <Form
                    actions={
                      <AnimatedButton
                        variant="primary"
                        loading={loading}
                        onClick={handleSignup}
                        animation="pulse"
                      >
                        {t('login.signUp.submitButton')}
                      </AnimatedButton>
                    }
                  >
                    <SpaceBetween size="m">
                      <FormField label={t('login.signUp.fullNameLabel')}>
                        <Input
                          value={signupData.name}
                          onChange={({ detail }) =>
                            setSignupData(prev => ({ ...prev, name: detail.value }))
                          }
                          placeholder={t('login.signUp.fullNamePlaceholder')}
                        />
                      </FormField>

                      <FormField label={t('login.signUp.emailLabel')}>
                        <Input
                          value={signupData.email}
                          onChange={({ detail }) =>
                            setSignupData(prev => ({ ...prev, email: detail.value }))
                          }
                          type="email"
                          placeholder={t('login.signUp.emailPlaceholder')}
                        />
                      </FormField>

                      <FormField
                        label={t('login.signUp.phoneNumberLabel')}
                        description={t('login.signUp.phoneNumberDescription')}
                      >
                        <Input
                          value={signupData.phoneNumber}
                          onChange={({ detail }) =>
                            setSignupData(prev => ({ ...prev, phoneNumber: detail.value }))
                          }
                          type="text"
                          placeholder="+1234567890"
                        />
                      </FormField>

                      <FormField label={t('login.signUp.passwordLabel')}>
                        <Input
                          value={signupData.password}
                          onChange={({ detail }) =>
                            setSignupData(prev => ({ ...prev, password: detail.value }))
                          }
                          type="password"
                          placeholder={t('login.signUp.passwordPlaceholder')}
                        />
                      </FormField>
                    </SpaceBetween>
                  </Form>
                )
              }
            ]}
          />
        </div>
      </div>
    </Container>
  )
}
