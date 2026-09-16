import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { Link, useSearchParams } from 'react-router-dom'
import AuthCard from './AuthCard'
import { verifyEmail } from './authSlice'

function VerifyEmailPage() {
  const dispatch = useDispatch()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [status, setStatus] = useState('verifying')
  const [message, setMessage] = useState('Verifying your email…')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('Missing verification token')
      return
    }
    dispatch(verifyEmail(token)).then((result) => {
      if (verifyEmail.fulfilled.match(result)) {
        setStatus('success')
        setMessage('Your email has been verified!')
      } else {
        setStatus('error')
        setMessage(result.payload || 'Verification failed')
      }
    })
  }, [token, dispatch])

  return (
    <AuthCard title="Email verification" subtitle="">
      <p className={`text-center text-sm ${status === 'error' ? 'text-danger' : 'text-ink dark:text-ink-dark'}`}>
        {message}
      </p>
      <Link
        to="/login"
        className="mt-4 block w-full rounded-md bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white transition-fast hover:bg-brand-700"
      >
        Go to login
      </Link>
    </AuthCard>
  )
}

export default VerifyEmailPage
