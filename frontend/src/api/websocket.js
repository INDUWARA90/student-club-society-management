import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

const WS_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')

/** Subscribes to live notifications for a user. Returns an unsubscribe function. */
export function subscribeToNotifications(userId, onNotification) {
  let isSubscribed = true

  const client = new Client({
    webSocketFactory: () => new SockJS(`${WS_BASE_URL}/ws`),
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  })

  client.onConnect = () => {
    if (!isSubscribed) return
    client.subscribe(`/topic/notifications/${userId}`, (message) => {
      try {
        onNotification(JSON.parse(message.body))
      } catch (err) {
        console.warn('Failed to parse incoming notification:', err)
      }
    })
  }

  client.onWebSocketError = () => {
    // Suppress noisy console log when browser transports switch/fallback
  }

  client.onStompError = (frame) => {
    console.debug('STOMP broker reported:', frame?.headers?.message)
  }

  try {
    client.activate()
  } catch (err) {
    console.warn('Could not activate WebSocket client:', err)
  }

  return () => {
    isSubscribed = false
    try {
      if (client.active) {
        client.deactivate().catch(() => {})
      }
    } catch {
      // Ignore disconnect during early unmount
    }
  }
}

/** Subscribes to an arbitrary STOMP topic. Returns an unsubscribe function. */
export function subscribeToTopic(topic, onMessage) {
  let isSubscribed = true

  const client = new Client({
    webSocketFactory: () => new SockJS(`${WS_BASE_URL}/ws`),
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  })

  client.onConnect = () => {
    if (!isSubscribed) return
    client.subscribe(topic, (message) => {
      try {
        onMessage(JSON.parse(message.body))
      } catch (err) {
        console.warn('Failed to parse topic message:', err)
      }
    })
  }

  client.onWebSocketError = () => {
    // Suppress noisy console log when browser transports switch/fallback
  }

  client.onStompError = (frame) => {
    console.debug('STOMP broker reported:', frame?.headers?.message)
  }

  try {
    client.activate()
  } catch (err) {
    console.warn('Could not activate WebSocket client:', err)
  }

  return () => {
    isSubscribed = false
    try {
      if (client.active) {
        client.deactivate().catch(() => {})
      }
    } catch {
      // Ignore disconnect during early unmount
    }
  }
}
