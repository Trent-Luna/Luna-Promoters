'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { dayLabel, windowLabel, toLocalInput, fromLocalInput, timeLabel } from '@/lib/offcampus/logic'
import { useOc, askReason, Msg } from './use-oc'

interface Night {
  id: string; season_id: string | null; week_no: number | null; night_date: string; event_id: string | null
  opens_at: string; closes_at: string; skipped: boolean; rooftop_note: string | null; club_note: string | null
  lineup: string | null; perk_note: string | null; arrivals: number; open_flags: number
}

export function NightsTab({ nights, seasons }: { nights: Night[]; seasons: any[] }) {
  const { run, msg } = useOc()
  const [edit, setEdit] = useState<string | null>(null)
  const now = Date.now()

  async function newSeason() {
    const first = window.prompt('First Thursday of the new season (YYYY-MM-DD)')
    if (!first) return
    await run('offcampus_admin_create_season', { p_name: null, p_first: first })
  }

  return (
    <div className="space-y-4">
      <Msg msg={msg} />
      {seasons.map(se => (
        <div key={se.id} className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 p-4 border-b border-white/[0.06]">
            <div className="font-bold">{se.name}</div>
            <span className="pill bg-luna-surface">{se.status}</span>
            <span className="text-sm text-luna-muted">{dayLabel(se.first_night)} · {se.weeks} Thursdays</span>
            <div className="ml-auto flex gap-2">
              {se.status !== 'closed' && <button className="btn-ghost text-xs" onClick={() => run('offcampus_admin_season_status', { p_season: se.id, p_status: 'closed' })}>Close season</button>}
              {se.status === 'closed' && <button className="btn-ghost text-xs" onClick={() => run('offcampus_admin_season_status', { p_season: se.id, p_status: 'active' })}>Reopen</button>}
            </div>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {nights.filter(n => n.season_id === se.id).map(n => {
              const live = Date.parse(n.opens_at) <= now && Date.parse(n.closes_at) > now
              return (
                <div key={n.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="font-semibold sm:w-44 whitespace-nowrap">Week {n.week_no} · {dayLabel(n.night_date)}</div>
                    <div className="text-sm text-luna-muted">{n.skipped ? 'Skipped' : `Door ${windowLabel(n.opens_at, n.closes_at)}`}</div>
                    {live && <span className="pill bg-emerald-500/15 text-emerald-400">Door open now</span>}
                    {!n.event_id && <span className="pill bg-amber-500/15 text-amber-400" title="No Su Casa event exists for this date in the guest list">No Su Casa event</span>}
                    <div className="text-sm"><b>{n.arrivals}</b> counted</div>
                    {n.open_flags > 0 && <span className="pill bg-amber-500/15 text-amber-400">{n.open_flags} open flag{n.open_flags === 1 ? '' : 's'}</span>}
                    <div className="ml-auto flex gap-2">
                      <Link className="btn-ghost text-xs" href={`/admin/offcampus?tab=nights&night=${n.id}`}>Reconcile</Link>
                      <button className="btn-ghost text-xs" onClick={() => setEdit(edit === n.id ? null : n.id)}>{edit === n.id ? 'Close' : 'Edit'}</button>
                    </div>
                  </div>
                  {edit === n.id && <NightEditor n={n} onDone={() => setEdit(null)} />}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <button className="btn-ghost" onClick={newSeason}>New season</button>
    </div>
  )
}

function NightEditor({ n, onDone }: { n: Night; onDone: () => void }) {
  const { run, msg } = useOc()
  const [f, setF] = useState({
    opens: toLocalInput(n.opens_at), closes: toLocalInput(n.closes_at),
    rooftop: n.rooftop_note ?? '', club: n.club_note ?? '', lineup: n.lineup ?? '', perk: n.perk_note ?? '', skipped: n.skipped,
  })
  const set = (k: keyof typeof f, v: any) => setF(p => ({ ...p, [k]: v }))
  async function save() {
    const r = await run('offcampus_admin_update_night', { p_night: n.id, p: {
      opens_at: fromLocalInput(f.opens), closes_at: fromLocalInput(f.closes), skipped: f.skipped,
      rooftop_note: f.rooftop, club_note: f.club, lineup: f.lineup, perk_note: f.perk,
    } })
    if (r.ok) onDone()
  }
  return (
    <div className="mt-4 grid sm:grid-cols-2 gap-3">
      <label><span className="label">Door opens (Brisbane)</span><input className="input" type="datetime-local" value={f.opens} onChange={e => set('opens', e.target.value)} /></label>
      <label><span className="label">Door closes (Brisbane)</span><input className="input" type="datetime-local" value={f.closes} onChange={e => set('closes', e.target.value)} /></label>
      <label><span className="label">Social Study (rooftop) times</span><input className="input" placeholder="e.g. 6pm to 10pm" value={f.rooftop} onChange={e => set('rooftop', e.target.value)} /></label>
      <label><span className="label">Night Class (club) times</span><input className="input" placeholder="e.g. 9pm to 3am" value={f.club} onChange={e => set('club', e.target.value)} /></label>
      <label><span className="label">DJs</span><input className="input" value={f.lineup} onChange={e => set('lineup', e.target.value)} /></label>
      <label><span className="label">Perk line</span><input className="input" value={f.perk} onChange={e => set('perk', e.target.value)} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.skipped} onChange={e => set('skipped', e.target.checked)} /> Skip this Thursday (no Off Campus)</label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button className="btn-gold" onClick={save}>Save night</button>
        <span className="text-xs text-luna-muted">Shown on the What’s On page under “This Thursday”.</span>
      </div>
      <div className="sm:col-span-2"><Msg msg={msg} /></div>
    </div>
  )
}

/** One night reconciled: who counted, corrections with reasons, flags. */
export function NightReport({ nightId, teams, unis }: { nightId: string; teams: any[]; unis: any[] }) {
  const { run, msg } = useOc()
  const [r, setR] = useState<any>(null)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<any[]>([])

  async function load() {
    const res = await run('offcampus_admin_night_report', { p_night: nightId }, { refresh: false, quiet: true })
    if (res.ok) setR(res.data)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [nightId])

  async function act(fn: string, args: Record<string, unknown>) {
    const res = await run(fn, args, { refresh: false })
    if (res.ok) load()
  }
  async function search() {
    const res = await run('offcampus_admin_members', { p_search: q, p_limit: 20 }, { refresh: false, quiet: true })
    if (res.ok) setFound(res.data.rows)
  }
  async function reattribute(a: any) {
    const name = window.prompt(`Move this arrival to which club? Type the club name exactly, or leave blank for "university only".`)
    if (name === null) return
    const team = name.trim() ? teams.find(t => t.name.toLowerCase() === name.trim().toLowerCase() && t.status === 'active') : null
    if (name.trim() && !team) { window.alert('No active club with that name.'); return }
    const reason = askReason('Reason for moving this arrival?'); if (!reason) return
    act('offcampus_admin_reattribute', { p_arrival: a.id, p_university: team?.university_id ?? unis.find(u => u.short_name === a.uni)?.id, p_team: team?.id ?? null, p_reason: reason })
  }

  if (!r) return <div className="card p-5 text-sm text-luna-muted">Loading night… <Msg msg={msg} /></div>
  const n = r.night
  return (
    <div className="space-y-4">
      <Link href="/admin/offcampus?tab=nights" className="text-sm text-luna-muted">← All nights</Link>
      <div className="card p-5">
        <div className="eyebrow">Week {n.week_no} · {dayLabel(n.date)}</div>
        <div className="text-sm text-luna-muted mt-1">Door {windowLabel(n.opens_at, n.closes_at)}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-sm">
          <div><div className="text-luna-muted text-xs">Counted</div><div className="text-xl font-bold">{r.arrivals}</div></div>
          <div><div className="text-luna-muted text-xs">Voided</div><div className="text-xl font-bold">{r.voided}</div></div>
          <div><div className="text-luna-muted text-xs">Added by hand</div><div className="text-xl font-bold">{r.manual}</div></div>
          <div><div className="text-luna-muted text-xs">Registered by close</div><div className="text-xl font-bold">{r.registered_by}</div></div>
        </div>
      </div>
      <Msg msg={msg} />

      {r.flags.length > 0 && (
        <div className="card p-5">
          <div className="eyebrow mb-3">Flags</div>
          {r.flags.map((f: any) => (
            <div key={f.id} className="flex flex-wrap items-center gap-3 py-2 border-t border-white/[0.06] text-sm">
              <span className="font-semibold">{FLAG[f.kind] ?? f.kind}</span>
              <span className="text-luna-muted">{[f.full_name, f.team].filter(Boolean).join(' · ')}</span>
              {f.status === 'open'
                ? <button className="btn-ghost text-xs ml-auto" onClick={() => { const why = askReason('What did you check? (clears the flag)'); if (why) act('offcampus_admin_clear_flag', { p_flag: f.id, p_note: why }) }}>Clear</button>
                : <span className="ml-auto text-xs text-emerald-400">Cleared: {f.clear_note}</span>}
            </div>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="eyebrow mb-3">By club: registered against arrived</div>
          {r.by_team.map((t: any, i: number) => (
            <div key={i} className="flex justify-between text-sm py-1 border-t border-white/[0.06]">
              <span>{t.team} <span className="text-luna-muted">· {t.uni}</span></span><span><b>{t.arrived}</b> <span className="text-luna-muted">of {t.registered}</span></span>
            </div>
          ))}
        </div>
        <div className="card p-5">
          <div className="eyebrow mb-3">By staff</div>
          {r.by_staff.map((t: any, i: number) => (
            <div key={i} className="flex justify-between text-sm py-1 border-t border-white/[0.06]"><span>{t.staff}</span><b>{t.n}</b></div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="eyebrow mb-3">Add a missed arrival</div>
        <div className="flex gap-2">
          <input className="input" placeholder="Search name, email, mobile or club" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} />
          <button className="btn-ghost" onClick={search}>Search</button>
        </div>
        {found.map(m => (
          <div key={m.id} className="flex flex-wrap items-center gap-3 py-2 border-t border-white/[0.06] text-sm">
            <span>{m.full_name}</span><span className="text-luna-muted">{m.team ?? m.pending_team ?? 'uni only'} · {m.uni}</span>
            <button className="btn-ghost text-xs ml-auto" onClick={() => { const why = askReason(`Why are you adding ${m.full_name} by hand? (it will be flagged for a second look)`); if (why) act('offcampus_admin_add_arrival', { p_member: m.id, p_night: nightId, p_reason: why }) }}>Add to this night</button>
          </div>
        ))}
      </div>

      <div className="card p-5 overflow-x-auto">
        <div className="eyebrow mb-3">Every scan</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-luna-muted"><th className="py-1">Time</th><th>Member</th><th>Counted for</th><th>Staff</th><th></th></tr></thead>
          <tbody>
            {r.list.map((a: any) => (
              <tr key={a.id} className={`border-t border-white/[0.06] ${a.voided_at ? 'opacity-50 line-through' : ''}`}>
                <td className="py-1.5">{timeLabel(a.scanned_at)}{a.method === 'manual' ? ' (by hand)' : ''}</td>
                <td>{a.full_name}</td><td>{a.team ?? 'University only'} · {a.uni}</td><td>{a.staff ?? '–'}</td>
                <td className="text-right whitespace-nowrap">
                  {!a.voided_at && <>
                    <button className="btn-ghost text-xs mr-1" onClick={() => reattribute(a)}>Move</button>
                    <button className="btn-ghost text-xs" onClick={() => { const why = askReason('Why void this arrival?'); if (why) act('offcampus_admin_void_arrival', { p_arrival: a.id, p_reason: why }) }}>Void</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {r.adjustments.length > 0 && (
          <>
            <div className="eyebrow mt-5 mb-2">Corrections</div>
            {r.adjustments.map((j: any, i: number) => (
              <div key={i} className="text-sm py-1 border-t border-white/[0.06]">
                <b>{j.kind.replace('_', ' ')}</b> · {j.full_name} · “{j.reason}” <span className="text-luna-muted">by {j.by ?? 'system'}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

const FLAG: Record<string, string> = {
  self_scan: 'Staff scanned their own pass', late_arrival: 'Scanned in the last 15 minutes', recent_team_change: 'Club changed shortly before arriving',
  burst: '10 arrivals for one club from one staff member in 5 minutes', manual_add: 'Added by hand',
}
