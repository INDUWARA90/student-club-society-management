import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import AuditLogPage from './features/admin/AuditLogPage'
import AlumniDirectoryPage from './features/alumni/AlumniDirectoryPage'
import UniversityStatsPage from './features/analytics/UniversityStatsPage'
import ForgotPasswordPage from './features/auth/ForgotPasswordPage'
import LoginPage from './features/auth/LoginPage'
import RegisterPage from './features/auth/RegisterPage'
import ResetPasswordPage from './features/auth/ResetPasswordPage'
import VerifyEmailPage from './features/auth/VerifyEmailPage'
import VerifyCertificatePage from './features/certificates/VerifyCertificatePage'
import AllClubsOverviewPage from './features/clubs/AllClubsOverviewPage'
import ClubDetailPage from './features/clubs/ClubDetailPage'
import ClubsPage from './features/clubs/ClubsPage'
import MemberDirectoryPage from './features/clubs/MemberDirectoryPage'
import PendingClubsPage from './features/clubs/PendingClubsPage'
import CalendarPage from './features/calendar/CalendarPage'
import CertificatesPage from './features/certificates/CertificatesPage'
import EventCheckInPage from './features/events/EventCheckInPage'
import EventDetailPage from './features/events/EventDetailPage'
import EventsPage from './features/events/EventsPage'
import PendingEventsPage from './features/events/PendingEventsPage'
import NotificationsPage from './features/notifications/NotificationsPage'
import ManageVenuesPage from './features/venues/ManageVenuesPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import SearchPage from './pages/SearchPage'
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
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/verify-certificate/:code" element={<VerifyCertificatePage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/checkin/:eventId" element={<EventCheckInPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/clubs" element={<ClubsPage />} />
          <Route path="/clubs/:clubId" element={<ClubDetailPage />} />
          <Route path="/clubs/:clubId/members" element={<MemberDirectoryPage />} />
          <Route path="/admin/pending-clubs" element={<PendingClubsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/events/:eventId" element={<EventDetailPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/certificates" element={<CertificatesPage />} />
          <Route path="/advisor/pending-events" element={<PendingEventsPage />} />
          <Route path="/advisor/clubs" element={<AllClubsOverviewPage />} />
          <Route path="/analytics" element={<UniversityStatsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin/audit-log" element={<AuditLogPage />} />
          <Route path="/admin/venues" element={<ManageVenuesPage />} />
          <Route path="/alumni" element={<AlumniDirectoryPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
