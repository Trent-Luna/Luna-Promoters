'use client'
import { useState } from 'react'
import { useOc, askReason, Msg } from './use-oc'

interface Team { id: string; university_id: string; name: string; status: string; is_test: boolean; merged_into: string | null }
interface Uni { id: string; name: string; short_name: string | null }

export function ClubsTab({ unis, teams, requests, organisers }: {
  unis: Uni[]; teams: Team[]; requests: any[]; organisers: any[]
}) {
  const { run, msg } = useOc()
  const [uni, setUni] = useState(unis[0]?.id ?? '')
  const [name, setName] = useState('')
  const short = (id: string) => unis.find(u => u.id === id)?.short_name ?? ''
  const pendingOrg = organisers.filter(o => o.status === 'requested')

  async function approve(r: any) {
    const same = teams.filter(t => t.university_id === r.university_id && t.status === 'active')
    const target = window.prompt(
      `Approve “${r.name}” (${short(r.university_id)}).\n\nPress OK to add it as written, edit the name first, or type the exact name of an existing ${short(r.university_id)} club to put these members in it.` +
      (same.length ? `\n\nExisting: ${same.map(t => t.name).join(', ')}` : ''), r.name)
    if (target === null) return
    const existing = same.find(t => t.name.toLowerCase() === target.trim().toLowerCase())
    await run('offcampus_admin_team_request', { p_request: r.id, p_action: 'approve', p_team: existing?.id ?? null,
      p_name: existing ? null : target.trim(), p_reattribute: true })
  }

  return (
    <div className="space-y-5">
      <Msg msg={msg} />
      <div className="card p-5">
        <div className="eyebrow mb-3">New club requests ({requests.length})</div>
        {requests.length === 0 && <p className="text-sm text-luna-muted">Nothing waiting.</p>}
        {requests.map(r => (
          <div key={r.id} className="flex flex-wrap items-center gap-3 py-2 border-t border-white/[0.06] text-sm">
            <span className="font-semibold">{r.name}</span><span className="text-luna-muted">{short(r.university_id)}</span>
            {r.organiser_requested && <span className="pill bg-luna-surface">organiser asked</span>}
            <div className="ml-auto flex gap-2">
              <button className="btn-gold text-xs" onClick={() => approve(r)}>Approve</button>
              <button className="btn-ghost text-xs" onClick={() => { const why = askReason('Why reject? (members stay counted for their uni)'); if (why) run('offcampus_admin_team_request', { p_request: r.id, p_action: 'reject', p_note: why }) }}>Reject</button>
            </div>
          </div>
        ))}
        <p className="text-xs text-luna-muted mt-3">Approving moves waiting members onto the club and moves their arrivals so far, each recorded as a correction.</p>
      </div>

      <div className="card p-5">
        <div className="eyebrow mb-3">Captain and organiser requests ({pendingOrg.length})</div>
        {pendingOrg.length === 0 && <p className="text-sm text-luna-muted">Nothing waiting.</p>}
        {pendingOrg.map(o => (
          <div key={o.id} className="flex flex-wrap items-center gap-3 py-2 border-t border-white/[0.06] text-sm">
            <span className="font-semibold">{o.offcampus_members?.full_name}</span><span className="text-luna-muted">{o.offcampus_teams?.name}</span>
            <div className="ml-auto flex gap-2">
              <button className="btn-gold text-xs" onClick={() => run('offcampus_admin_organiser', { p_id: o.id, p_action: 'approve' })}>Approve</button>
              <button className="btn-ghost text-xs" onClick={() => run('offcampus_admin_organiser', { p_id: o.id, p_action: 'revoke', p_note: 'Not approved' })}>Decline</button>
            </div>
          </div>
        ))}
        <p className="text-xs text-luna-muted mt-3">Only approved organisers can receive a club’s prize. Check with the club before approving.</p>
        {organisers.some(o => o.status === 'approved') && (
          <details className="mt-3 text-sm"><summary className="cursor-pointer text-luna-muted">Approved organisers</summary>
            {organisers.filter(o => o.status === 'approved').map(o => (
              <div key={o.id} className="flex items-center gap-3 py-1.5 border-t border-white/[0.06]">
                <span>{o.offcampus_members?.full_name}</span><span className="text-luna-muted">{o.offcampus_teams?.name}</span>
                <button className="btn-ghost text-xs ml-auto" onClick={() => run('offcampus_admin_organiser', { p_id: o.id, p_action: 'revoke', p_note: 'Revoked by admin' })}>Revoke</button>
              </div>
            ))}
          </details>
        )}
      </div>

      <div className="card p-5">
        <div className="eyebrow mb-3">Add a club or society</div>
        <div className="flex flex-wrap gap-2">
          <select className="input max-w-[220px]" value={uni} onChange={e => setUni(e.target.value)}>
            {unis.map(u => <option key={u.id} value={u.id}>{u.short_name ?? u.name}</option>)}
          </select>
          <input className="input flex-1 min-w-[200px]" placeholder="Club or society name, as the club writes it" value={name} onChange={e => setName(e.target.value)} />
          <button className="btn-gold" onClick={async () => { const r = await run('offcampus_admin_team', { p_action: 'create', p_university: uni, p_name: name }); if (r.ok) setName('') }}>Add</button>
        </div>
        <p className="text-xs text-luna-muted mt-2">Use each club’s own name. No university logos or crests are shown anywhere.</p>
      </div>

      {unis.map(u => {
        const list = teams.filter(t => t.university_id === u.id && t.status !== 'merged')
        if (list.length === 0) return null
        return (
          <div key={u.id} className="card p-5">
            <div className="eyebrow mb-2">{u.name} · {list.filter(t => t.status === 'active').length} active</div>
            {list.map(t => (
              <div key={t.id} className={`flex flex-wrap items-center gap-2 py-1.5 border-t border-white/[0.06] text-sm ${t.status === 'retired' ? 'opacity-50' : ''}`}>
                <span>{t.name}</span>{t.is_test && <span className="pill bg-luna-surface">test</span>}{t.status === 'retired' && <span className="pill bg-luna-surface">retired</span>}
                <div className="ml-auto flex gap-1.5">
                  <button className="btn-ghost text-xs" onClick={() => { const n = window.prompt('New name', t.name); if (n && n.trim() !== t.name) run('offcampus_admin_team', { p_action: 'rename', p_team: t.id, p_name: n }) }}>Rename</button>
                  {t.status === 'active'
                    ? <button className="btn-ghost text-xs" onClick={() => run('offcampus_admin_team', { p_action: 'retire', p_team: t.id })}>Retire</button>
                    : <button className="btn-ghost text-xs" onClick={() => run('offcampus_admin_team', { p_action: 'restore', p_team: t.id })}>Restore</button>}
                  {t.status === 'active' && <button className="btn-ghost text-xs" onClick={() => {
                    const into = window.prompt(`Merge “${t.name}” into which ${u.short_name} club? Type its exact name.`)
                    const target = into ? list.find(x => x.name.toLowerCase() === into.trim().toLowerCase() && x.id !== t.id && x.status === 'active') : null
                    if (into && !target) { window.alert('No other active club with that name at this uni.'); return }
                    if (target && window.confirm(`Merge “${t.name}” into “${target.name}”? Current members move across; nights already counted stay as they were.`))
                      run('offcampus_admin_team', { p_action: 'merge', p_team: t.id, p_into: target.id })
                  }}>Merge</button>}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
