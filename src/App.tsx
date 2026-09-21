import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { MapPage } from './pages/MapPage'
import { ParkingLotsPage } from './pages/admin/ParkingLotsPage'
import { ParkingLotDetailPage } from './pages/admin/ParkingLotDetailPage'
import { FloorEditorPage } from './pages/admin/FloorEditorPage'
import { FloorRatesPage } from './pages/admin/FloorRatesPage'
import { UsersPage } from './pages/admin/UsersPage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<MapPage />} />
          <Route
            path="/admin/parking-lots"
            element={
              <ProtectedRoute adminOnly>
                <ParkingLotsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/parking-lots/:lotId"
            element={
              <ProtectedRoute adminOnly>
                <ParkingLotDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/floors/:floorId"
            element={
              <ProtectedRoute adminOnly>
                <FloorEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/floors/:floorId/rates"
            element={
              <ProtectedRoute adminOnly>
                <FloorRatesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute adminOnly>
                <UsersPage />
              </ProtectedRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
