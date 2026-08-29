import { useCallback, useEffect, useMemo, useState } from 'react'
import { listParkingLots } from '../api/parkingLots'
import { listFloors } from '../api/floors'
import { listSpots } from '../api/spots'
import { listActiveSessions } from '../api/sessions'
import { listFloorElements } from '../api/floorElements'
import { FloorMap } from '../components/FloorMap/FloorMap'
import { SpotActionPanel } from '../components/SpotActionPanel'
import { SPOT_COLORS } from '../components/FloorMap/spotColors'
import { field } from '../components/styles'
import { useFloorSocket } from '../ws/useFloorSocket'
import type { Floor, FloorElement, ParkingLot, ParkingSession, Spot, SpotStatus } from '../types'

/**
 * The main worker screen: pick a lot and floor, see the live-colored map,
 * click a bay to check a car in or out. Status changes from other workers
 * arrive over WebSocket (useFloorSocket) and patch `spots` in place, so two
 * people working the same floor stay in sync without polling.
 */
export function MapPage() {
  const [lots, setLots] = useState<ParkingLot[]>([])
  const [selectedLotId, setSelectedLotId] = useState<string>('')
  const [floors, setFloors] = useState<Floor[]>([])
  const [selectedFloorId, setSelectedFloorId] = useState<string>('')
  const [spots, setSpots] = useState<Spot[]>([])
  const [elements, setElements] = useState<FloorElement[]>([])
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
    Promise.all([
      listSpots(selectedFloorId),
      listActiveSessions(),
      listFloorElements(selectedFloorId),
    ])
      .then(([spotData, sessionData, elementData]) => {
        setSpots(spotData)
        setActiveSessions(sessionData)
        setElements(elementData)
      })
      .finally(() => setLoading(false))
  }, [selectedFloorId])

  useEffect(() => {
    loadFloorData()
    setSelectedSpot(null)
  }, [loadFloorData])

  const { connected } = useFloorSocket(selectedFloorId, (message) => {
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

  const counts = useMemo(() => {
    const base: Record<SpotStatus, number> = {
      AVAILABLE: 0,
      OCCUPIED: 0,
      MAINTENANCE: 0,
      DISABLED: 0,
    }
    for (const s of spots) base[s.status] += 1
    return base
  }, [spots])

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Lot
              </span>
              <select
                value={selectedLotId}
                onChange={(e) => setSelectedLotId(e.target.value)}
                className={`${field} min-w-[10rem] py-1.5`}
              >
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Floor
              </span>
              <select
                value={selectedFloorId}
                onChange={(e) => setSelectedFloorId(e.target.value)}
                className={`${field} min-w-[9rem] py-1.5`}
              >
                {floors.map((floor) => (
                  <option key={floor.id} value={floor.id}>
                    {floor.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <OccupancyMeter counts={counts} connected={connected} />
        </div>

        <Legend counts={counts} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
        <div className="min-h-[55vh] min-w-0 p-4 md:min-h-0 md:flex-1 sm:p-6">
          <div className="deck-grid h-full min-h-[24rem] w-full overflow-hidden rounded-xl border border-slate-200 md:min-h-0">
            {loading ? (
              <p className="p-6 font-mono text-xs uppercase tracking-[0.16em] text-slate-400">
                Loading floor…
              </p>
            ) : spots.length === 0 && elements.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 p-6 text-center">
                <p className="text-sm font-medium text-slate-600">No bays on this floor yet</p>
                <p className="text-sm text-slate-400">
                  An admin can add them from the floor editor, then drag them into place.
                </p>
              </div>
            ) : (
              <FloorMap
                spots={spots}
                elements={elements}
                selectedSpotId={selectedSpot?.id}
                showScaleBar
                onSpotClick={setSelectedSpot}
              />
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
    </div>
  )
}

function OccupancyMeter({
  counts,
  connected,
}: {
  counts: Record<SpotStatus, number>
  connected: boolean
}) {
  const total = counts.AVAILABLE + counts.OCCUPIED + counts.MAINTENANCE + counts.DISABLED
  const pct = (n: number) => (total ? `${(n / total) * 100}%` : '0%')
  const order: SpotStatus[] = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'DISABLED']

  return (
    <div className="min-w-[15rem] flex-1 sm:max-w-xs">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
          {counts.AVAILABLE}
          <span className="ml-1 text-sm font-medium text-slate-400">of {total || 0} open</span>
        </p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] ${
            connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
          }`}
        >
          <span className="relative flex h-1.5 w-1.5">
            {connected && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-1.5 w-1.5 rounded-full ${
                connected ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
          </span>
          {connected ? 'Live' : 'Offline'}
        </span>
      </div>
      <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-slate-100">
        {order.map((status) =>
          counts[status] > 0 ? (
            <div
              key={status}
              style={{ width: pct(counts[status]), backgroundColor: SPOT_COLORS[status] }}
            />
          ) : null,
        )}
      </div>
    </div>
  )
}

const LEGEND: Array<[SpotStatus, string]> = [
  ['AVAILABLE', 'Open'],
  ['OCCUPIED', 'Occupied'],
  ['MAINTENANCE', 'Maintenance'],
  ['DISABLED', 'Out of service'],
]

function Legend({ counts }: { counts: Record<SpotStatus, number> }) {
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {LEGEND.map(([status, label]) => (
        <span key={status} className="flex items-center gap-1.5 text-xs text-slate-500">
          <span
            className="inline-block h-3 w-4 rounded-[3px] ring-1 ring-inset ring-white/70"
            style={{ backgroundColor: SPOT_COLORS[status] }}
          />
          {label}
          <span className="font-mono text-[11px] text-slate-400">{counts[status]}</span>
        </span>
      ))}
    </div>
  )
}
