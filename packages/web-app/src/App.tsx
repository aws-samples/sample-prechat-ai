import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout, SpaceBetween } from '@cloudscape-design/components'
import PageHeader from './components/PageHeader'
import CustomerChat from './pages/customer/CustomerChat'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminSessionDetails from './pages/admin/AdminSessionDetails'
import CreateSession from './pages/admin/CreateSession'

function App() {
  return (
    <SpaceBetween size="none">
      <PageHeader />
      <AppLayout
        navigationHide
        toolsHide
        content={
          <Routes>
            <Route path="/customer/:sessionId" element={<CustomerChat />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/sessions/create" element={<CreateSession />} />
            <Route path="/admin/sessions/:sessionId" element={<AdminSessionDetails />} />
            <Route path="/" element={<Navigate to="/admin" replace />} />
          </Routes>
        }
      />
    </SpaceBetween>
  )
}

export default App