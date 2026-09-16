import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import AuditLogPage from './features/admin/AuditLogPage'
import UniversityStatsPage from './features/analytics/UniversityStatsPage'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage'
import LoginPage from './features/auth/LoginPage'
import RegisterPage from './features/auth/RegisterPage'
import ResetPasswordPage from './features/auth/ResetPasswordPage'
import AllClubsOverviewPage from './features/clubs/AllClubsOverviewPage'
import ClubDetailPage from './features/clubs/ClubDetailPage'
import ClubsPage from './features/clubs/ClubsPage'
import PendingClubsPage from './features/clubs/PendingClubsPage'
import EventDetailPage from './features/events/EventDetailPage'
import EventsPage from './features/events/EventsPage'
import PendingEventsPage from './features/events/PendingEventsPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import ProtectedRoute from './routes/ProtectedRoute'

function App() {
  const themeMode = useSelector((state) => state.theme.mode)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', themeMode === 'dark')
  }, [themeMode])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/clubs" element={<ClubsPage />} />
          <Route path="/clubs/:clubId" element={<ClubDetailPage />} />
          <Route path="/admin/pending-clubs" element={<PendingClubsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />
          <Route path="/advisor/pending-events" element={<PendingEventsPage />} />
          <Route path="/advisor/clubs" element={<AllClubsOverviewPage />} />
          <Route path="/analytics" element={<UniversityStatsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin/audit-log" element={<AuditLogPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
