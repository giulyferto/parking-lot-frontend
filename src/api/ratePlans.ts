import { apiClient } from './client'
import type { RatePlan, VehicleType } from '../types'

export interface RatePlanInput {
  vehicleType: VehicleType
  currency?: string
  hourlyRate: number
  nightRate?: number
  dayRate?: number
  monthRate?: number
}

export async function listRatePlans(floorId: string): Promise<RatePlan[]> {
  const { data } = await apiClient.get<RatePlan[]>(`/api/floors/${floorId}/rate-plans`)
  return data
}

export async function createRatePlan(floorId: string, input: RatePlanInput): Promise<RatePlan> {
  const { data } = await apiClient.post<RatePlan>(`/api/floors/${floorId}/rate-plans`, input)
  return data
}
