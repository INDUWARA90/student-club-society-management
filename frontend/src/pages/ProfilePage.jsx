import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useToast } from '../components/ToastProvider'
import { logout, updateProfile, updateProfileImage } from '../features/auth/authSlice'
import { fileToBase64 } from '../utils/fileToBase64'

const inputClass =
  'w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-fast focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-border-dark dark:bg-surface-dark dark:text-ink-dark'

function ProfilePage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector((state) => state.auth.user)
  const { showToast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
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
    const result = await dispatch(updateProfile({ name, email }))
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
      await api.put('/auth/me/password', { currentPassword, newPassword })
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
    <div className="mx-auto max-w-2xl p-4 md:p-8">
      <h1 className="text-2xl font-semibold text-ink dark:text-ink-dark">Your profile</h1>

      <div className="mt-6 flex items-center gap-4">
        {user?.profileImageB64 ? (
          <img src={user.profileImageB64} alt={user.name} className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-2xl font-semibold text-brand-700">
            {user?.name?.[0]?.toUpperCase()}
          </div>
        )}
        <div>
          <p className="font-semibold text-ink dark:text-ink-dark">{user?.name}</p>
          <p className="text-sm text-ink-muted dark:text-ink-dark-muted">{user?.email}</p>
        </div>
      </div>

      <form onSubmit={handleSaveProfile} className="mt-8 max-w-sm space-y-4">
        <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Edit profile</h2>
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
        {profileError && <p className="text-sm text-danger">{profileError}</p>}
        <button
          type="submit"
          disabled={savingProfile}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700 disabled:opacity-60"
        >
          {savingProfile ? 'Saving…' : 'Save changes'}
        </button>
      </form>

      <div className="mt-6">
        <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="profile-picture">
          Change profile picture
        </label>
        <input
          id="profile-picture"
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          className="block text-sm text-ink dark:text-ink-dark"
        />
      </div>

      <form onSubmit={handleChangePassword} className="mt-8 max-w-sm space-y-4">
        <h2 className="text-lg font-semibold text-ink dark:text-ink-dark">Change password</h2>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink dark:text-ink-dark" htmlFor="current-password">
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
        {passwordError && <p className="text-sm text-danger">{passwordError}</p>}
        <button
          type="submit"
          disabled={changingPassword}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700 disabled:opacity-60"
        >
          {changingPassword ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </div>
  )
}

export default ProfilePage
