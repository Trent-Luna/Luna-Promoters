'use client'
import { useState } from 'react'
import { useOc, Msg } from './use-oc'

const TIES: [string, string][] = [
  ['', 'Not chosen'], ['shared', 'Shared win (co-winners)'], ['first_to_total', 'First to reach the final total'],
  ['most_weekly_wins', 'Most weekly wins (season prize only)'], ['admin', 'An admin decides under the published rules'],
]

export function SettingsTab({ settings: s }: { settings: any }) {
  const { run, msg } = useOc()
  const [links, setLinks] = useState({ booth_url: s?.booth_url ?? '', whatsapp_url: s?.whatsapp_url ?? '', instagram_url: s?.instagram_url ?? '' })
  const [version, setVersion] = useState('')
  if (!s) return <p className="text-sm text-luna-muted">Off Campus settings aren’t set up in the database yet.</p>
  const toggle = (k: string, label: string, help: string) => (
    <label className="flex items-start gap-3 py-3 border-t border-white/[0.06] first:border-0 cursor-pointer">
      <input type="checkbox" className="mt-1 h-5 w-5" checked={!!s[k]} onChange={e => {
        if (k === 'enabled' && e.target.checked && !window.confirm('Switch Off Campus on? Sign-ups open and door scans start counting during club night windows.')) return
        run('offcampus_admin_set_settings', { p: { [k]: e.target.checked } })
      }} />
      <span><b>{label}</b><br /><span className="text-sm text-luna-muted">{help}</span></span>
    </label>
  )

  return (
    <div className="space-y-5 max-w-2xl">
      <Msg msg={msg} />
      <div className="card p-5">
        <div className="eyebrow mb-1">Switches</div>
        {toggle('enabled', 'Off Campus is on', 'Public pages, sign-up, passes and door counting. Off: everything answers “not found” and nothing counts.')}
        {toggle('public_board', 'Show results publicly', 'Weekly, monthly and season totals on the What’s On page. Completed Thursdays only, group totals only.')}
        {toggle('show_prizes', 'Show prizes on the What’s On page', 'The $5,000 season celebration, weekly VIP booth, uni perks and free pizza block, with the terms link.')}
        {toggle('prizes_on', 'Prize workflow', 'Propose, verify and approve winners in admin. Needs an approved rules version. Sends nothing to anyone.')}
        {toggle('two_admin_approval', 'Two admins for winners', 'The admin who verifies a prize can’t also approve it.')}
      </div>

      <div className="card p-5 space-y-3">
        <div className="eyebrow">Prize rules</div>
        <label className="block"><span className="label">Season prize goes to</span>
          <select className="input" value={s.winner_level ?? ''} onChange={e => run('offcampus_admin_set_settings', { p: { winner_level: e.target.value } })}>
            <option value="">Not chosen</option><option value="team">The top club or society</option><option value="university">The top university</option>
          </select>
        </label>
        <label className="block"><span className="label">Tie rule (never random)</span>
          <select className="input" value={s.tie_rule ?? ''} onChange={e => run('offcampus_admin_set_settings', { p: { tie_rule: e.target.value } })}>
            {TIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <p className="text-xs text-luna-muted">Changing either one withdraws the approval below and switches the prize workflow off until it’s approved again.</p>
        <div className="pt-2 border-t border-white/[0.06]">
          {s.rules_approved_at
            ? <p className="text-sm">Approved: <b>{s.rules_version}</b> on {new Date(s.rules_approved_at).toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}</p>
            : <p className="text-sm text-amber-400">No rules version approved yet.</p>}
          <div className="flex gap-2 mt-2">
            <input className="input" placeholder="Rules version, e.g. Season 01 terms v1 (legal checked 10 Nov)" value={version} onChange={e => setVersion(e.target.value)} />
            <button className="btn-gold" onClick={async () => { const r = await run('offcampus_admin_approve_rules', { p_version: version }); if (r.ok) setVersion('') }}>Approve</button>
          </div>
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <div className="eyebrow">What’s On page links</div>
        <label className="block"><span className="label">Book a VIP booth (link)</span><input className="input" value={links.booth_url} onChange={e => setLinks(l => ({ ...l, booth_url: e.target.value }))} /></label>
        <label className="block"><span className="label">Su Casa WhatsApp channel</span><input className="input" value={links.whatsapp_url} onChange={e => setLinks(l => ({ ...l, whatsapp_url: e.target.value }))} /></label>
        <label className="block"><span className="label">Su Casa Instagram</span><input className="input" value={links.instagram_url} onChange={e => setLinks(l => ({ ...l, instagram_url: e.target.value }))} /></label>
        <label className="block"><span className="label">Smallest public count</span>
          <input className="input max-w-[120px]" type="number" min={1} max={20} defaultValue={s.min_public_count}
            onBlur={e => Number(e.target.value) !== s.min_public_count && run('offcampus_admin_set_settings', { p: { min_public_count: Number(e.target.value) } })} />
        </label>
        <button className="btn-gold" onClick={() => run('offcampus_admin_set_settings', { p: links })}>Save links</button>
        <p className="text-xs text-luna-muted">A link left blank hides its button.</p>
      </div>
    </div>
  )
}
