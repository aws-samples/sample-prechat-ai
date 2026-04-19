import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AppTopNavigation } from './components/TopNavigation'
import { CustomizationGate } from './components/CustomizationGate'
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
import InboundCampaignDetails from './pages/admin/InboundCampaignDetails'
import TriggerDashboard from './pages/admin/TriggerDashboard'
import CustomizationPanel from './pages/admin/CustomizationPanel'
import InboundEntry from './pages/customer/InboundEntry'

import Login from './pages/auth/Login'
import { I18nProvider } from './i18n/I18nContext'
import { CustomizationProvider } from './contexts/CustomizationContext'
import './styles/animations.css'

function App() {
  return (
    <I18nProvider>
      <CustomizationProvider>
      <CustomizationGate>
      <AppTopNavigation />
      <Layout>
        <Routes>
        <Route path="/" element={<WelcomeScreen />} />
        <Route path="/test-translations" element={<TranslationTest />} />
        <Route path="/customer/:sessionId" element={<CustomerChat />} />
        <Route path="/inbound/:campaignCode" element={<InboundEntry />} />
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
        <Route path="/admin/inbound-campaigns/:campaignId" element={
          <ProtectedRoute>
            <InboundCampaignDetails />
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
        <Route path="/admin/customizing" element={
          <ProtectedRoute>
            <CustomizationPanel />
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
      </CustomizationGate>
      </CustomizationProvider>
    </I18nProvider>
  )
}

export default App