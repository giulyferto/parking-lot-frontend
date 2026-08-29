import { apiClient } from './client'
import type { ParkingLot } from '../types'

export interface ParkingLotInput {
  name: string
  address?: string
  currency?: string
  timezone?: string
}

export async function listParkingLots(): Promise<ParkingLot[]> {
  const { data } = await apiClient.get<ParkingLot[]>('/api/parking-lots')
  return data
}

export async function getParkingLot(id: string): Promise<ParkingLot> {
  const { data } = await apiClient.get<ParkingLot>(`/api/parking-lots/${id}`)
  return data
}

export async function createParkingLot(input: ParkingLotInput): Promise<ParkingLot> {
  const { data } = await apiClient.post<ParkingLot>('/api/parking-lots', input)
  return data
}
