'use client'
import { useState } from 'react'
import Link from 'next/link'
import { dayLabel } from '@/lib/offcampus/logic'
import { useOc, askReason, Msg } from './use-oc'

const STATUS: Record<string, string> = {
  needs_decision: 'Tie: needs a decision', proposed: 'Proposed', verified: 'Verified', approved: 'Approved', redeemed: 'Redeemed', cancelled: 'Cancelled',
}

export function PrizesTab({ prizes, nights, seasons, settings, organisers }: { prizes: any[]; nights: any[]; seasons: any[]; settings: any; organisers: any[] }) {
  const { run, msg } = useOc()
  const now = Date.now()
  const done = nights.filter(n => !n.skipped && Date.parse(n.closes_at) <= now)
  const [night, setNight] = useState(done[done.length - 1]?.id ?? '')
  const label = (p: any) => p.kind === 'weekly_booth'
    ? `VIP booth · ${(() => { const n = nights.find(x => x.id === p.night_id); return n ? `Week ${n.week_no} · ${dayLabel(n.night_date)}` : '' })()}`
    : `$5,000 season celebration · ${seasons.find(s => s.id === p.season_id)?.name ?? ''}`

  if (!settings?.prizes_on) return (
    <div className="card p-5 text-sm">
      Prizes are switched off. In <Link href="/admin/offcampus?tab=settings" className="underline text-luna-gold">Settings</Link>, choose the season
      winner level and tie rule, approve a rules version, then switch the prize workflow on. Nothing here sends a message to anyone.
    </div>
  )

  return (
    <div className="space-y-4">
      <Msg msg={msg} />
      <div className="card p-5 flex flex-wrap items-end gap-3">
        <label className="min-w-[220px]"><span className="label">Weekly VIP booth for</span>
          <select className="input" value={night} onChange={e => setNight(e.target.value)}>
            {done.map(n => <option key={n.id} value={n.id}>Week {n.week_no} · {dayLabel(n.night_date)} ({n.arrivals} counted)</option>)}
          </select>
        </label>
        <button className="btn-gold" disabled={!night} onClick={() => run('offcampus_admin_propose_prize', { p_kind: 'weekly_booth', p_night: night })}>Propose winner</button>
        {seasons.map(s => (
          <button key={s.id} className="btn-ghost" onClick={() => run('offcampus_admin_propose_prize', { p_kind: 'season', p_season: s.id })}>
            Propose {s.name} winner
          </button>
        ))}
      </div>
      <p className="text-xs text-luna-muted">
        Steps: propose → verify (no open flags, standings unchanged) → approve{settings.two_admin_approval ? ' by a different admin' : ''} → redeemed.
        The standings are frozen at proposal; any later correction flags the prize instead of changing the winner.
      </p>

      {prizes.map(p => (
        <div key={p.id} className="card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="font-semibold">{label(p)}</div>
            <span className="pill bg-luna-surface">{STATUS[p.status] ?? p.status}</span>
            {p.flagged && <span className="pill bg-red-500/15 text-red-400">Flagged</span>}
          </div>
          <div className="text-sm mt-2">
            Winner{p.winners.length > 1 ? 's' : ''}: {p.winners.map((w: any) => `${w.name}${w.uni ? ` (${w.uni})` : ''} · ${w.n}`).join(', ')}
          </div>
          {p.flag_note && <div className="text-sm text-red-400 mt-1">{p.flag_note}</div>}
          {p.tie && <div className="text-xs text-luna-muted mt-1">Tie rule: {p.tie.rule}{p.tie.decision ? ` · decided: ${p.tie.decision}` : ''}</div>}
          {p.note && <div className="text-xs text-luna-muted mt-1">Note: {p.note}</div>}
          <div className="flex flex-wrap gap-2 mt-3">
            {p.status === 'needs_decision' && p.tie?.tied?.map((w: any) => (
              <button key={w.key} className="btn-ghost text-xs" onClick={() => { const why = askReason(`Under which published rule does ${w.name} win?`); if (why) run('offcampus_admin_prize', { p_prize: p.id, p_action: 'decide', p_note: why, p_winner: w.key }) }}>
                {w.name} wins
              </button>
            ))}
            {['proposed', 'verified'].includes(p.status) && p.level === 'team' && p.winners.length === 1 &&
              organisers.filter(o => o.status === 'approved' && o.team_id === p.winners[0].key && o.member_id !== p.recipient_member_id).map(o => (
                <button key={o.id} className="btn-ghost text-xs" onClick={() => run('offcampus_admin_prize', { p_prize: p.id, p_action: 'recipient', p_member: o.member_id })}>
                  Give to {o.offcampus_members?.full_name}
                </button>
              ))}
            {p.status === 'proposed' && <button className="btn-gold text-xs" onClick={() => run('offcampus_admin_prize', { p_prize: p.id, p_action: 'verify' })}>Verify</button>}
            {p.status === 'verified' && <button className="btn-gold text-xs" onClick={() => run('offcampus_admin_prize', { p_prize: p.id, p_action: 'approve' })}>Approve</button>}
            {p.status === 'approved' && <button className="btn-gold text-xs" onClick={() => { const n = window.prompt('Redemption note (date, booth, who received it)'); if (n !== null) run('offcampus_admin_prize', { p_prize: p.id, p_action: 'redeem', p_note: n || null }) }}>Mark redeemed</button>}
            {!['redeemed', 'cancelled'].includes(p.status) && <button className="btn-ghost text-xs" onClick={() => { const why = askReason('Why cancel?'); if (why) run('offcampus_admin_prize', { p_prize: p.id, p_action: 'cancel', p_note: why }) }}>Cancel</button>}
          </div>
          <div className="text-xs text-luna-muted mt-2">{p.recipient_member_id
            ? `Recipient: ${organisers.find(o => o.member_id === p.recipient_member_id)?.offcampus_members?.full_name ?? 'set'}`
            : p.level === 'team' ? 'No recipient yet: approve one of the club’s organisers in Clubs, then give it to them here.' : ''}</div>
        </div>
      ))}
      {prizes.length === 0 && <p className="text-sm text-luna-muted">No prizes proposed yet.</p>}
    </div>
  )
}
