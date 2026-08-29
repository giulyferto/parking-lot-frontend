import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import type { Role } from '../types'

/** Wrap a route element in this; pass `adminOnly` for admin-management pages. */
export function ProtectedRoute({
  children,
  adminOnly = false,
}: {
  children: ReactNode
  adminOnly?: boolean
}) {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const requiredRole: Role = 'ADMIN'
  if (adminOnly && user.role !== requiredRole) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
