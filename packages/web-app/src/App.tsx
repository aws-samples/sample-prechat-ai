import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AppTopNavigation } from './components/TopNavigation'
import { WelcomeScreen } from './components/WelcomeScreen'
import ProtectedRoute from './components/ProtectedRoute'
import CustomerChat from './pages/customer/CustomerChat'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSessionDetails from './pages/admin/AdminSessionDetails'
import CreateSession from './pages/admin/CreateSession'
import AgentsDashboard from './pages/admin/AgentsDashboard'
import CreateAgent from './pages/admin/CreateAgent'
import EditAgent from './pages/admin/EditAgent'
import Login from './pages/auth/Login'
import './styles/animations.css'

function App() {
  return (
    <>
      <AppTopNavigation />
      <Layout>
        <Routes>
        <Route path="/" element={<WelcomeScreen />} />
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
        <Route path="/admin/agents" element={
          <ProtectedRoute>
            <AgentsDashboard />
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
    </>
  )
}

export default App