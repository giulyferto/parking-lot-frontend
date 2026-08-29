import { useEffect, useRef } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { API_BASE_URL } from '../api/client'
import type { SpotStatusMessage } from '../types'

/**
 * Subscribes to /topic/floors/{floorId} for as long as the component using
 * this hook is mounted and floorId is set. Mirrors SpotStatusPublisher on
 * the backend - see that class's javadoc for the message shape.
 */
export function useFloorSocket(floorId: string | undefined, onMessage: (message: SpotStatusMessage) => void) {
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  })

  useEffect(() => {
    if (!floorId) return

    const client = new Client({
      webSocketFactory: () => new SockJS(`${API_BASE_URL}/ws`),
      reconnectDelay: 3000,
    })

    client.onConnect = () => {
      client.subscribe(`/topic/floors/${floorId}`, (frame) => {
        const message = JSON.parse(frame.body) as SpotStatusMessage
        onMessageRef.current(message)
      })
    }

    client.activate()

    return () => {
      void client.deactivate()
    }
  }, [floorId])
}
