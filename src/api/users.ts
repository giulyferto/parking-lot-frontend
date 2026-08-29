import { apiClient } from './client'
import type { AppUser, Role } from '../types'

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: Role
}

export async function listUsers(): Promise<AppUser[]> {
  const { data } = await apiClient.get<AppUser[]>('/api/admin/users')
  return data
}

export async function createUser(input: CreateUserInput): Promise<AppUser> {
  const { data } = await apiClient.post<AppUser>('/api/admin/users', input)
  return data
}
