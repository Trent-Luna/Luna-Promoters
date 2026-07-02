import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { PROMOTER_NAV } from '@/components/nav'
import { WhatsOnFeed } from './feed'

export const dynamic = 'force-dynamic'

export default async function PromoterWhatsOn() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'promoter')) redirect('/dashboard')

  const supabase = await createClient()
  const [{ data: venues }, { data: posts }] = await Promise.all([
    supabase.from('venues').select('id,name').eq('active', true).order('name'),
    supabase.from('venue_posts').select('id,title,body,image_url,created_at,venue_id,venues(name)')
      .eq('active', true).order('created_at', { ascending: false }).limit(100),
  ])

  const list = (posts ?? []).map((p: any) => ({
    id: p.id, title: p.title, body: p.body, image_url: p.image_url,
    created_at: p.created_at, venue_id: p.venue_id, venue_name: p.venues?.name ?? 'All venues',
  }))

  return (
    <AppShell nav={PROMOTER_NAV} current="/promoter/whats-on" title="What's On">
      <WhatsOnFeed venues={venues ?? []} posts={list} />
    </AppShell>
  )
}
