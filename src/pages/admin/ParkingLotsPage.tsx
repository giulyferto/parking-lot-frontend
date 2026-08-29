import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createParkingLot, listParkingLots } from '../../api/parkingLots'
import { PageShell } from '../../components/Layout'
import { Card, Eyebrow, FieldLabel } from '../../components/ui'
import { btn, field } from '../../components/styles'
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
    <PageShell
      eyebrow="Configure"
      title="Parking lots"
      intro="Each lot holds one or more floors. Add a lot here, then open it to lay out floors, bays and rate plans."
    >
      <Card>
        <ul className="divide-y divide-slate-100">
          {lots.map((lot) => (
            <li key={lot.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{lot.name}</p>
                {lot.address && <p className="truncate text-sm text-slate-500">{lot.address}</p>}
              </div>
              <Link
                to={`/admin/parking-lots/${lot.id}`}
                className="shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Manage floors →
              </Link>
            </li>
          ))}
          {lots.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-400">
              No parking lots yet. Add the first one below.
            </li>
          )}
        </ul>
      </Card>

      <Card className="p-5">
        <Eyebrow className="mb-4">New parking lot</Eyebrow>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <FieldLabel>Name</FieldLabel>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={field} />
          </div>
          <div>
            <FieldLabel>Address</FieldLabel>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={field} />
          </div>
          <button type="submit" disabled={submitting} className={btn.primary}>
            Create lot
          </button>
        </form>
      </Card>
    </PageShell>
  )
}
