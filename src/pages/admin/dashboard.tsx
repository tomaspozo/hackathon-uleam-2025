import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { useScreeningStats } from '@/hooks/use-cinema'
import { RefreshCw } from 'lucide-react'

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

export function DashboardPage() {
  const { data: stats, loading, error, refresh } = useScreeningStats()

  const upcoming = useMemo(
    () => stats.filter((stat) => new Date(stat.starts_at).getTime() >= Date.now()),
    [stats]
  )

  const totals = useMemo(() => {
    if (stats.length === 0) {
      return {
        avgOccupancy: 0,
        totalReservations: 0,
        totalCheckedIn: 0,
        totalCapacity: 0,
      }
    }

    const sum = stats.reduce(
      (acc, stat) => {
        acc.avgOccupancy += stat.occupancy_rate
        acc.totalReservations += stat.total_reservations
        acc.totalCheckedIn += stat.checked_in_count
        acc.totalCapacity += stat.capacity
        return acc
      },
      { avgOccupancy: 0, totalReservations: 0, totalCheckedIn: 0, totalCapacity: 0 }
    )

    return {
      avgOccupancy: Math.round((sum.avgOccupancy / stats.length) * 100) / 100,
      totalReservations: sum.totalReservations,
      totalCheckedIn: sum.totalCheckedIn,
      totalCapacity: sum.totalCapacity,
    }
  }, [stats])

  const topUpcoming = useMemo(
    () =>
      [...upcoming]
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
        .slice(0, 5),
    [upcoming]
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resumen general</h1>
          <p className="text-sm text-muted-foreground">
            Visualiza el estado actual de la ocupación y las actividades del Cine ULEAM.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Actualizar
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Funciones programadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats.length}</div>
            <p className="text-xs text-muted-foreground">Total histórico registradas en el sistema.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reservas totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{totals.totalReservations}</div>
            <p className="text-xs text-muted-foreground">Incluye reservaciones confirmadas y pendientes.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Asistencias validadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{totals.totalCheckedIn}</div>
            <p className="text-xs text-muted-foreground">Escaneos de QR registrados en la entrada.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ocupación promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{totals.avgOccupancy.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Promedio considerando todas las funciones registradas.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Funciones próximas</CardTitle>
            <CardDescription>
              Seguimiento de las siguientes funciones con su nivel de ocupación y aforo disponible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner className="h-6 w-6" />
              </div>
            ) : topUpcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Programa una nueva función para ver estadísticas en este panel.
              </p>
            ) : (
              <div className="space-y-4">
                {topUpcoming.map((stat) => {
                  const available = Math.max(stat.capacity - stat.active_reservations, 0)
                  return (
                    <div key={stat.screening_id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h3 className="text-base font-semibold leading-tight">{stat.movie_title ?? 'Película'}</h3>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(stat.starts_at)} · {stat.auditorium}
                          </p>
                        </div>
                        <Badge variant={available === 0 ? 'destructive' : 'secondary'}>
                          {available === 0 ? 'Completa' : `${available} cupos libres`}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Ocupación {stat.occupancy_rate.toFixed(1)}%</span>
                          <span>
                            {stat.active_reservations}/{stat.capacity} reservas
                          </span>
                        </div>
                        <Progress value={Number(stat.occupancy_rate)} className="h-2" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Asistencias registradas</span>
                          <span>{stat.checked_in_count}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking de funciones</CardTitle>
            <CardDescription>Comparativa de ocupación vs asistencia para todas las funciones.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner className="h-6 w-6" />
              </div>
            ) : stats.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay registros disponibles todavía.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Función</TableHead>
                    <TableHead className="text-right">Ocupación</TableHead>
                    <TableHead className="text-right">Asistencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...stats]
                    .sort((a, b) => b.occupancy_rate - a.occupancy_rate)
                    .slice(0, 8)
                    .map((stat) => (
                      <TableRow key={stat.screening_id}>
                        <TableCell>
                          <div className="font-medium leading-tight">{stat.movie_title ?? 'Película'}</div>
                          <div className="text-xs text-muted-foreground">{formatDateTime(stat.starts_at)}</div>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {stat.occupancy_rate.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {stat.attendance_rate.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


