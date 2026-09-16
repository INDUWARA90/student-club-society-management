import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../../api/axios'

function EventCheckInPage() {
  const { eventId } = useParams()
  const [status, setStatus] = useState('checking')
  const [message, setMessage] = useState('Checking you in…')
  const [eventTitle, setEventTitle] = useState('')

  useEffect(() => {
    async function checkIn() {
      try {
        const { data: event } = await api.get(`/events/${eventId}`)
        setEventTitle(event.title)
        await api.post(`/events/${eventId}/attendance/qr-check-in`)
        setStatus('success')
        setMessage('You are checked in!')
      } catch (e) {
        setStatus('error')
        setMessage(e.response?.data?.message || 'Check-in failed')
      }
    }
    checkIn()
  }, [eventId])

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center p-6 text-center">
      <div className="w-full rounded-xl border border-border bg-surface p-8 shadow-card dark:border-border-dark dark:bg-surface-dark-muted">
        <div className="text-4xl">{status === 'success' ? '✅' : status === 'error' ? '⚠️' : '⏳'}</div>
        {eventTitle && (
          <h1 className="mt-3 text-lg font-semibold text-ink dark:text-ink-dark">{eventTitle}</h1>
        )}
        <p className="mt-2 text-sm text-ink-muted dark:text-ink-dark-muted">{message}</p>
        <Link
          to={`/events/${eventId}`}
          className="mt-6 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-fast hover:bg-brand-700"
        >
          View event
        </Link>
      </div>
    </div>
  )
}

export default EventCheckInPage
