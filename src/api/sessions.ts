import { apiClient } from './client'
import type { ParkingSession, PaymentMethod, RateType } from '../types'

export interface CheckInInput {
  spotId: string
  plateNumber: string
  rateType?: RateType
}

export interface CheckoutInput {
  rateType?: RateType
  finalAmount?: number
  paymentMethod: PaymentMethod
}

export async function checkIn(input: CheckInInput): Promise<ParkingSession> {
  const { data } = await apiClient.post<ParkingSession>('/api/sessions/check-in', input)
  return data
}

export async function checkout(sessionId: string, input: CheckoutInput): Promise<ParkingSession> {
  const { data } = await apiClient.post<ParkingSession>(`/api/sessions/${sessionId}/checkout`, input)
  return data
}

export async function searchSessionsByPlate(plate: string): Promise<ParkingSession[]> {
  const { data } = await apiClient.get<ParkingSession[]>('/api/sessions/search', { params: { plate } })
  return data
}

export async function listActiveSessions(): Promise<ParkingSession[]> {
  const { data } = await apiClient.get<ParkingSession[]>('/api/sessions/active')
  return data
}
