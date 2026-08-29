import { useCallback, useEffect, useState } from 'react'
import { listParkingLots } from '../api/parkingLots'
import { listFloors } from '../api/floors'
import { listSpots } from '../api/spots'
import { listActiveSessions } from '../api/sessions'
import { FloorMap } from '../components/FloorMap/FloorMap'
import { SpotActionPanel } from '../components/SpotActionPanel'
import { useFloorSocket } from '../ws/useFloorSocket'
import type { Floor, ParkingLot, ParkingSession, Spot } from '../types'

/**
 * The main worker screen: pick a lot and floor, see the live-colored map,
 * click a spot to check a car in or out. Status changes from other workers
 * arrive over WebSocket (useFloorSocket) and patch `spots` in place, so two
 * people working the same floor stay in sync without polling.
 */
export function MapPage() {
  const [lots, setLots] = useState<ParkingLot[]>([])
  const [selectedLotId, setSelectedLotId] = useState<string>('')
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedFloorId, setSelectedFloorId] = useState<string>('')
  const [spots, setSpots] = useState<Spot[]>([])
  const [activeSessions, setActiveSessions] = useState<ParkingSession[]>([])
  const [selectedSpot, setSelectedSpot] = useState<Spot | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listParkingLots().then((data) => {
      setLots(data)
      if (data.length > 0) setSelectedLotId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedLotId) return
    listFloors(selectedLotId).then((data) => {
      setFloors(data)
      setSelectedFloorId(data.length > 0 ? data[0].id : '')
    })
  }, [selectedLotId])

  const loadFloorData = useCallback(() => {
    if (!selectedFloorId) return
    setLoading(true)
    Promise.all([listSpots(selectedFloorId), listActiveSessions()])
      .then(([spotData, sessionData]) => {
        setSpots(spotData)
        setActiveSessions(sessionData)
      })
      .finally(() => setLoading(false))
  }, [selectedFloorId])

  useEffect(() => {
    loadFloorData()
    setSelectedSpot(null)
  }, [loadFloorData])

  useFloorSocket(selectedFloorId, (message) => {
    setSpots((prev) =>
      prev.map((s) => (s.id === message.spotId ? { ...s, status: message.status } : s)),
    )
    // A status push means the active-sessions list is stale for this spot; the
    // cheapest correct fix is to refetch it instead of trying to patch it by hand.
    listActiveSessions().then(setActiveSessions)
  })

  function handleChanged() {
    setSelectedSpot(null)
    loadFloorData()
  }

  const sessionForSelectedSpot = selectedSpot
    ? activeSessions.find((s) => s.spotId === selectedSpot.id) ?? null
    : null

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
          <select
            value={selectedLotId}
            onChange={(e) => setSelectedLotId(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.name}
              </option>
            ))}
          </select>
          <select
            value={selectedFloorId}
            onChange={(e) => setSelectedFloorId(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            {floors.map((floor) => (
              <option key={floor.id} value={floor.id}>
                {floor.name}
              </option>
            ))}
          </select>
          <Legend />
        </div>
        <div className="min-h-0 flex-1 p-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : spots.length === 0 ? (
            <p className="text-sm text-slate-500">
              No spots on this floor yet - an admin can add some from the floor editor.
            </p>
          ) : (
            <FloorMap spots={spots} selectedSpotId={selectedSpot?.id} onSpotClick={setSelectedSpot} />
          )}
        </div>
      </div>
      {selectedSpot && (
        <SpotActionPanel
          spot={selectedSpot}
          session={sessionForSelectedSpot}
          onClose={() => setSelectedSpot(null)}
          onChanged={handleChanged}
        />
      )}
    </div>
  )
}

function Legend() {
  const items: Array<[string, string]> = [
    ['#22c55e', 'Available'],
    ['#ef4444', 'Occupied'],
    ['#9ca3af', 'Disabled'],
    ['#eab308', 'Maintenance'],
  ]
  return (
    <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
      {items.map(([color, label]) => (
        <span key={label} className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: color }} />
          {label}
        </span>
      ))}
    </div>
  )
}
