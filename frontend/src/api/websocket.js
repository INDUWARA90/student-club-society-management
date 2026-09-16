import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'

const WS_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '')

/** Subscribes to live notifications for a user. Returns an unsubscribe function. */
export function subscribeToNotifications(userId, onNotification) {
  const client = new Client({
    webSocketFactory: () => new SockJS(`${WS_BASE_URL}/ws`),
    reconnectDelay: 5000,
  })

  client.onConnect = () => {
    client.subscribe(`/topic/notifications/${userId}`, (message) => {
      onNotification(JSON.parse(message.body))
    })
  }

  client.activate()

  return () => client.deactivate()
}

/** Subscribes to an arbitrary STOMP topic. Returns an unsubscribe function. */
export function subscribeToTopic(topic, onMessage) {
  const client = new Client({
    webSocketFactory: () => new SockJS(`${WS_BASE_URL}/ws`),
    reconnectDelay: 5000,
  })

  client.onConnect = () => {
    client.subscribe(topic, (message) => {
      onMessage(JSON.parse(message.body))
    })
  }

  client.activate()

  return () => client.deactivate()
}
