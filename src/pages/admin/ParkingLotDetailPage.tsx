import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getParkingLot } from '../../api/parkingLots'
import { createFloor, listFloors } from '../../api/floors'
import { PageShell } from '../../components/Layout'
import { Card, Eyebrow, FieldLabel } from '../../components/ui'
import { btn, field } from '../../components/styles'
import type { Floor, ParkingLot } from '../../types'

export function ParkingLotDetailPage() {
  const { lotId } = useParams<{ lotId: string }>()
  const [lot, setLot] = useState<ParkingLot | null>(null)
  const [floors, setFloors] = useState<Floor[]>([])
  const [level, setLevel] = useState('0')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reload() {
    if (!lotId) return
    getParkingLot(lotId).then(setLot)
    listFloors(lotId).then(setFloors)
  }

  useEffect(reload, [lotId])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!lotId) return
    setSubmitting(true)
    try {
      await createFloor(lotId, { level: Number(level), name })
      setName('')
      reload()
    } finally {
      setSubmitting(false)
    }
  }

  if (!lot) {
    return <div className="px-8 py-8 font-mono text-xs uppercase tracking-[0.16em] text-slate-400">Loading…</div>
  }

  return (
    <PageShell eyebrow={`Lot · ${lot.name}`} title="Floors">
      <div className="-mt-3">
        <Link
          to="/admin/parking-lots"
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          ← All parking lots
        </Link>
      </div>

      <Card>
        <ul className="divide-y divide-slate-100">
          {floors.map((floor) => (
            <li key={floor.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{floor.name}</p>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-slate-400">
                  Level {floor.level}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link
                  to={`/admin/floors/${floor.id}/rates`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Rate plans
                </Link>
                <Link
                  to={`/admin/floors/${floor.id}`}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Edit layout →
                </Link>
              </div>
            </li>
          ))}
          {floors.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-400">No floors yet.</li>
          )}
        </ul>
      </Card>

      <Card className="p-5">
        <Eyebrow className="mb-4">New floor</Eyebrow>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="flex gap-3">
            <div className="w-24">
              <FieldLabel>Level</FieldLabel>
              <input
                type="number"
                required
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className={field}
              />
            </div>
            <div className="flex-1">
              <FieldLabel>Name</FieldLabel>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ground floor"
                className={field}
              />
            </div>
          </div>
          <button type="submit" disabled={submitting} className={btn.primary}>
            Create floor
          </button>
        </form>
      </Card>
    </PageShell>
  )
}
