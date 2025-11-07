import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useSupabase } from '@/hooks/use-supabase'
import { useProfile } from '@/hooks/use-profile'
import { Spinner } from '@/components/ui/spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OtpAuth } from '@/components/auth/otp-auth'
import { AdminLayout } from '@/layouts/admin-layout'
import { DashboardPage } from '@/pages/admin/dashboard'
import { MoviesPage } from '@/pages/admin/movies'
import { ScreeningsPage } from '@/pages/admin/screenings'
import { ReservationsPage } from '@/pages/admin/reservations'
import { AttendancePage } from '@/pages/admin/attendance'

function FullScreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Spinner className="h-8 w-8" />
    </div>
  )
}

function AuthGate() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Inicia sesión</CardTitle>
          <CardDescription>
            Accede al panel administrativo del Cine ULEAM con tu correo institucional.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <OtpAuth />
        </CardContent>
      </Card>
    </div>
  )
}

function AccessDenied() {
  const { signOut } = useSupabase()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Acceso restringido</CardTitle>
          <CardDescription>
            Tu cuenta no tiene permisos de administrador. Solicita acceso al equipo del cine o
            cierra sesión para ingresar con otra cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Button onClick={() => void signOut()}>Cerrar sesión</Button>
        </CardContent>
      </Card>
    </div>
  )
}

function App() {
  const { user, loading: authLoading } = useSupabase()
  const { profile, loading: profileLoading } = useProfile()

  if (authLoading || profileLoading) {
    return <FullScreenLoader />
  }

  if (!user) {
    return <AuthGate />
  }

  const isAdmin = profile?.role === 'admin'

  if (!isAdmin) {
    return <AccessDenied />
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="movies" element={<MoviesPage />} />
          <Route path="screenings" element={<ScreeningsPage />} />
          <Route path="reservations" element={<ReservationsPage />} />
          <Route path="attendance" element={<AttendancePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
