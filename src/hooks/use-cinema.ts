import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

const sanitizePayload = <T extends Record<string, unknown>>(input: T): T => {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as T
}

export type Movie = {
  id: string
  title: string
  synopsis: string | null
  duration_minutes: number | null
  rating: string | null
  poster_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type MovieInput = {
  title: string
  synopsis?: string | null
  duration_minutes?: number | null
  rating?: string | null
  poster_url?: string | null
  is_active?: boolean
}

export type Screening = {
  id: string
  movie_id: string
  starts_at: string
  ends_at: string | null
  auditorium: string
  capacity: number
  notes: string | null
  created_at: string
  updated_at: string
  movie?: Pick<Movie, 'id' | 'title' | 'duration_minutes'> | null
}

export type ScreeningInput = {
  movie_id: string
  starts_at: string
  ends_at?: string | null
  auditorium: string
  capacity: number
  notes?: string | null
}

export type ScreeningStat = {
  screening_id: string
  movie_id: string | null
  movie_title: string | null
  starts_at: string
  ends_at: string | null
  auditorium: string
  capacity: number
  total_reservations: number
  active_reservations: number
  checked_in_count: number
  occupancy_rate: number
  attendance_rate: number
  created_at: string
  updated_at: string
}

export type ReservationStatus = 'pending' | 'confirmed' | 'cancelled' | 'checked_in' | 'no_show'

export type Reservation = {
  id: string
  screening_id: string
  user_id: string
  status: ReservationStatus
  seat_label: string | null
  qr_token: string
  reserved_at: string
  created_at: string
  updated_at: string
  screening?: Screening | null
  profile?: {
    user_id: string
    first_name: string | null
    last_name: string | null
    role: string
  } | null
}

export type ReservationInput = {
  screening_id: string
  user_id: string
  status?: ReservationStatus
  seat_label?: string | null
}

export type AttendanceLog = {
  id: string
  reservation_id: string
  scanned_by: string | null
  scanned_at: string
  created_at: string
  reservation?: Reservation | null
}

export type AttendanceInput = {
  reservation_id: string
  scanned_by?: string | null
}

type HookResult<T, CreateInput, UpdateInput> = {
  data: T[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  create: (input: CreateInput) => Promise<{ data: T | null; error: string | null }>
  update: (id: string, input: UpdateInput) => Promise<{ data: T | null; error: string | null }>
  remove: (id: string) => Promise<{ error: string | null }>
}

type ScreeningRow = Screening & {
  movie: Pick<Movie, 'id' | 'title' | 'duration_minutes'> | null
}

type ReservationRow = Reservation & {
  screening: ScreeningRow | null
  profile: Reservation['profile']
}

type AttendanceRow = AttendanceLog & {
  reservation: ReservationRow | null
}

export function useMovies(): HookResult<Movie, MovieInput, Partial<MovieInput>> {
  const [movies, setMovies] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('movies')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      setMovies([])
    } else {
      setError(null)
      setMovies((data ?? []) as Movie[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback<HookResult<Movie, MovieInput, Partial<MovieInput>>['create']>(
    async (input) => {
      const payload = sanitizePayload({
        ...input,
      })
      const { data, error } = await supabase
        .from('movies')
        .insert(payload)
        .select()
        .single()

      if (error) {
        return { data: null, error: error.message }
      }

      const record = data as Movie
      setMovies((current) => [record, ...current])
      return { data: record, error: null }
    },
    []
  )

  const update = useCallback<HookResult<Movie, MovieInput, Partial<MovieInput>>['update']>(
    async (id, input) => {
      const payload = sanitizePayload({
        ...input,
      })

      const { data, error } = await supabase
        .from('movies')
        .update(payload)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        return { data: null, error: error.message }
      }

      const record = data as Movie
      setMovies((current) => current.map((movie) => (movie.id === id ? record : movie)))
      return { data: record, error: null }
    },
    []
  )

  const remove = useCallback<HookResult<Movie, MovieInput, Partial<MovieInput>>['remove']>(
    async (id) => {
      const { error } = await supabase.from('movies').delete().eq('id', id)
      if (error) {
        return { error: error.message }
      }
      setMovies((current) => current.filter((movie) => movie.id !== id))
      return { error: null }
    },
    []
  )

  return { data: movies, loading, error, refresh, create, update, remove }
}

export function useScreenings(): HookResult<Screening, ScreeningInput, Partial<ScreeningInput>> {
  const [screenings, setScreenings] = useState<Screening[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('screenings')
      .select('*, movie:movies(id, title, duration_minutes)')
      .order('starts_at', { ascending: true })

    if (error) {
      setError(error.message)
      setScreenings([])
    } else {
      const normalized = ((data ?? []) as ScreeningRow[]).map((row) => ({
        ...row,
        movie: row.movie ?? null,
      }))
      setError(null)
      setScreenings(normalized)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback<HookResult<Screening, ScreeningInput, Partial<ScreeningInput>>['create']>(
    async (input) => {
      const payload = sanitizePayload({
        ...input,
      })

      const { data, error } = await supabase
        .from('screenings')
        .insert(payload)
        .select('*, movie:movies(id, title, duration_minutes)')
        .single()

      if (error) {
        return { data: null, error: error.message }
      }

      const screeningData = data as ScreeningRow
      const record: Screening = {
        ...screeningData,
        movie: screeningData.movie ?? null,
      }
      setScreenings((current) => [record, ...current])
      return { data: record, error: null }
    },
    []
  )

  const update = useCallback<HookResult<Screening, ScreeningInput, Partial<ScreeningInput>>['update']>(
    async (id, input) => {
      const payload = sanitizePayload({
        ...input,
      })

      const { data, error } = await supabase
        .from('screenings')
        .update(payload)
        .eq('id', id)
        .select('*, movie:movies(id, title, duration_minutes)')
        .single()

      if (error) {
        return { data: null, error: error.message }
      }

      const screeningData = data as ScreeningRow
      const record: Screening = {
        ...screeningData,
        movie: screeningData.movie ?? null,
      }
      setScreenings((current) => current.map((screening) => (screening.id === id ? record : screening)))
      return { data: record, error: null }
    },
    []
  )

  const remove = useCallback<HookResult<Screening, ScreeningInput, Partial<ScreeningInput>>['remove']>(
    async (id) => {
      const { error } = await supabase.from('screenings').delete().eq('id', id)
      if (error) {
        return { error: error.message }
      }
      setScreenings((current) => current.filter((screening) => screening.id !== id))
      return { error: null }
    },
    []
  )

  return { data: screenings, loading, error, refresh, create, update, remove }
}

export function useReservations(): HookResult<Reservation, ReservationInput, Partial<ReservationInput>> {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const baseSelect =
    '*, screening:screenings(*, movie:movies(id, title, duration_minutes)), profile:profiles(user_id, first_name, last_name, role)'

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('reservations')
      .select(baseSelect)
      .order('reserved_at', { ascending: false })

    if (error) {
      setError(error.message)
      setReservations([])
    } else {
      const normalized = ((data ?? []) as ReservationRow[]).map((row) => ({
        ...row,
        screening: row.screening ?? null,
        profile: row.profile ?? null,
      }))
      setError(null)
      setReservations(normalized)
    }
    setLoading(false)
  }, [baseSelect])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback<
    HookResult<Reservation, ReservationInput, Partial<ReservationInput>>['create']
  >(async (input) => {
    const payload = sanitizePayload({
      screening_id: input.screening_id,
      user_id: input.user_id,
      status: input.status ?? 'confirmed',
      seat_label: input.seat_label ?? null,
    })

    const { data, error } = await supabase
      .from('reservations')
      .insert(payload)
      .select(baseSelect)
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    const reservationData = data as ReservationRow
    const record: Reservation = {
      ...reservationData,
      screening: reservationData.screening ?? null,
      profile: reservationData.profile ?? null,
    }

    setReservations((current) => [record, ...current])
    return { data: record, error: null }
  }, [baseSelect])

  const update = useCallback<
    HookResult<Reservation, ReservationInput, Partial<ReservationInput>>['update']
  >(async (id, input) => {
    const payload = sanitizePayload({
      status: input.status,
      seat_label: input.seat_label,
    })

    const { data, error } = await supabase
      .from('reservations')
      .update(payload)
      .eq('id', id)
      .select(baseSelect)
      .single()

    if (error) {
      return { data: null, error: error.message }
    }

    const reservationData = data as ReservationRow
    const record: Reservation = {
      ...reservationData,
      screening: reservationData.screening ?? null,
      profile: reservationData.profile ?? null,
    }

    setReservations((current) => current.map((reservation) => (reservation.id === id ? record : reservation)))
    return { data: record, error: null }
  }, [baseSelect])

  const remove = useCallback<
    HookResult<Reservation, ReservationInput, Partial<ReservationInput>>['remove']
  >(async (id) => {
      const { error } = await supabase.from('reservations').delete().eq('id', id)
    if (error) {
      return { error: error.message }
    }
    setReservations((current) => current.filter((reservation) => reservation.id !== id))
    return { error: null }
  }, [])

  return { data: reservations, loading, error, refresh, create, update, remove }
}

export function useAttendanceLogs(): HookResult<AttendanceLog, AttendanceInput, Partial<AttendanceInput>> {
  const [attendance, setAttendance] = useState<AttendanceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const select =
    '*, reservation:reservations(*, screening:screenings(*, movie:movies(id, title, duration_minutes)), profile:profiles(user_id, first_name, last_name, role))'

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('attendance_logs')
      .select(select)
      .order('scanned_at', { ascending: false })

    if (error) {
      setError(error.message)
      setAttendance([])
    } else {
      const normalized = ((data ?? []) as AttendanceRow[]).map((row) => ({
        ...row,
        reservation: row.reservation ?? null,
      }))
      setError(null)
      setAttendance(normalized)
    }
    setLoading(false)
  }, [select])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = useCallback<HookResult<AttendanceLog, AttendanceInput, Partial<AttendanceInput>>['create']>(
    async (input) => {
      const payload = sanitizePayload({
        reservation_id: input.reservation_id,
        scanned_by: input.scanned_by ?? null,
      })

      const { data, error } = await supabase
        .from('attendance_logs')
        .insert(payload)
        .select(select)
        .single()

      if (error) {
        return { data: null, error: error.message }
      }

      const attendanceData = data as AttendanceRow
      const record: AttendanceLog = {
        ...attendanceData,
        reservation: attendanceData.reservation ?? null,
      }

      setAttendance((current) => [record, ...current])
      return { data: record, error: null }
    },
    [select]
  )

  const update = useCallback<HookResult<AttendanceLog, AttendanceInput, Partial<AttendanceInput>>['update']>(
    async (id, input) => {
      const payload = sanitizePayload({
        scanned_by: input.scanned_by ?? null,
      })

      const { error } = await supabase
        .from('attendance_logs')
        .update(payload)
        .eq('id', id)
      if (error) {
        return { data: null, error: error.message }
      }

      const refreshed = await supabase
        .from('attendance_logs')
        .select(select)
        .eq('id', id)
        .single()

      if (refreshed.error || !refreshed.data) {
        return { data: null, error: refreshed.error?.message ?? null }
      }

      const refreshedData = refreshed.data as AttendanceRow
      const record: AttendanceLog = {
        ...refreshedData,
        reservation: refreshedData.reservation ?? null,
      }

      setAttendance((current) => current.map((log) => (log.id === id ? record : log)))
      return { data: record, error: null }
    },
    [select]
  )

  const remove = useCallback<HookResult<AttendanceLog, AttendanceInput, Partial<AttendanceInput>>['remove']>(
    async (id) => {
      const { error } = await supabase.from('attendance_logs').delete().eq('id', id)
      if (error) {
        return { error: error.message }
      }
      setAttendance((current) => current.filter((log) => log.id !== id))
      return { error: null }
    },
    []
  )

  return { data: attendance, loading, error, refresh, create, update, remove }
}

export function useScreeningStats() {
  const [stats, setStats] = useState<ScreeningStat[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('screening_stats')
      .select('*')
      .order('starts_at', { ascending: true })

    if (error) {
      setError(error.message)
      setStats([])
    } else {
      setError(null)
      setStats((data ?? []) as ScreeningStat[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { data: stats, loading, error, refresh }
}


