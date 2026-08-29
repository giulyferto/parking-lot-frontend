import { apiClient } from './client'
import type { Spot, SpotStatus, VehicleType } from '../types'

export interface SpotInput {
  code: string
  vehicleType: VehicleType
}

/** posX/posY/width/height are meters in the floor-local plan space; rotation is degrees. */
export interface SpotLayoutInput {
  posX: number
  posY: number
  width: number
  height: number
  rotation: number
}

export async function listSpots(floorId: string): Promise<Spot[]> {
  const { data } = await apiClient.get<Spot[]>(`/api/floors/${floorId}/spots`)
  return data
}

export async function createSpot(floorId: string, input: SpotInput): Promise<Spot> {
  const { data } = await apiClient.post<Spot>(`/api/floors/${floorId}/spots`, input)
  return data
}

export async function updateSpotLayout(spotId: string, input: SpotLayoutInput): Promise<Spot> {
  const { data } = await apiClient.patch<Spot>(`/api/spots/${spotId}/layout`, input)
  return data
}

export async function updateSpotStatus(spotId: string, status: SpotStatus): Promise<Spot> {
  const { data } = await apiClient.patch<Spot>(`/api/spots/${spotId}/status`, { status })
  return data
}

export async function deleteSpot(spotId: string): Promise<void> {
  await apiClient.delete(`/api/spots/${spotId}`)
}
