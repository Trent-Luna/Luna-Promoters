import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Crest } from '@/components/offcampus/Crest'
import { QRCode } from '@/components/QRCode'
import { loadPublicInfo } from '@/lib/offcampus/data'
import { DOOR_PATH, dayLabel, windowLabel } from '@/lib/offcampus/logic'
import { PassExtras } from './extras'

export const dynamic = 'force-dynamic'

export default async function OffCampusPass({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ new?: string; back?: string }>
}) {
  const { token } = await params
  const { new: isNew, back } = await searchParams
  const supabase = await createClient()
  const [{ data: pass }, info] = await Promise.all([
    supabase.rpc('offcampus_pass', { p_token: token }),
    loadPublicInfo(),
  ])
  if (!pass?.ok || !info) notFound()
  const next = info.next_night
  const suspended = pass.status === 'suspended'
  const clubLine = pass.team ?? (pass.pending_team ? `${pass.pending_team} (being added)` : 'Counting for my uni')

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 48px' }}>
      <Link href="/offcampus" style={{ fontSize: 13, color: '#B8B0CC', textDecoration: 'none' }}>← Off Campus</Link>
      {(isNew || back) && (
        <p role="status" style={{ margin: '16px 0 0', padding: '12px 14px', borderRadius: 12, background: 'rgba(125,211,252,.12)',
          border: '1px solid #7DD3FC', fontSize: 14 }}>
          {isNew ? 'You’re in. Save this pass and show it at the door every Thursday.' : 'Welcome back. Here’s your pass.'}
        </p>
      )}

      <section style={{ marginTop: 18, borderRadius: 22, overflow: 'hidden', border: '1px solid #3A2F52', background: '#161022' }}>
        <div style={{ background: '#A78BFA', color: '#0B0812', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
          <Crest size={54} ring="#0B0812" inner="#0B0812" bandFill="#0B0812" bandInk="#A78BFA" />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase' }}>Season pass</div>
            <div className="oc-display" style={{ fontSize: 28, lineHeight: 1 }}>OFF CAMPUS</div>
          </div>
        </div>
        <div style={{ padding: '22px 20px', textAlign: 'center' }}>
          <div className="oc-display" style={{ fontSize: 34, lineHeight: 1 }}>{String(pass.first_name).toUpperCase()}</div>
          <div style={{ marginTop: 8, fontSize: 15, fontWeight: 700 }}>{clubLine}</div>
          <div style={{ fontSize: 13, color: '#B8B0CC', marginTop: 2 }}>{pass.university}</div>
          {suspended ? (
            <p style={{ margin: '20px 0 0', fontSize: 14, color: '#FCA5A5' }}>This pass is paused. Please talk to the Su Casa team.</p>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 6px' }}>
              <QRCode value={`${DOOR_PATH}${token}`} size={232} />
            </div>
          )}
          <div style={{ fontSize: 13, color: '#B8B0CC' }}>
            {pass.nights > 0 ? `Counted ${pass.nights} Thursday${pass.nights === 1 ? '' : 's'} so far` : 'Show this at the door. Staff scan it once a night.'}
          </div>
        </div>
      </section>

      {!suspended && (
        <PassExtras token={token} firstName={pass.first_name} clubLine={clubLine} university={pass.university_short ?? pass.university}
          canChange={pass.can_change} universityId={pass.university_id} teamId={pass.team_id} universities={info.universities} />
      )}

      {next && (
        <p style={{ margin: '20px 0 0', fontSize: 13, lineHeight: 1.5, color: '#B8B0CC', textAlign: 'center' }}>
          Next: {dayLabel(next.date)} at Su Casa, 648 Ann Street, Fortitude Valley. Arrivals count {windowLabel(next.opens_at, next.closes_at)}.
          Bring photo ID: this pass doesn’t replace it.
        </p>
      )}
    </main>
  )
}
