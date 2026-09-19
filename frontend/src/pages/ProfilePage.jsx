import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useToast } from '../components/ToastProvider'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import PageHeader from '../components/ui/PageHeader'
import { logout, updateProfile, updateProfileImage } from '../features/auth/authSlice'
import { fileToBase64 } from '../utils/fileToBase64'

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark dark:focus:ring-brand-500/20'

function ProfilePage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)
  const { showToast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [graduationYear, setGraduationYear] = useState(user?.graduationYear ? String(user.graduationYear) : '')
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(user?.emailNotificationsEnabled ?? true)
  const [emailDigestEnabled, setEmailDigestEnabled] = useState(user?.emailDigestEnabled ?? false)
  const [profileError, setProfileError] = useState(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [passwordError, setPasswordError] = useState(null)
  const [changingPassword, setChangingPassword] = useState(false)

  async function handleSaveProfile(e) {
    e.preventDefault()
    setProfileError(null)
    if (!name.trim() || !email.trim()) {
      setProfileError('Name and email are required')
      return
    }
    const emailChanged = email.trim().toLowerCase() !== user?.email
    setSavingProfile(true)
    const result = await dispatch(
      updateProfile({
        name,
        email,
        graduationYear: graduationYear ? Number(graduationYear) : null,
        emailNotificationsEnabled,
        emailDigestEnabled,
      }),
    )
    setSavingProfile(false)
    if (updateProfile.fulfilled.match(result)) {
      if (emailChanged) {
        showToast('Email updated — please log in again')
        dispatch(logout())
        navigate('/login')
      } else {
        showToast('Profile updated')
      }
    } else {
      setProfileError(result.payload)
      showToast(result.payload, 'error')
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const base64 = await fileToBase64(file)
    const result = await dispatch(updateProfileImage(base64))
    setUploading(false)
    if (updateProfileImage.fulfilled.match(result)) {
      showToast('Profile picture updated')
    } else {
      showToast(result.payload, 'error')
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    setPasswordError(null)
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters')
      return
    }
    setChangingPassword(true)
    try {
      const { data } = await api.put('/auth/me/password', { currentPassword, newPassword })
      // Changing the password signs out every other session; keep this one alive with the fresh token.
      if (data?.accessToken) localStorage.setItem('accessToken', data.accessToken)
      setCurrentPassword('')
      setNewPassword('')
      showToast('Password changed')
    } catch (e2) {
      const message = e2.response?.data?.message || 'Something went wrong'
      setPasswordError(message)
      showToast(message, 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8">
      <PageHeader title="Settings" description="Manage your profile, notifications and password." />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card interactive={false} className="self-start overflow-hidden p-0">
          <div className="h-24 bg-brand-gradient" />
          <div className="px-5 pb-5">
            <div className="-mt-10">
              {user?.profileImageB64 ? (
                <img
                  src={user.profileImageB64}
                  alt={user.name}
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-surface dark:ring-surface-dark-muted"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-2xl font-semibold text-brand-700 ring-4 ring-surface dark:ring-surface-dark-muted">
                  {user?.name?.[0]?.toUpperCase()}
                </div>
              )}
            </div>
            <p className="mt-3 font-semibold text-ink dark:text-ink-dark">{user?.name}</p>
            <p className="text-sm text-ink-muted dark:text-ink-dark-muted">{user?.email}</p>

            <div className="mt-5 border-t border-border pt-4 dark:border-border-dark">
              <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="profile-picture">
                Change profile picture
              </label>
              <input
                id="profile-picture"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
                className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-600 dark:text-ink-dark dark:file:bg-brand-500/15 dark:file:text-brand-300"
              />
            </div>
          </div>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card as="form" interactive={false} onSubmit={handleSaveProfile} className="space-y-4">
            <h2 className="text-base font-semibold text-ink dark:text-ink-dark">Edit profile</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="profile-name">
                  Name
                </label>
                <input
                  id="profile-name"
                  type="text"
                  className={inputClass}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="profile-email">
                  Email
                </label>
                <input
                  id="profile-email"
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="sm:w-1/2 sm:pr-2">
              <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="profile-grad-year">
                Graduation year (optional)
              </label>
              <input
                id="profile-grad-year"
                type="number"
                min="1950"
                max="2100"
                className={inputClass}
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
              />
            </div>
            <div className="space-y-2 rounded-lg bg-surface-muted p-3 dark:bg-surface-dark">
              <label className="flex items-center gap-2 text-sm text-ink dark:text-ink-dark">
                <input
                  type="checkbox"
                  className="accent-brand-500"
                  checked={emailNotificationsEnabled}
                  onChange={(e) => setEmailNotificationsEnabled(e.target.checked)}
                />
                Email me my notifications (in-app notifications are always kept)
              </label>
              <label className="ml-6 flex items-center gap-2 text-sm text-ink dark:text-ink-dark">
                <input
                  type="checkbox"
                  className="accent-brand-500"
                  checked={emailDigestEnabled}
                  disabled={!emailNotificationsEnabled}
                  onChange={(e) => setEmailDigestEnabled(e.target.checked)}
                />
                Send one daily digest instead of an email for each notification
              </label>
            </div>
            {profileError && <p className="text-sm text-danger">{profileError}</p>}
            <div className="flex justify-end">
              <Button type="submit" loading={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </Card>

          <Card as="form" interactive={false} onSubmit={handleChangePassword} className="space-y-4">
            <h2 className="text-base font-semibold text-ink dark:text-ink-dark">Change password</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark"
                  htmlFor="current-password"
                >
                  Current password
                </label>
                <input
                  id="current-password"
                  type="password"
                  className={inputClass}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="new-password">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  className={inputClass}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>
            {passwordError && <p className="text-sm text-danger">{passwordError}</p>}
            <div className="flex justify-end">
              <Button type="submit" loading={changingPassword}>
                {changingPassword ? 'Changing…' : 'Change password'}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ProfilePage
