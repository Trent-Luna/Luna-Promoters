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
    <AppShell nav={navForRoles(s.roles)} current="/admin/whats-on" title="What's On">
      <p className="text-luna-muted text-sm mb-5 max-w-2xl">Post updates that promoters see in their What&apos;s On feed. Choose a venue (or all venues).</p>
      <div className="grid lg:grid-cols-3 gap-5">
        <form action={createPost} className="card p-5 space-y-3 h-fit">
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

        <div className="lg:col-span-2 space-y-3">
          {(posts ?? []).length === 0 && <div className="card p-6 text-center text-luna-muted">No posts yet.</div>}
          {(posts ?? []).map((p: any) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{p.title}</span>
                    <span className="pill bg-luna-purple/20 text-white text-[11px]">{p.venue_id ? (p.venues?.name ?? 'Venue') : 'All venues'}</span>
                  </div>
                  {p.body && <p className="text-sm text-luna-muted mt-1 whitespace-pre-wrap">{p.body}</p>}
                  <p className="text-[11px] text-luna-muted mt-2">{fmtDateTime(p.created_at)}</p>
                </div>
                <DeletePost id={p.id} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
