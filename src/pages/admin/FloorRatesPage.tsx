import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getFloor } from '../../api/floors'
import { listRatePlans } from '../../api/ratePlans'
import { Card } from '../../components/ui'
import { PageShell } from '../../components/Layout'
import { RatePlansEditor } from './floorEditorPage/RatePlansEditor'
import type { Floor, RatePlan } from '../../types'

export function FloorRatesPage() {
  const { floorId } = useParams<{ floorId: string }>()
  const [floor, setFloor] = useState<Floor | null>(null)
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([])

  const reload = useCallback(() => {
    if (!floorId) return
    getFloor(floorId).then(setFloor)
    listRatePlans(floorId).then(setRatePlans)
  }, [floorId])

  useEffect(() => reload(), [reload])

  if (!floor) {
    return <div className="px-8 py-8 font-mono text-xs uppercase tracking-[0.16em] text-slate-400">Loading…</div>
  }

  return (
    <PageShell
      eyebrow={`${floor.name} · Rates`}
      title="Rate plans"
      intro="One rate plan per vehicle type on this floor - workers see these at check-in and check-out."
    >
      <div className="-mt-3 flex items-center justify-between">
        <Link
          to={`/admin/parking-lots/${floor.parkingLotId}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          ← Back to floors
        </Link>
        <Link
          to={`/admin/floors/${floor.id}`}
          className="text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Edit layout →
        </Link>
      </div>

      <Card className="p-5">
        <RatePlansEditor floorId={floor.id} ratePlans={ratePlans} onCreated={reload} />
      </Card>
    </PageShell>
  )
}
