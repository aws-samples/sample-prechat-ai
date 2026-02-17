import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AppTopNavigation } from './components/TopNavigation'
import { WelcomeScreen } from './components/WelcomeScreen'
import { TranslationTest } from './components/TranslationTest'
import ProtectedRoute from './components/ProtectedRoute'
import CustomerChat from './pages/customer/CustomerChat'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSessionDetails from './pages/admin/AdminSessionDetails'
import CreateSession from './pages/admin/CreateSession'
import AgentsDashboard from './pages/admin/AgentsDashboard'
import CreateAgent from './pages/admin/CreateAgent'
import EditAgent from './pages/admin/EditAgent'
import CampaignDashboard from './pages/admin/CampaignDashboard'
import CreateCampaign from './pages/admin/CreateCampaign'
import EditCampaign from './pages/admin/EditCampaign'
import CampaignDetails from './pages/admin/CampaignDetails'
import TriggerDashboard from './pages/admin/TriggerDashboard'

import Login from './pages/auth/Login'
import { I18nProvider } from './i18n/I18nContext'
import './styles/animations.css'

function App() {
  return (
    <I18nProvider>
      <AppTopNavigation />
      <Layout>
        <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/test-translations" element={<TranslationTest />} />
        <Route path="/customer/:sessionId" element={<CustomerChat />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/sessions/create" element={
          <ProtectedRoute>
            <CreateSession />
          </ProtectedRoute>
        } />
        <Route path="/admin/sessions/:sessionId" element={
          <ProtectedRoute>
            <AdminSessionDetails />
          </ProtectedRoute>
        } />
        <Route path="/admin/campaigns" element={
          <ProtectedRoute>
            <CampaignDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/campaigns/create" element={
          <ProtectedRoute>
            <CreateCampaign />
          </ProtectedRoute>
        } />
        <Route path="/admin/campaigns/:campaignId" element={
          <ProtectedRoute>
            <CampaignDetails />
          </ProtectedRoute>
        } />
        <Route path="/admin/campaigns/:campaignId/edit" element={
          <ProtectedRoute>
            <EditCampaign />
          </ProtectedRoute>
        } />

        <Route path="/admin/agents" element={
          <ProtectedRoute>
            <AgentsDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/triggers" element={
          <ProtectedRoute>
            <TriggerDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/agents/create" element={
          <ProtectedRoute>
            <CreateAgent />
          </ProtectedRoute>
        } />
        <Route path="/admin/agents/:agentId/edit" element={
          <ProtectedRoute>
            <EditAgent />
          </ProtectedRoute>
        } />
        </Routes>
      </Layout>
    </I18nProvider>
  )
}

export default App