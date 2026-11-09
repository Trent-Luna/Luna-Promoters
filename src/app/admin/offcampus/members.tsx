'use client'
import { useEffect, useState } from 'react'
import { toCsv } from '@/lib/offcampus/logic'
import { useOc, askReason, Msg } from './use-oc'

export function MembersTab({ unis, teams }: { unis: any[]; teams: any[] }) {
  const { run, msg } = useOc()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<any[]>([])
  const [loaded, setLoaded] = useState(false)

  async function load(search = q) {
    const r = await run('offcampus_admin_members', { p_search: search || null, p_limit: 300 }, { refresh: false, quiet: true })
    if (r.ok) { setRows(r.data.rows); setLoaded(true) }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load('') }, [])

  async function act(fn: string, args: Record<string, unknown>) {
    const r = await run(fn, args, { refresh: false })
    if (r.ok) load()
  }

  async function exportCsv(kind: 'totals' | 'members') {
    if (kind === 'members' && !window.confirm('This file has names, emails and mobiles. The export is logged. Continue?')) return
    const r = await run('offcampus_admin_export', { p_kind: kind }, { refresh: false, quiet: true })
    if (!r.ok) return
    const blob = new Blob([toCsv(r.data.rows)], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = `off-campus-${kind}-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }

  function changeClub(m: any) {
    const name = window.prompt(`Move ${m.full_name} to which club? Type its exact name, or leave blank for "university only" at ${m.uni}.`, m.team ?? '')
    if (name === null) return
    const team = name.trim() ? teams.find(t => t.name.toLowerCase() === name.trim().toLowerCase() && t.status === 'active') : null
    if (name.trim() && !team) { window.alert('No active club with that name.'); return }
    const reason = askReason('Reason for the change? Nights already counted stay with the old club.'); if (!reason) return
    act('offcampus_admin_change_team', { p_member: m.id, p_university: team?.university_id ?? m.university_id, p_team: team?.id ?? null, p_reason: reason })
  }

  return (
    <div className="space-y-4">
      <Msg msg={msg} />
      <div className="flex flex-wrap gap-2">
        <input className="input flex-1 min-w-[220px]" placeholder="Search name, email, mobile or club" value={q}
          onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()} />
        <button className="btn-ghost" onClick={() => load()}>Search</button>
        <button className="btn-ghost" onClick={() => exportCsv('totals')}>Export totals</button>
        <button className="btn-ghost" onClick={() => exportCsv('members')}>Export members</button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-xs text-luna-muted">
            <th className="p-3">Name</th><th>Club</th><th>Contact</th><th className="text-right">Nights</th><th></th></tr></thead>
          <tbody>
            {rows.map(m => (
              <tr key={m.id} className={`border-t border-white/[0.06] ${m.status === 'suspended' ? 'opacity-60' : ''}`}>
                <td className="p-3">{m.full_name}{m.organiser && <span className="pill bg-luna-gold/15 text-luna-gold ml-2">organiser</span>}
                  {m.is_test && <span className="pill bg-luna-surface ml-2">test</span>}
                  {m.status === 'suspended' && <div className="text-xs text-red-400">Paused: {m.suspended_reason}</div>}</td>
                <td>{m.team ?? (m.pending_team ? `${m.pending_team} (pending)` : 'Uni only')} <span className="text-luna-muted">· {m.uni}</span></td>
                <td className="text-luna-muted">{m.email}<br />{m.mobile}</td>
                <td className="text-right font-semibold">{m.nights}</td>
                <td className="text-right whitespace-nowrap p-3">
                  <button className="btn-ghost text-xs mr-1" onClick={() => changeClub(m)}>Club</button>
                  {m.status === 'active'
                    ? <button className="btn-ghost text-xs" onClick={() => { const why = askReason(`Why pause ${m.full_name}’s pass?`); if (why) act('offcampus_admin_suspend', { p_member: m.id, p_on: true, p_reason: why }) }}>Pause</button>
                    : <button className="btn-ghost text-xs" onClick={() => { const why = askReason('Why restore this pass?'); if (why) act('offcampus_admin_suspend', { p_member: m.id, p_on: false, p_reason: why }) }}>Restore</button>}
                </td>
              </tr>
            ))}
            {loaded && rows.length === 0 && <tr><td className="p-3 text-luna-muted" colSpan={5}>No members yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-luna-muted">Showing up to 300. {unis.length} universities are on the sign-up list.</p>
    </div>
  )
}
