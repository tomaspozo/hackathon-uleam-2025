import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useReservations,
  useScreenings,
  type Reservation,
  type ReservationInput,
  type ReservationStatus,
} from '@/hooks/use-cinema'
import { supabase } from '@/lib/supabase/client'
import { ClipboardCopy, MoreHorizontal, Pencil, Trash } from 'lucide-react'

const reservationSchema = z.object({
  screening_id: z.string().uuid('Selecciona una función.'),
  user_id: z.string().uuid('Selecciona un usuario.'),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'checked_in', 'no_show']),
  seat_label: z.string().max(50, 'Máximo 50 caracteres.').optional(),
})

type ReservationFormValues = z.infer<typeof reservationSchema>

const EMPTY_RESERVATION: ReservationFormValues = {
  screening_id: '',
  user_id: '',
  status: 'confirmed',
  seat_label: '',
}

type ProfileOption = {
  user_id: string
  label: string
}

const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: 'Pendiente',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  checked_in: 'Asistencia validada',
  no_show: 'No asistió',
}

const STATUS_VARIANTS: Record<ReservationStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  pending: 'secondary',
  confirmed: 'default',
  cancelled: 'outline',
  checked_in: 'default',
  no_show: 'destructive',
}

const buildProfileLabel = (userId: string, firstName?: string | null, lastName?: string | null) => {
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  if (fullName) {
    return `${fullName} · ${userId.slice(0, 8)}…`
  }
  return userId
}

const formatDateTime = (iso: string) => {
  return new Intl.DateTimeFormat('es-EC', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}

export function ReservationsPage() {
  const { data: reservations, loading, error, create, update, remove } = useReservations()
  const { data: screenings, loading: screeningsLoading } = useScreenings()
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [profilesError, setProfilesError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeReservation, setActiveReservation] = useState<Reservation | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Reservation | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: EMPTY_RESERVATION,
  })

  useEffect(() => {
    let cancelled = false
    const loadProfiles = async () => {
      setProfilesLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name')
        .order('first_name', { ascending: true })

      if (cancelled) return

      if (error) {
        setProfilesError(error.message)
        setProfiles([])
      } else {
        setProfilesError(null)
        setProfiles(
          (data ?? []).map((profile) => ({
            user_id: profile.user_id,
            label: buildProfileLabel(profile.user_id, profile.first_name, profile.last_name),
          }))
        )
      }
      setProfilesLoading(false)
    }

    void loadProfiles()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!dialogOpen) {
      setActiveReservation(null)
      setSubmitting(false)
      form.reset(EMPTY_RESERVATION)
    }
  }, [dialogOpen, form])

  const screeningOptions = useMemo(() => {
    return screenings.map((screening) => ({
      id: screening.id,
      label: `${screening.movie?.title ?? 'Película sin título'} · ${formatDateTime(screening.starts_at)}`,
    }))
  }, [screenings])

  const handleOpenCreate = () => {
    setActiveReservation(null)
    form.reset({
      ...EMPTY_RESERVATION,
      screening_id: screeningOptions[0]?.id ?? '',
      user_id: profiles[0]?.user_id ?? '',
    })
    setDialogOpen(true)
  }

  const handleOpenEdit = (reservation: Reservation) => {
    setActiveReservation(reservation)
    form.reset({
      screening_id: reservation.screening_id,
      user_id: reservation.user_id,
      status: reservation.status,
      seat_label: reservation.seat_label ?? '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true)

    const payload: ReservationInput = {
      screening_id: values.screening_id,
      user_id: values.user_id,
      status: values.status,
      seat_label: values.seat_label?.trim() ? values.seat_label.trim() : null,
    }

    const result = activeReservation
      ? await update(activeReservation.id, { status: payload.status, seat_label: payload.seat_label })
      : await create(payload)

    if (result.error) {
      toast.error(result.error)
      setSubmitting(false)
      return
    }

    toast.success(activeReservation ? 'Reserva actualizada.' : 'Reserva creada.')
    setSubmitting(false)
    setDialogOpen(false)
    setActiveReservation(null)
    form.reset(EMPTY_RESERVATION)
  })

  const handleDelete = useCallback(
    async (reservation: Reservation) => {
      const result = await remove(reservation.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Reserva eliminada.')
      }
      setPendingDelete(null)
    },
    [remove]
  )

  const handleCopyQr = (token: string) => {
    void navigator.clipboard.writeText(token)
    toast.success('Código QR copiado al portapapeles.')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reservas</h1>
          <p className="text-sm text-muted-foreground">
            Revisa y administra las reservas asociadas a cada función.
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleOpenCreate}
          disabled={screeningOptions.length === 0 || profiles.length === 0}
        >
          Agregar reserva
        </Button>
      </div>

      {(profilesError || (screeningOptions.length === 0 && !screeningsLoading)) && (
        <Alert>
          <AlertDescription>
            {profilesError
              ? profilesError
              : 'Debes crear funciones y contar con usuarios registrados para generar reservas.'}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Control de reservas</CardTitle>
          <CardDescription>Confirma, actualiza el estado y gestiona el aforo de cada función.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex justify-center py-10">
              <Spinner className="h-6 w-6" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Función</TableHead>
                    <TableHead className="hidden sm:table-cell">Estado</TableHead>
                    <TableHead className="hidden md:table-cell">Asiento</TableHead>
                    <TableHead className="hidden lg:table-cell">QR</TableHead>
                    <TableHead className="w-0 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.length > 0 ? (
                    reservations.map((reservation) => (
                      <TableRow key={reservation.id}>
                        <TableCell>
                          <div className="font-medium">
                            {reservation.profile
                              ? buildProfileLabel(
                                  reservation.profile.user_id,
                                  reservation.profile.first_name,
                                  reservation.profile.last_name
                                )
                              : reservation.user_id}
                          </div>
                          <div className="text-xs text-muted-foreground">{reservation.user_id.slice(0, 8)}…</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {reservation.screening?.movie?.title ?? 'Película eliminada'}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {reservation.screening ? formatDateTime(reservation.screening.starts_at) : '—'}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={STATUS_VARIANTS[reservation.status]}>
                            {STATUS_LABELS[reservation.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          {reservation.seat_label ?? 'No asignado'}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex items-center justify-start gap-2">
                            <code className="rounded bg-muted px-2 py-1 text-xs">
                              {reservation.qr_token.slice(0, 8)}…
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopyQr(reservation.qr_token)}
                            >
                              <ClipboardCopy className="h-4 w-4" />
                              <span className="sr-only">Copiar QR</span>
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Abrir menú</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleOpenEdit(reservation)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setPendingDelete(reservation)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash className="mr-2 h-4 w-4" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        Aún no se registran reservas.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{activeReservation ? 'Editar reserva' : 'Nueva reserva'}</DialogTitle>
            <DialogDescription>
              {activeReservation
                ? 'Actualiza el estado y detalles de la reserva.'
                : 'Asigna un usuario y una función para crear la reserva.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="screening_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Función</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={screeningOptions.length === 0}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona una función" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {screeningOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="user_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={profilesLoading || profiles.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona un usuario" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {profiles.map((option) => (
                            <SelectItem key={option.user_id} value={option.user_id}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona un estado" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(Object.keys(STATUS_LABELS) as ReservationStatus[]).map((status) => (
                          <SelectItem key={status} value={status}>
                            {STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="seat_label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Asiento / Referencia</FormLabel>
                    <FormControl>
                      <Input placeholder="Fila 3 - Asiento 12" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="gap-2 sm:gap-0">
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Guardando...' : activeReservation ? 'Guardar cambios' : 'Crear reserva'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción liberará el cupo asociado a la función.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) {
                  void handleDelete(pendingDelete)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


