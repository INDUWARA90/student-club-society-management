import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useToast } from '../components/ToastProvider'
import { updateProfileImage } from '../features/auth/authSlice'
import { fileToBase64 } from '../utils/fileToBase64'

function ProfilePage() {
  const dispatch = useDispatch()
  const user = useSelector((state) => state.auth.user)
  const { showToast } = useToast()
  const [uploading, setUploading] = useState(false)

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
    </div>
  )
}

export default ProfilePage
