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
import { Textarea } from '@/components/ui/textarea'
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
import { useMovies, useScreenings, type Screening, type ScreeningInput } from '@/hooks/use-cinema'
import { CalendarClock, MapPin, MoreHorizontal, Pencil, Trash } from 'lucide-react'

const screeningSchema = z
  .object({
    movie_id: z.string().uuid('Selecciona una película válida.'),
    starts_at: z.string().min(1, 'Selecciona fecha y hora de inicio.'),
    ends_at: z.string().optional(),
    auditorium: z.string().min(1, 'Ingresa el auditorio o sala.'),
    capacity: z.coerce.number().int().positive('La capacidad debe ser mayor a cero.'),
    notes: z.string().max(2000, 'Las notas pueden tener hasta 2000 caracteres.').optional(),
  })
  .refine(
    (payload) => {
      if (!payload.ends_at) return true
      const starts = new Date(payload.starts_at)
      const ends = new Date(payload.ends_at)
      return ends > starts
    },
    {
      message: 'La hora de fin debe ser posterior al inicio.',
      path: ['ends_at'],
    }
  )

type ScreeningFormValues = z.infer<typeof screeningSchema>

const EMPTY_SCREENING: ScreeningFormValues = {
  movie_id: '',
  starts_at: '',
  ends_at: '',
  auditorium: '',
  capacity: 50,
  notes: '',
}

const toDateTimeInputValue = (iso: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  const offsetMinutes = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offsetMinutes * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

const fromDateTimeInputValue = (value: string) => {
  if (!value) return null
  return new Date(value).toISOString()
}

export function ScreeningsPage() {
  const { data: screenings, loading, error, create, update, remove } = useScreenings()
  const {
    data: movies,
    loading: moviesLoading,
    error: moviesError,
  } = useMovies()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [activeScreening, setActiveScreening] = useState<Screening | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Screening | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<ScreeningFormValues>({
    resolver: zodResolver(screeningSchema),
    defaultValues: EMPTY_SCREENING,
  })

  useEffect(() => {
    if (!dialogOpen) {
      setActiveScreening(null)
      setSubmitting(false)
      form.reset(EMPTY_SCREENING)
    }
  }, [dialogOpen, form])

  const activeMovies = useMemo(
    () =>
      movies
        .filter((movie) => movie.is_active)
        .sort((a, b) => a.title.localeCompare(b.title, 'es-ES', { sensitivity: 'base' })),
    [movies]
  )

  const handleOpenCreate = () => {
    setActiveScreening(null)
    form.reset({
      ...EMPTY_SCREENING,
      movie_id: activeMovies[0]?.id ?? '',
    })
    setDialogOpen(true)
  }

  const handleOpenEdit = (screening: Screening) => {
    setActiveScreening(screening)
    form.reset({
      movie_id: screening.movie_id,
      starts_at: toDateTimeInputValue(screening.starts_at),
      ends_at: toDateTimeInputValue(screening.ends_at ?? null),
      auditorium: screening.auditorium,
      capacity: screening.capacity,
      notes: screening.notes ?? '',
    })
    setDialogOpen(true)
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true)

    const payload: ScreeningInput = {
      movie_id: values.movie_id,
      starts_at: fromDateTimeInputValue(values.starts_at) ?? new Date().toISOString(),
      ends_at: values.ends_at ? fromDateTimeInputValue(values.ends_at) : null,
      auditorium: values.auditorium.trim(),
      capacity: values.capacity,
      notes: values.notes?.trim() ? values.notes.trim() : null,
    }

    const result = activeScreening
      ? await update(activeScreening.id, payload)
      : await create(payload)

    if (result.error) {
      toast.error(result.error)
      setSubmitting(false)
      return
    }

    toast.success(activeScreening ? 'Función actualizada.' : 'Función creada.')
    setSubmitting(false)
    setDialogOpen(false)
    setActiveScreening(null)
    form.reset(EMPTY_SCREENING)
  })

  const handleDelete = useCallback(
    async (screening: Screening) => {
      const result = await remove(screening.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Función eliminada.')
      }
      setPendingDelete(null)
    },
    [remove]
  )

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat('es-EC', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    []
  )

  const rows = useMemo(() => {
    const now = Date.now()
    return screenings.map((screening) => ({
      ...screening,
      startLabel: formatter.format(new Date(screening.starts_at)),
      endLabel: screening.ends_at ? formatter.format(new Date(screening.ends_at)) : null,
      isFuture: new Date(screening.starts_at).getTime() >= now,
    }))
  }, [screenings, formatter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Funciones</h1>
          <p className="text-sm text-muted-foreground">
            Programa horarios, auditorios y capacidad por película.
          </p>
        </div>
        <Button size="sm" onClick={handleOpenCreate} disabled={activeMovies.length === 0}>
          Nueva función
        </Button>
      </div>

      {activeMovies.length === 0 && !moviesLoading && (
        <Alert>
          <AlertDescription>
            Para crear funciones primero registra al menos una película activa.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Agenda de funciones</CardTitle>
          <CardDescription>Configura la agenda para habilitar reservas y seguimiento de asistencia.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(error || moviesError) && (
            <Alert variant="destructive">
              <AlertDescription>{error ?? moviesError}</AlertDescription>
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
                    <TableHead>Película</TableHead>
                    <TableHead className="hidden md:table-cell">Inicio</TableHead>
                    <TableHead className="hidden lg:table-cell">Fin</TableHead>
                    <TableHead className="hidden sm:table-cell">Auditorio</TableHead>
                    <TableHead className="hidden sm:table-cell text-center">Capacidad</TableHead>
                    <TableHead className="w-0 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length > 0 ? (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.movie?.title ?? 'Película eliminada'}</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <CalendarClock className="h-3.5 w-3.5" /> {row.startLabel}
                            </span>
                            <Badge variant={row.isFuture ? 'default' : 'secondary'}>
                              {row.isFuture ? 'Próxima' : 'Finalizada'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{row.startLabel}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">
                          {row.endLabel ?? '—'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" /> {row.auditorium}
                          </span>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-center text-sm">
                          {row.capacity}
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
                              <DropdownMenuItem onClick={() => handleOpenEdit(row)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setPendingDelete(row)}
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
                        Aún no hay funciones programadas.
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
            <DialogTitle>{activeScreening ? 'Editar función' : 'Nueva función'}</DialogTitle>
            <DialogDescription>
              Define los detalles de la función para habilitar reservas y control de asistencia.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="movie_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Película</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={activeMovies.length === 0}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecciona una película" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeMovies.map((movie) => (
                          <SelectItem key={movie.id} value={movie.id}>
                            {movie.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="starts_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inicio</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ends_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fin (opcional)</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          value={field.value ?? ''}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="auditorium"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Auditorio / Sala</FormLabel>
                      <FormControl>
                        <Input placeholder="Aula Magna" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacidad</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={Number.isNaN(field.value) ? '' : field.value}
                          onChange={(event) => {
                            const value = event.target.value
                            field.onChange(value === '' ? value : Number(value))
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notas (opcional)</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder="Información adicional para el staff." {...field} />
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
                <Button type="submit" disabled={submitting || activeMovies.length === 0}>
                  {submitting ? 'Guardando...' : activeScreening ? 'Guardar cambios' : 'Crear función'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar función?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará la función y sus reservas asociadas.
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


