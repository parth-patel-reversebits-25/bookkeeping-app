'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import type { Profile } from '@/lib/types'

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    const fetchProfile = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      setProfile(data as Profile)
      setLoading(false)
    }

    fetchProfile()
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      toast({
        title: 'Error signing out',
        description: error.message,
        variant: 'destructive',
      })
      setLoggingOut(false)
      return
    }

    router.push('/login')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      {/* Account info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your profile details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <>
              <div className="grid gap-1">
                <p className="text-sm font-medium text-muted-foreground">Full Name</p>
                <p className="text-sm">{profile?.full_name ?? '—'}</p>
              </div>
              <div className="grid gap-1">
                <p className="text-sm font-medium text-muted-foreground">Email</p>
                <p className="text-sm">{profile?.email ?? '—'}</p>
              </div>
              <div className="grid gap-1">
                <p className="text-sm font-medium text-muted-foreground">Member since</p>
                <p className="text-sm">{formatDateTime(profile?.created_at)}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Data section */}
      <Card>
        <CardHeader>
          <CardTitle>Data & Privacy</CardTitle>
          <CardDescription>Your data is stored securely in Supabase with row-level security enabled</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            All bank statements and receipts are stored in private Supabase Storage buckets and are only accessible by you.
          </p>
          <p className="text-sm text-muted-foreground">
            Transaction and receipt data is extracted using the Anthropic Claude API and stored in your private database.
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* Danger zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Sign out</p>
              <p className="text-sm text-muted-foreground">Sign out of your account on this device</p>
            </div>
            <Button variant="outline" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="mr-2 h-4 w-4" />
              )}
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
