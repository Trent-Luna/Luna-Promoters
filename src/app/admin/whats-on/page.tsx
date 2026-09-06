import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { navForRoles } from '@/components/nav'
import { fmtDateTime } from '@/lib/format'
import { createPost } from '../actions'
import { DeletePost } from './ui'

export const dynamic = 'force-dynamic'

export default async function AdminWhatsOn() {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin', 'venue_manager')) redirect('/dashboard')
  const isAdmin = s.roles.includes('admin')

  const supabase = await createClient()
  let vq = supabase.from('venues').select('id,name').eq('active', true).order('name')
  if (!isAdmin) vq = vq.in('id', s.venueIds.length ? s.venueIds : ['00000000-0000-0000-0000-000000000000'])
  const [{ data: venues }, { data: posts }] = await Promise.all([
    vq,
    supabase.from('venue_posts').select('id,title,body,image_url,created_at,venue_id,venues(name)').order('created_at', { ascending: false }),
  ])

  return (
    <AppShell nav={navForRoles(s.roles)} current="/admin/whats-on" title="What's On"
      subtitle="Posts promoters see on their dashboard and What's On tab. Choose a venue, or all venues.">
      <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">
        <form action={createPost} className="card p-5 space-y-3">
          <h2 className="font-bold">New post</h2>
          <div><label className="label">Venue</label>
            <select name="venue_id" className="input" required>
              {isAdmin && <option value="ALL">All venues</option>}
              {(venues ?? []).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select></div>
          <div><label className="label">Title</label><input name="title" required className="input" placeholder="e.g. Saturday: Special guest DJ" /></div>
          <div><label className="label">Details</label><textarea name="body" rows={4} className="input" placeholder="What's happening…" /></div>
          <div><label className="label">Image URL (optional)</label><input name="image_url" className="input" placeholder="https://…" /></div>
          <button className="btn-gold w-full">Post update</button>
        </form>

        <div className="card px-5 py-4">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="font-bold">Posts</h2>
            <span className="ml-auto text-xs text-luna-muted">{(posts ?? []).length} post{(posts ?? []).length === 1 ? '' : 's'}</span>
          </div>
          {(posts ?? []).length === 0 && <p className="py-6 text-center text-sm text-luna-muted">No posts yet.</p>}
          {(posts ?? []).map((p: any) => (
            <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[130px_minmax(0,1fr)_auto] gap-x-4 gap-y-1 items-center py-3 border-t border-white/[0.07]">
              <span className="pill bg-white/[0.07] text-luna-text/90 font-medium justify-self-start">{p.venue_id ? (p.venues?.name ?? 'Venue') : 'All venues'}</span>
              <div className="min-w-0 col-span-2 sm:col-span-1">
                <div className="font-semibold">{p.title}</div>
                {p.body && <p className="text-xs text-luna-muted mt-0.5 whitespace-pre-wrap">{p.body}</p>}
                <p className="text-[11px] text-luna-muted mt-1">{fmtDateTime(p.created_at)}</p>
              </div>
              <div className="justify-self-end"><DeletePost id={p.id} /></div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
