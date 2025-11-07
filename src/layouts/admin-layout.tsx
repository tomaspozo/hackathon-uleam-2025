import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { ModeToggle } from '@/components/mode-toggle'
import { CurrentUserAvatar } from '@/components/auth/current-user-avatar'
import { Button } from '@/components/ui/button'
import {
  CalendarClock,
  Clapperboard,
  LayoutDashboard,
  QrCode,
  Ticket,
} from 'lucide-react'
import { useSupabase } from '@/hooks/use-supabase'
import { Separator } from '@/components/ui/separator'

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
    match: '/admin/dashboard',
  },
  {
    label: 'Películas',
    href: '/admin/movies',
    icon: Clapperboard,
    match: '/admin/movies',
  },
  {
    label: 'Funciones',
    href: '/admin/screenings',
    icon: CalendarClock,
    match: '/admin/screenings',
  },
  {
    label: 'Reservas',
    href: '/admin/reservations',
    icon: Ticket,
    match: '/admin/reservations',
  },
  {
    label: 'Asistencias',
    href: '/admin/attendance',
    icon: QrCode,
    match: '/admin/attendance',
  },
]

export function AdminLayout() {
  const location = useLocation()
  const { signOut } = useSupabase()

  const isActive = (match: string) => {
    return location.pathname === match || location.pathname.startsWith(`${match}/`)
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="bg-muted/40">
        <SidebarHeader className="px-4 pb-2 pt-6">
          <Link to="/admin/dashboard" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold">
              CU
            </div>
            <span className="text-base font-semibold tracking-tight">Cine ULEAM</span>
          </Link>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Gestión</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive(item.match)}>
                        <Link to={item.href} className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <ModeToggle />
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Cerrar sesión
          </Button>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <div className="flex min-h-screen flex-col bg-background">
          <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="md:hidden" />
              <span className="text-lg font-semibold">
                {NAV_ITEMS.find((item) => location.pathname.startsWith(item.match))?.label ?? 'Panel'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Separator orientation="vertical" className="h-6" />
              <CurrentUserAvatar />
            </div>
          </header>
          <main className="flex-1 px-4 py-6">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
              <Outlet />
            </div>
          </main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}


