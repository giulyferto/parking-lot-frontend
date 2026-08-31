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
  // posX/posY/width/height are meters in the floor-local plan space - the same
  // coordinate system FloorElement geometry uses (shared origin). rotation is
  // degrees. See components/FloorMap - 1 SVG user unit renders as 1 meter.
  posX: number
  posY: number
  width: number
  height: number
  rotation: number
}

/**
 * A non-spot thing drawn on the floor plan: the outer boundary wall, columns,
 * interior walls, drive lanes, the street outside, entrances, text labels.
 * One flexible list keyed by `kind` rather than a table per kind. Geometry
 * coordinates are meters in the same floor-local space as Spot positions.
 * Mirrors the backend's FloorElement - keep the two in sync.
 */
export type FloorElementKind =
  | 'BOUNDARY' // outer wall polygon - at most one per floor
  | 'COLUMN' // structural column
  | 'WALL' // interior wall segment
  | 'DRIVE_LANE' // internal drive aisle
  | 'STREET' // public street / approach road
  | 'ENTRANCE' // vehicle entry/exit - 2-point line on the BOUNDARY, drawn as an opening rectangle in the wall
  | 'LABEL' // free-text annotation

/** GeoJSON-ish geometry. `coordinates` are [x, y] pairs in meters. */
export interface PolygonGeometry {
  type: 'Polygon'
  /** A single implicitly-closed ring, >= 3 vertices. */
  coordinates: [number, number][]
}
export interface PolylineGeometry {
  type: 'LineString'
  /** >= 2 vertices. */
  coordinates: [number, number][]
}
export interface PointGeometry {
  type: 'Point'
  coordinates: [number, number]
}
export type Geometry = PolygonGeometry | PolylineGeometry | PointGeometry

export interface FloorElementStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number // screen px, drawn with vector-effect: non-scaling-stroke
  strokeDasharray?: string
  widthM?: number // DRIVE_LANE / STREET: real lane width in meters; BOUNDARY: wall thickness in meters
  radiusM?: number // COLUMN: radius in meters
  label?: string // LABEL text; optional caption on any kind
  opacity?: number // 0..1
}

export interface FloorElement {
  id: string
  floorId: string
  kind: FloorElementKind
  geometry: Geometry
  style?: FloorElementStyle
  z?: number // stacking order within a kind; default 0
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

/**
 * Payload pushed over /topic/floors/{floorId} - see websocket.SpotStatusMessage
 * on the backend. Status-only; floor-plan geometry is never pushed.
 */
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
