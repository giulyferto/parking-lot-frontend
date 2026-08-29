import { useEffect, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { API_BASE_URL } from '../api/client'
import type { SpotStatusMessage } from '../types'

/**
 * Subscribes to /topic/floors/{floorId} for as long as the component using
 * this hook is mounted and floorId is set. Mirrors SpotStatusPublisher on
 * the backend - see that class's javadoc for the message shape. Returns
 * `connected` so the map can show a live/offline indicator.
 */
export function useFloorSocket(
  floorId: string | undefined,
  onMessage: (message: SpotStatusMessage) => void,
): { connected: boolean } {
  const onMessageRef = useRef(onMessage)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    onMessageRef.current = onMessage
  })

  useEffect(() => {
    // No floor selected: the previous run's cleanup already set connected=false.
    if (!floorId) return

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE_URL}/ws`),
      reconnectDelay: 3000,
    })

    client.onConnect = () => {
      setConnected(true)
      client.subscribe(`/topic/floors/${floorId}`, (frame) => {
        const message = JSON.parse(frame.body) as SpotStatusMessage
        onMessageRef.current(message)
      })
    }
    client.onWebSocketClose = () => setConnected(false)
    client.onStompError = () => setConnected(false)

    client.activate()

    return () => {
      setConnected(false)
      void client.deactivate()
    }
  }, [floorId])

  return { connected }
}
