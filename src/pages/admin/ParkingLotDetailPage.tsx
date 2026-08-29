import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getParkingLot } from '../../api/parkingLots'
import { createFloor, listFloors } from '../../api/floors'
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

  if (!lot) return <div className="p-6 text-sm text-slate-500">Loading...</div>

  return (
    <div className="mx-auto max-w-3xl p-6">
      <Link to="/admin/parking-lots" className="text-sm text-blue-600 hover:underline">
        &larr; All parking lots
      </Link>
      <h1 className="mb-4 mt-2 text-xl font-semibold text-slate-900">{lot.name} - floors</h1>

      <ul className="mb-6 divide-y divide-slate-200 rounded border border-slate-200 bg-white">
        {floors.map((floor) => (
          <li key={floor.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">{floor.name}</p>
              <p className="text-sm text-slate-500">Level {floor.level}</p>
            </div>
            <Link to={`/admin/floors/${floor.id}`} className="text-sm text-blue-600 hover:underline">
              Edit layout &amp; rates
            </Link>
          </li>
        ))}
        {floors.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No floors yet.</li>}
      </ul>

      <form onSubmit={handleCreate} className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">New floor</h2>
        <div className="mb-3 flex gap-3">
          <div className="w-24">
            <label className="mb-1 block text-sm text-slate-600">Level</label>
            <input
              type="number"
              required
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm text-slate-600">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ground floor"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          Create
        </button>
      </form>
    </div>
  )
}
