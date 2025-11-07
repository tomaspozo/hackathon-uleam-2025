import { ThemeProvider } from './theme-provider'
import { SupabaseProvider } from './supabase-provider'
import { ProfileProvider } from './profile-provider'
import { Toaster } from '@/components/ui/sonner'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <SupabaseProvider>
        <ProfileProvider>
          {children}
          <Toaster position="top-right" richColors />
        </ProfileProvider>
      </SupabaseProvider>
    </ThemeProvider>
  )
}
