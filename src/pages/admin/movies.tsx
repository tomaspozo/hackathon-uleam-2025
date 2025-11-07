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
import { Switch } from '@/components/ui/switch'
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
import { useMovies, type Movie, type MovieInput } from '@/hooks/use-cinema'
import { MoreHorizontal, Pencil, Trash } from 'lucide-react'

const movieSchema = z.object({
  title: z.string().min(1, 'El título es obligatorio.'),
  synopsis: z
    .string()
    .max(5000, 'La sinopsis puede tener hasta 5000 caracteres.')
    .optional(),
  duration_minutes: z.coerce.number().int().positive('Ingresa una duración válida en minutos.'),
  rating: z.string().max(100, 'Usa un formato corto para la clasificación.').optional(),
  poster_url: z
    .string()
    .url('Ingresa una URL válida.')
    .or(z.literal(''))
    .optional(),
  is_active: z.boolean(),
})

type MovieFormValues = z.infer<typeof movieSchema>

const EMPTY_MOVIE: MovieFormValues = {
  title: '',
  synopsis: '',
  duration_minutes: 90,
  rating: '',
  poster_url: '',
  is_active: true,
}

export function MoviesPage() {
  const { data: movies, loading, error, create, update, remove } = useMovies()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Movie | null>(null)
  const [activeMovie, setActiveMovie] = useState<Movie | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<MovieFormValues>({
    resolver: zodResolver(movieSchema),
    defaultValues: EMPTY_MOVIE,
  })

  useEffect(() => {
    if (!dialogOpen) {
      setActiveMovie(null)
      setSubmitting(false)
      form.reset(EMPTY_MOVIE)
    }
  }, [dialogOpen, form])

  const handleOpenCreate = () => {
    setActiveMovie(null)
    form.reset(EMPTY_MOVIE)
    setDialogOpen(true)
  }

  const handleOpenEdit = (movie: Movie) => {
    setActiveMovie(movie)
    form.reset({
      title: movie.title,
      synopsis: movie.synopsis ?? '',
      duration_minutes: movie.duration_minutes ?? 90,
      rating: movie.rating ?? '',
      poster_url: movie.poster_url ?? '',
      is_active: movie.is_active,
    })
    setDialogOpen(true)
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true)

    const payload: MovieInput = {
      title: values.title.trim(),
      synopsis: values.synopsis?.trim() ? values.synopsis.trim() : null,
      duration_minutes: values.duration_minutes,
      rating: values.rating?.trim() ? values.rating.trim() : null,
      poster_url: values.poster_url?.trim() ? values.poster_url.trim() : null,
      is_active: values.is_active,
    }

    const action = activeMovie
      ? await update(activeMovie.id, payload)
      : await create(payload)

    if (action.error) {
      toast.error(action.error)
      setSubmitting(false)
      return
    }

    toast.success(activeMovie ? 'Película actualizada.' : 'Película creada.')
    setSubmitting(false)
    setDialogOpen(false)
    setActiveMovie(null)
    form.reset(EMPTY_MOVIE)
  })

  const handleDelete = useCallback(
    async (movie: Movie) => {
      const result = await remove(movie.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Se eliminó "${movie.title}".`)
      }
      setPendingDelete(null)
    },
    [remove]
  )

  const hasMovies = movies.length > 0
  const tableRows = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('es-EC', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
    return movies.map((movie) => ({
      ...movie,
      updatedLabel: formatter.format(new Date(movie.updated_at)),
    }))
  }, [movies])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Películas</h1>
          <p className="text-sm text-muted-foreground">
            Administra el catálogo de películas disponible para programación.
          </p>
        </div>
        <Button size="sm" onClick={handleOpenCreate}>
          Nueva película
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de películas</CardTitle>
          <CardDescription>Consulta y gestiona las películas disponibles para reservar funciones.</CardDescription>
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
                    <TableHead>Título</TableHead>
                    <TableHead className="hidden sm:table-cell">Duración</TableHead>
                    <TableHead className="hidden md:table-cell">Estado</TableHead>
                    <TableHead className="hidden lg:table-cell">Actualización</TableHead>
                    <TableHead className="w-0 text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hasMovies ? (
                    tableRows.map((movie) => (
                      <TableRow key={movie.id}>
                        <TableCell>
                          <div className="font-medium">{movie.title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {movie.synopsis || 'Sin sinopsis'}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {movie.duration_minutes ? `${movie.duration_minutes} min` : '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant={movie.is_active ? 'default' : 'outline'}>
                            {movie.is_active ? 'Activa' : 'Inactiva'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {movie.updatedLabel}
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
                              <DropdownMenuItem onClick={() => handleOpenEdit(movie)}>
                                <Pencil className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setPendingDelete(movie)}
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
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                        No hay películas registradas todavía.
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{activeMovie ? 'Editar película' : 'Nueva película'}</DialogTitle>
            <DialogDescription>
              {activeMovie
                ? 'Actualiza la información para mantener tu catálogo al día.'
                : 'Completa los datos para agregar una nueva película a la cartelera.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Duna: Parte 2" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="synopsis"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sinopsis</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder="Describe brevemente la trama." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="duration_minutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duración (min)</FormLabel>
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
                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Clasificación</FormLabel>
                      <FormControl>
                        <Input placeholder="PG-13" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="poster_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL del póster</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>Disponible</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Controla si la película aparece en la programación.
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
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
                  {submitting ? 'Guardando...' : activeMovie ? 'Guardar cambios' : 'Crear película'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={() => setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar película?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer y eliminará la película de la cartelera.
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


