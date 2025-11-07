-- migration: cinema_schema
-- purpose: establish core cinema entities for movies, screenings, reservations, and attendance tracking.

-- ensure pgcrypto is available for uuid generation.
create extension if not exists pgcrypto;

-- define reservation status lifecycle.
do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'reservation_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.reservation_status as enum (
      'pending',
      'confirmed',
      'cancelled',
      'checked_in',
      'no_show'
    );
  end if;
end
$$;

-- generic trigger function to keep updated_at in sync.
create or replace function public.handle_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ensure profiles track simple role metadata for authorization checks.
alter table if exists public.profiles
  add column if not exists role text not null default 'student';

comment on column public.profiles.role is 'Role used for authorization (e.g., admin, student).';

create index if not exists profiles_role_idx on public.profiles (role);

-- helper to reuse admin guard within policies.
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

create policy "admins can read profiles"
  on public.profiles
  for select
  to authenticated
  using ((select public.current_user_is_admin()));

create policy "admins can insert profiles"
  on public.profiles
  for insert
  to authenticated
  with check ((select public.current_user_is_admin()));

create policy "admins can update profiles"
  on public.profiles
  for update
  to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

create policy "admins can delete profiles"
  on public.profiles
  for delete
  to authenticated
  using ((select public.current_user_is_admin()));

-- movies catalog holds high-level film metadata.
create table if not exists public.movies (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  synopsis text,
  duration_minutes integer check (duration_minutes > 0),
  rating text,
  poster_url text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

comment on table public.movies is 'Catalog of movies available for scheduling in the ULEAM cinema.';
comment on column public.movies.duration_minutes is 'Total runtime of the movie in minutes.';
comment on column public.movies.poster_url is 'Optional path to the movie poster asset.';

alter table public.movies enable row level security;

create trigger movies_set_updated_at
  before update on public.movies
  for each row
  execute procedure public.handle_timestamp_updated_at();

create policy "admins can read movies"
  on public.movies
  for select
  to authenticated
  using ((select public.current_user_is_admin()));

create policy "admins can insert movies"
  on public.movies
  for insert
  to authenticated
  with check ((select public.current_user_is_admin()));

create policy "admins can update movies"
  on public.movies
  for update
  to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

create policy "admins can delete movies"
  on public.movies
  for delete
  to authenticated
  using ((select public.current_user_is_admin()));

-- screenings represent scheduled showings for a movie.
create table if not exists public.screenings (
  id uuid default gen_random_uuid() primary key,
  movie_id uuid not null references public.movies (id) on delete cascade,
  starts_at timestamp with time zone not null,
  ends_at timestamp with time zone,
  auditorium text not null,
  capacity integer not null check (capacity > 0),
  notes text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint screenings_time_range check (ends_at is null or ends_at > starts_at)
);

comment on table public.screenings is 'Scheduled showings for movies, including time, location, and capacity.';
comment on column public.screenings.starts_at is 'UTC start time for the screening.';
comment on column public.screenings.ends_at is 'UTC end time for the screening (optional).';
comment on column public.screenings.capacity is 'Total number of seats available for the screening.';

alter table public.screenings enable row level security;

create trigger screenings_set_updated_at
  before update on public.screenings
  for each row
  execute procedure public.handle_timestamp_updated_at();

create policy "admins can read screenings"
  on public.screenings
  for select
  to authenticated
  using ((select public.current_user_is_admin()));

create policy "admins can insert screenings"
  on public.screenings
  for insert
  to authenticated
  with check ((select public.current_user_is_admin()));

create policy "admins can update screenings"
  on public.screenings
  for update
  to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

create policy "admins can delete screenings"
  on public.screenings
  for delete
  to authenticated
  using ((select public.current_user_is_admin()));

create index screenings_movie_id_idx on public.screenings (movie_id);
create index screenings_starts_at_idx on public.screenings (starts_at);

-- reservations capture seat allocations tied to users and screenings.
create table if not exists public.reservations (
  id uuid default gen_random_uuid() primary key,
  screening_id uuid not null references public.screenings (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.reservation_status not null default 'confirmed',
  seat_label text,
  qr_token text not null default encode(gen_random_bytes(8), 'hex'),
  reserved_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint reservations_user_screening_unique unique (screening_id, user_id),
  constraint reservations_qr_token_unique unique (qr_token)
);

comment on table public.reservations is 'Seat reservations per screening linked to authenticated users.';
comment on column public.reservations.status is 'Lifecycle state of the reservation.';
comment on column public.reservations.qr_token is 'Unique token encoded into the reservation QR code.';

alter table public.reservations enable row level security;

create trigger reservations_set_updated_at
  before update on public.reservations
  for each row
  execute procedure public.handle_timestamp_updated_at();

create index reservations_screening_id_idx on public.reservations (screening_id);
create index reservations_user_id_idx on public.reservations (user_id);

create policy "admins can read reservations"
  on public.reservations
  for select
  to authenticated
  using ((select public.current_user_is_admin()));

create policy "admins can insert reservations"
  on public.reservations
  for insert
  to authenticated
  with check ((select public.current_user_is_admin()));

create policy "admins can update reservations"
  on public.reservations
  for update
  to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

create policy "admins can delete reservations"
  on public.reservations
  for delete
  to authenticated
  using ((select public.current_user_is_admin()));

create policy "users can read own reservations"
  on public.reservations
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "users can insert own reservations"
  on public.reservations
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "users can update own reservations"
  on public.reservations
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "users can delete own reservations"
  on public.reservations
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- attendance_logs confirm QR validations for reservations.
create table if not exists public.attendance_logs (
  id uuid default gen_random_uuid() primary key,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  scanned_by uuid references auth.users (id),
  scanned_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now()
);

comment on table public.attendance_logs is 'Audit trail of QR code validations at the cinema entrance.';
comment on column public.attendance_logs.scanned_by is 'Admin user responsible for validating the QR code.';

alter table public.attendance_logs enable row level security;

create unique index attendance_logs_reservation_id_unique on public.attendance_logs (reservation_id);

create policy "admins can read attendance logs"
  on public.attendance_logs
  for select
  to authenticated
  using ((select public.current_user_is_admin()));

create policy "admins can insert attendance logs"
  on public.attendance_logs
  for insert
  to authenticated
  with check ((select public.current_user_is_admin()));

create policy "admins can update attendance logs"
  on public.attendance_logs
  for update
  to authenticated
  using ((select public.current_user_is_admin()))
  with check ((select public.current_user_is_admin()));

create policy "admins can delete attendance logs"
  on public.attendance_logs
  for delete
  to authenticated
  using ((select public.current_user_is_admin()));

-- typed response for qr validation.
do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'qr_validation_result'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.qr_validation_result as (
      reservation_id uuid,
      screening_id uuid,
      status public.reservation_status,
      message text,
      already_scanned boolean,
      is_valid boolean
    );
  end if;
end
$$;

-- function to validate reservation qr tokens and track attendance.
create or replace function public.validate_reservation_qr(p_token text, p_scanner uuid default null)
returns public.qr_validation_result
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_reservation public.reservations%rowtype;
  v_result public.qr_validation_result;
begin
  if not public.current_user_is_admin() then
    v_result := (null, null, 'cancelled', 'Solo personal autorizado puede validar códigos.', false, false);
    return v_result;
  end if;

  if coalesce(trim(p_token), '') = '' then
    v_result := (null, null, 'cancelled', 'Código QR inválido.', false, false);
    return v_result;
  end if;

  select *
  into v_reservation
  from public.reservations
  where qr_token = p_token;

  if not found then
    v_result := (null, null, 'cancelled', 'No se encontró una reserva para este código.', false, false);
    return v_result;
  end if;

  if v_reservation.status = 'cancelled' then
    v_result := (
      v_reservation.id,
      v_reservation.screening_id,
      v_reservation.status,
      'La reserva está cancelada y no puede registrarse asistencia.',
      false,
      false
    );
    return v_result;
  end if;

  if exists (
    select 1
    from public.attendance_logs
    where reservation_id = v_reservation.id
  ) then
    v_result := (
      v_reservation.id,
      v_reservation.screening_id,
      v_reservation.status,
      'Esta reserva ya fue validada previamente.',
      true,
      false
    );
    return v_result;
  end if;

  insert into public.attendance_logs (reservation_id, scanned_by)
  values (v_reservation.id, p_scanner);

  update public.reservations
  set status = 'checked_in',
      updated_at = now()
  where id = v_reservation.id;

  select *
  into v_reservation
  from public.reservations
  where id = v_reservation.id;

  v_result := (
    v_reservation.id,
    v_reservation.screening_id,
    v_reservation.status,
    'Asistencia registrada correctamente.',
    false,
    true
  );
  return v_result;
end;
$$;

comment on function public.validate_reservation_qr(text, uuid) is 'Valida un código QR de reserva, registra asistencia y devuelve el resultado de la operación.';

grant execute on function public.validate_reservation_qr(text, uuid) to authenticated;

-- view aggregating screening performance metrics.
create or replace view public.screening_stats as
select
  s.id as screening_id,
  s.movie_id,
  m.title as movie_title,
  s.starts_at,
  s.ends_at,
  s.auditorium,
  s.capacity,
  count(r.id) as total_reservations,
  count(r.id) filter (where r.status in ('pending', 'confirmed', 'checked_in', 'no_show')) as active_reservations,
  count(r.id) filter (where r.status = 'checked_in') as checked_in_count,
  coalesce(
    round(
      (count(r.id)::numeric / nullif(s.capacity::numeric, 0)) * 100,
      2
    ),
    0
  ) as occupancy_rate,
  coalesce(
    round(
      (count(r.id) filter (where r.status = 'checked_in'))::numeric
        / nullif(count(r.id)::numeric, 0)
        * 100,
      2
    ),
    0
  ) as attendance_rate,
  s.created_at,
  s.updated_at
from public.screenings s
left join public.movies m on m.id = s.movie_id
left join public.reservations r on r.screening_id = s.id
group by s.id, m.title;

comment on view public.screening_stats is 'Métricas de ocupación y asistencia por función.';


