import { useCallback, useMemo, useState } from 'react'
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { useAttendanceLogs, type AttendanceLog } from '@/hooks/use-cinema'
import { useSupabase } from '@/hooks/use-supabase'
import { supabase } from '@/lib/supabase/client'
import { ClipboardCopy, RefreshCw, ShieldCheck } from 'lucide-react'

type ValidationResult = {
  message: string
  isValid: boolean
  alreadyScanned: boolean
  reservationId: string | null
  status: string | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  checked_in: 'Asistencia validada',
  no_show: 'No asistió',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  confirmed: 'default',
  cancelled: 'outline',
  checked_in: 'default',
  no_show: 'destructive',
}

const formatDateTime = (iso: string) => {
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function AttendancePage() {
  const { data: logs, loading, error, refresh } = useAttendanceLogs()
  const { user } = useSupabase()
  const [processing, setProcessing] = useState(false)
  const [lastToken, setLastToken] = useState<string | null>(null)
  const [lastScanTime, setLastScanTime] = useState<number>(0)
  const [manualToken, setManualToken] = useState('')
  const [result, setResult] = useState<ValidationResult | null>(null)

  const totalAttendance = logs.length
  const uniqueReservations = useMemo(
    () => new Set(logs.map((log) => log.reservation_id)).size,
    [logs]
  )
  const lastAttendance = logs.at(0)

  const summarizeLog = (log: AttendanceLog) => {
    const reservation = log.reservation
    const profile = reservation?.profile
    const attendee = profile
      ? `${[profile.first_name, profile.last_name].filter(Boolean).join(' ')} · ${profile.user_id.slice(0, 8)}…`
      : reservation?.user_id.slice(0, 8) ?? 'Desconocido'
    const movie = reservation?.screening?.movie?.title ?? 'Película eliminada'
    const startsAt = reservation?.screening ? formatDateTime(reservation.screening.starts_at) : '—'

    return { attendee, movie, startsAt, status: reservation?.status ?? 'pending' }
  }

  const processToken = useCallback(
    async (rawToken: string) => {
      const token = rawToken.trim()
      if (!token) return

      const now = Date.now()
      if (token === lastToken && now - lastScanTime < 4000) {
        return
      }

      setLastToken(token)
      setLastScanTime(now)

      setProcessing(true)

      const { data, error } = await supabase.rpc('validate_reservation_qr', {
        p_token: token,
        p_scanner: user?.id ?? null,
      })

      if (error) {
        toast.error(error.message)
        setResult({
          message: error.message,
          isValid: false,
          alreadyScanned: false,
          reservationId: null,
          status: null,
        })
        setProcessing(false)
        return
      }

      if (!data) {
        toast.error('No se recibió respuesta del validador.')
        setProcessing(false)
        return
      }

      const outcome: ValidationResult = {
        message: data.message,
        isValid: data.is_valid,
        alreadyScanned: data.already_scanned,
        reservationId: data.reservation_id,
        status: data.status,
      }

      setResult(outcome)

      if (data.is_valid) {
        toast.success('Asistencia registrada correctamente.')
        await refresh()
      } else if (data.already_scanned) {
        toast.info('Este código ya fue utilizado.')
      } else {
        toast.error(data.message)
      }

      setProcessing(false)
    },
    [lastScanTime, lastToken, refresh, user?.id]
  )

  const handleScan = (detectedCodes: IDetectedBarcode[]) => {
    const value = detectedCodes.at(0)?.rawValue
    if (value) {
      void processToken(value)
    }
  }

  const handleManualSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!manualToken.trim()) return
    await processToken(manualToken)
    setManualToken('')
  }

  const handleCopyToken = (token: string) => {
    void navigator.clipboard.writeText(token)
    toast.success('Token copiado al portapapeles.')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Asistencia</h1>
          <p className="text-sm text-muted-foreground">
            Valida códigos QR y lleva seguimiento de quienes asistieron.
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Escáner QR</CardTitle>
            <CardDescription>
              Permite el acceso mostrando el código de la reserva. También puedes ingresar el token manualmente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-lg border">
              <Scanner
                onScan={handleScan}
                onError={(scannerError) => {
                  console.error(scannerError)
                }}
                paused={processing}
                scanDelay={1500}
                classNames={{ container: 'aspect-video bg-black' }}
              />
            </div>

            <form onSubmit={handleManualSubmit} className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Ingresar token manualmente"
                value={manualToken}
                onChange={(event) => setManualToken(event.target.value)}
              />
              <Button type="submit" disabled={processing}>
                Validar código
              </Button>
            </form>

            {result && (
              <div
                className="rounded-md border p-4"
                data-state={result.isValid ? 'success' : result.alreadyScanned ? 'warning' : 'error'}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck
                    className={`h-4 w-4 ${
                      result.isValid
                        ? 'text-emerald-500'
                        : result.alreadyScanned
                        ? 'text-amber-500'
                        : 'text-destructive'
                    }`}
                  />
                  {result.message}
                </div>
                {result.reservationId && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Reserva {result.reservationId.slice(0, 8)}… • Estado {STATUS_LABELS[result.status ?? 'confirmed'] ?? result.status}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Asistencias registradas</div>
                <div className="text-2xl font-semibold">{totalAttendance}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Reservas únicas</div>
                <div className="text-2xl font-semibold">{uniqueReservations}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Último escaneo</div>
                <div className="text-sm font-medium">
                  {lastAttendance ? formatDateTime(lastAttendance.scanned_at) : 'Sin registros'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimos registros</CardTitle>
            <CardDescription>Verifica la bitácora de validaciones en tiempo real.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex justify-center py-10">
                <Spinner className="h-6 w-6" />
              </div>
            ) : logs.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Aún no hay asistencias registradas.</p>
            ) : (
              <div className="max-h-[420px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Función</TableHead>
                      <TableHead className="hidden lg:table-cell">Estado</TableHead>
                      <TableHead className="hidden xl:table-cell text-right">Token</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const summary = summarizeLog(log)
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-sm">{formatDateTime(log.scanned_at)}</TableCell>
                          <TableCell className="text-sm">{summary.attendee}</TableCell>
                          <TableCell className="text-sm">
                            <div className="font-medium leading-tight">{summary.movie}</div>
                            <div className="text-xs text-muted-foreground">{summary.startsAt}</div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <Badge variant={STATUS_VARIANTS[summary.status] ?? 'secondary'}>
                              {STATUS_LABELS[summary.status] ?? summary.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell text-right">
                            <div className="flex items-center justify-end gap-2">
                              <code className="rounded bg-muted px-2 py-1 text-xs">
                                {log.reservation?.qr_token.slice(0, 10)}…
                              </code>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => log.reservation?.qr_token && handleCopyToken(log.reservation.qr_token)}
                              >
                                <ClipboardCopy className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


