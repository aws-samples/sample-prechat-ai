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

export default function Login() {
  const navigate = useNavigate()
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
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      await authService.signin(signinData)
      navigate('/admin')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!confirmData.email || !confirmData.confirmationCode) {
      setError('Please enter confirmation code')
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
      setError(err.response?.data?.error || 'Confirmation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async () => {
    if (!signupData.email || !signupData.password || !signupData.name || !signupData.phoneNumber) {
      setError('Please fill in all fields')
      return
    }

    if (!signupData.email.endsWith('@amazon.com')) {
      setError('Only @amazon.com email addresses are allowed')
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
      setError(err.response?.data?.error || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container>
      <div className="fade-in-up">
        <Box textAlign="center" padding={{ vertical: 'xl' }}>
          <Header variant="h1">Admin Portal</Header>
          <Box color="text-status-inactive">
            Sales Representative Access
          </Box>
        </Box>

        <Box maxWidth="600px" margin="auto">
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
            <Alert type="info" header="Email Confirmation Required">
              Please check your email and enter the confirmation code below.
            </Alert>
          )}

          <Tabs
            tabs={[
              {
                label: 'Sign In',
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
                        Sign In
                      </AnimatedButton>
                    }
                  >
                    <SpaceBetween size="m">
                      <FormField label="Email">
                        <Input
                          value={signinData.email}
                          onChange={({ detail }) => 
                            setSigninData(prev => ({ ...prev, email: detail.value }))
                          }
                          type="email"
                          placeholder="Enter your email"
                        />
                      </FormField>
                      
                      <FormField label="Password">
                        <Input
                          value={signinData.password}
                          onChange={({ detail }) => 
                            setSigninData(prev => ({ ...prev, password: detail.value }))
                          }
                          type="password"
                          placeholder="Enter your password"
                        />
                      </FormField>
                    </SpaceBetween>
                  </Form>
                )
              },
              {
                label: showConfirmation ? 'Confirm Email' : 'Sign Up',
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
                          Back to Sign Up
                        </AnimatedButton>
                        <AnimatedButton
                          variant="primary"
                          loading={loading}
                          onClick={handleConfirm}
                          animation="pulse"
                        >
                          Confirm Email
                        </AnimatedButton>
                      </SpaceBetween>
                    }
                  >
                    <SpaceBetween size="m">
                      <FormField label="Email">
                        <Input
                          value={confirmData.email}
                          onChange={({ detail }) => 
                            setConfirmData(prev => ({ ...prev, email: detail.value }))
                          }
                          type="email"
                          placeholder="your.name@amazon.com"
                        />
                      </FormField>
                      
                      <FormField label="Confirmation Code" description="Check your email for the 6-digit code">
                        <Input
                          value={confirmData.confirmationCode}
                          onChange={({ detail }) => 
                            setConfirmData(prev => ({ ...prev, confirmationCode: detail.value }))
                          }
                          placeholder="Enter 6-digit code"
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
                        Create Account
                      </AnimatedButton>
                    }
                  >
                    <SpaceBetween size="m">
                      <FormField label="Full Name">
                        <Input
                          value={signupData.name}
                          onChange={({ detail }) => 
                            setSignupData(prev => ({ ...prev, name: detail.value }))
                          }
                          placeholder="Enter your full name"
                        />
                      </FormField>
                      
                      <FormField label="Email" description="Only @amazon.com addresses allowed">
                        <Input
                          value={signupData.email}
                          onChange={({ detail }) => 
                            setSignupData(prev => ({ ...prev, email: detail.value }))
                          }
                          type="email"
                          placeholder="your.name@amazon.com"
                        />
                      </FormField>
                      
                      <FormField label="Phone Number" description="International format (e.g., +1234567890)">
                        <Input
                          value={signupData.phoneNumber}
                          onChange={({ detail }) => 
                            setSignupData(prev => ({ ...prev, phoneNumber: detail.value }))
                          }
                          type="tel"
                          placeholder="+1234567890"
                        />
                      </FormField>
                      
                      <FormField label="Password">
                        <Input
                          value={signupData.password}
                          onChange={({ detail }) => 
                            setSignupData(prev => ({ ...prev, password: detail.value }))
                          }
                          type="password"
                          placeholder="Create a password"
                        />
                      </FormField>
                    </SpaceBetween>
                  </Form>
                )
              }
            ]}
          />
        </Box>
      </div>
    </Container>
  )
}