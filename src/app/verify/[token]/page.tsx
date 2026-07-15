import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Logo } from '@/components/Logo'
import { VerifyConsole } from './verify-ui'

export const dynamic = 'force-dynamic'

export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const s = await getSession()
  if (!s) redirect(`/login?next=/verify/${token}`)
  if (!hasRole(s, 'reception', 'venue_manager', 'admin')) redirect('/dashboard')

  const supabase = await createClient()
  let vq = supabase.from('venues').select('id,name').eq('active', true).order('name')
  if (!s.roles.includes('admin')) {
    vq = vq.in('id', s.venueIds.length ? s.venueIds : ['00000000-0000-0000-0000-000000000000'])
  }
  const { data: venues } = await vq

  return (
    <main className="min-h-screen">
      <header className="max-w-md mx-auto px-5 pt-8 flex items-center justify-between">
        <Logo size={28} />
        <a href="/reception" className="text-sm text-luna-muted hover:text-white">Door check-in</a>
      </header>
      <section className="max-w-md mx-auto px-5 pt-6 pb-16">
        <VerifyConsole
          token={token}
          venues={venues ?? []}
          canOverride={hasRole(s, 'admin', 'venue_manager')}
        />
      </section>
    </main>
  )
}
