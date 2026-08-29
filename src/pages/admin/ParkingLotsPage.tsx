import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createParkingLot, listParkingLots } from '../../api/parkingLots'
import type { ParkingLot } from '../../types'

export function ParkingLotsPage() {
  const [lots, setLots] = useState<ParkingLot[]>([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reload() {
    listParkingLots().then(setLots)
  }

  useEffect(reload, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await createParkingLot({ name, address: address || undefined })
      setName('')
      setAddress('')
      reload()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-slate-900">Parking lots</h1>

      <ul className="mb-6 divide-y divide-slate-200 rounded border border-slate-200 bg-white">
        {lots.map((lot) => (
          <li key={lot.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">{lot.name}</p>
              {lot.address && <p className="text-sm text-slate-500">{lot.address}</p>}
            </div>
            <Link to={`/admin/parking-lots/${lot.id}`} className="text-sm text-blue-600 hover:underline">
              Manage floors
            </Link>
          </li>
        ))}
        {lots.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No parking lots yet.</li>}
      </ul>

      <form onSubmit={handleCreate} className="rounded border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">New parking lot</h2>
        <div className="mb-3">
          <label className="mb-1 block text-sm text-slate-600">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-3">
          <label className="mb-1 block text-sm text-slate-600">Address</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
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
