// Mirrors the backend's DTOs (parking-lot-backend) - see that repo's CLAUDE.md
// for the domain model these come from. Kept as plain union types, not enums,
// since this project's tsconfig has erasableSyntaxOnly on.

export type Role = 'ADMIN' | 'USER'

export type VehicleType = 'CAR' | 'MOTORCYCLE' | 'EV' | 'HANDICAP'

/** Drives the D3 map's fill color - see components/FloorMap/spotColors.ts. */
export type SpotStatus = 'AVAILABLE' | 'OCCUPIED' | 'DISABLED' | 'MAINTENANCE'

export type RateType = 'HOURLY' | 'NIGHT' | 'DAY' | 'MONTH'

export type SessionStatus = 'ACTIVE' | 'CLOSED'

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'

export interface LoginResponse {
  token: string
  userId: string
  name: string
  email: string
  role: Role
}

export interface AuthUser {
  userId: string
  name: string
  email: string
  role: Role
}

export interface ParkingLot {
  id: string
  name: string
  address?: string
  currency: string
  timezone: string
  adminId: string
}

export interface Floor {
  id: string
  parkingLotId: string
  level: number
  name: string
}

export interface Spot {
  id: string
  floorId: string
  code: string
  vehicleType: VehicleType
  status: SpotStatus
  posX: number
  posY: number
  width: number
  height: number
  rotation: number
}

export interface RatePlan {
  id: string
  floorId: string
  vehicleType: VehicleType
  currency: string
  hourlyRate: number
  nightRate?: number
  dayRate?: number
  monthRate?: number
  effectiveFrom: string
}

export interface ParkingSession {
  id: string
  spotId: string
  spotCode: string
  floorId: string
  plateNumber: string
  rateType: RateType
  status: SessionStatus
  checkInAt: string
  checkOutAt?: string
  checkedInBy?: string
  checkedOutBy?: string
  computedAmount?: number
  finalAmount?: number
}

export interface AppUser {
  id: string
  name: string
  email: string
  role: Role
}

/** Payload pushed over /topic/floors/{floorId} - see websocket.SpotStatusMessage on the backend. */
export interface SpotStatusMessage {
  spotId: string
  floorId: string
  status: SpotStatus
  plateNumber?: string
  updatedAt: string
}

export interface ApiError {
  timestamp: string
  status: number
  error: string
  message: string
  details: string[]
}
