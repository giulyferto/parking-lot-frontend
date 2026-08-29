import { apiClient } from './client'
import type { Floor } from '../types'

export interface FloorInput {
  level: number
  name: string
}

export async function listFloors(parkingLotId: string): Promise<Floor[]> {
  const { data } = await apiClient.get<Floor[]>(`/api/parking-lots/${parkingLotId}/floors`)
  return data
}

export async function getFloor(id: string): Promise<Floor> {
  const { data } = await apiClient.get<Floor>(`/api/floors/${id}`)
  return data
}

export async function createFloor(parkingLotId: string, input: FloorInput): Promise<Floor> {
  const { data } = await apiClient.post<Floor>(`/api/parking-lots/${parkingLotId}/floors`, input)
  return data
}

export interface RescaleResult {
  spotsUpdated: number
  elementsUpdated: number
}

/**
 * Multiply every spot and floor-element coordinate on this floor by `factor`,
 * in one backend transaction. This is how scale calibration works: there is no
 * stored scale multiplier - coordinates are always true meters, and calibrating
 * rewrites them once. Rare admin action.
 */
export async function rescaleFloor(floorId: string, factor: number): Promise<RescaleResult> {
  const { data } = await apiClient.post<RescaleResult>(`/api/floors/${floorId}/rescale`, { factor })
  return data
}
