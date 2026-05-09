import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/sidebar'
import { Header } from '@/components/header'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  const fullName = profile?.full_name ?? user.email ?? ''
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:shrink-0">
        <Sidebar />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="Ledger"
          userEmail={profile?.email ?? user.email}
          userInitials={initials || 'U'}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}
