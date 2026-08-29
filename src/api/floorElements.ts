import { apiClient } from './client'
import type { FloorElement, FloorElementKind, FloorElementStyle, Geometry } from '../types'

export interface FloorElementInput {
  kind: FloorElementKind
  geometry: Geometry
  style?: FloorElementStyle
  z?: number
}

export interface FloorElementPatch {
  kind?: FloorElementKind
  geometry?: Geometry
  style?: FloorElementStyle
  z?: number
}

export async function listFloorElements(floorId: string): Promise<FloorElement[]> {
  const { data } = await apiClient.get<FloorElement[]>(`/api/floors/${floorId}/elements`)
  return data
}

export async function createFloorElement(
  floorId: string,
  input: FloorElementInput,
): Promise<FloorElement> {
  const { data } = await apiClient.post<FloorElement>(`/api/floors/${floorId}/elements`, input)
  return data
}

export async function updateFloorElement(
  id: string,
  patch: FloorElementPatch,
): Promise<FloorElement> {
  const { data } = await apiClient.patch<FloorElement>(`/api/floor-elements/${id}`, patch)
  return data
}

export async function deleteFloorElement(id: string): Promise<void> {
  await apiClient.delete(`/api/floor-elements/${id}`)
}
