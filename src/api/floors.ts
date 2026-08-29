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
