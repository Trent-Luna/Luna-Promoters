'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerError, validateRegistration } from '@/lib/offcampus/logic'
import { rememberPass } from '../pass/remember'

type Uni = { id: string; name: string; short: string | null; teams: { id: string; name: string }[] }

export function RegisterForm({ universities, source }: { universities: Uni[]; source: string | null }) {
  const router = useRouter()
  const [f, setF] = useState({ full_name: '', email: '', mobile: '', university: '', club: '', new_club: '' })
  const [organiser, setOrganiser] = useState(false)
  const [age, setAge] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [marketing, setMarketing] = useState(false) // never pre-ticked
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }))
  const uni = useMemo(() => universities.find(u => u.id === f.university) ?? null, [universities, f.university])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    const bad = validateRegistration({ ...f, age, privacy })
    if (bad) { setErr(registerError(bad)); return }
    setBusy(true)
    try {
      const res = await fetch('/api/offcampus/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: f.full_name, email: f.email, mobile: f.mobile, university: f.university,
          team: f.club && !f.club.startsWith('__') ? f.club : null,
          new_team: f.club === '__new' ? f.new_club : null,
          organiser: f.club !== '__none' && organiser, age, privacy, marketing, source,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) { setErr(registerError(data?.error)); setBusy(false); return }
      rememberPass(data.pass_token)
      router.push(`/offcampus/pass/${data.pass_token}${data.already ? '?back=1' : '?new=1'}`)
    } catch {
      setErr(registerError('error')); setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }} noValidate>
      <div>
        <label className="oc-label" htmlFor="oc-name">Full name</label>
        <input id="oc-name" className="oc-input" autoComplete="name" placeholder="As it appears on your ID"
          value={f.full_name} onChange={e => set('full_name', e.target.value)} required />
      </div>
      <div>
        <label className="oc-label" htmlFor="oc-email">Email</label>
        <input id="oc-email" className="oc-input" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com"
          value={f.email} onChange={e => set('email', e.target.value)} required />
      </div>
      <div>
        <label className="oc-label" htmlFor="oc-mobile">Mobile</label>
        <input id="oc-mobile" className="oc-input" type="tel" autoComplete="tel" inputMode="tel" placeholder="04xx xxx xxx"
          value={f.mobile} onChange={e => set('mobile', e.target.value)} required />
      </div>
      <div>
        <label className="oc-label" htmlFor="oc-uni">University</label>
        <select id="oc-uni" className="oc-select" value={f.university}
          onChange={e => setF(p => ({ ...p, university: e.target.value, club: '', new_club: '' }))} required>
          <option value="">Choose your university</option>
          {universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div>
        <label className="oc-label" htmlFor="oc-club">Club or society</label>
        <select id="oc-club" className="oc-select" value={f.club} disabled={!uni} onChange={e => set('club', e.target.value)} required>
          <option value="">{uni ? 'Choose your club or society' : 'Choose your university first'}</option>
          {uni?.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          {uni && <option value="__new">My club isn’t listed</option>}
          {uni && <option value="__none">Not in a club: count me for my uni</option>}
        </select>
        {f.club === '__new' && (
          <div style={{ marginTop: 10 }}>
            <label className="oc-label" htmlFor="oc-newclub">Your club or society’s name</label>
            <input id="oc-newclub" className="oc-input" maxLength={60} placeholder="e.g. Rowing Club"
              value={f.new_club} onChange={e => set('new_club', e.target.value)} />
            <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#B8B0CC' }}>
              We’ll check it and add it. Until then your arrivals count for your uni, and move to your club once it’s added.
            </p>
          </div>
        )}
      </div>

      {f.club && f.club !== '__none' && (
        <label className="oc-check">
          <input type="checkbox" checked={organiser} onChange={e => setOrganiser(e.target.checked)} />
          <span>I’m a captain or organiser for this club <span style={{ color: '#B8B0CC' }}>(optional; we’ll confirm before any prize goes to you)</span></span>
        </label>
      )}

      <div style={{ height: 1, background: '#3A2F52', margin: '4px 0' }} />

      <label className="oc-check">
        <input type="checkbox" checked={age} onChange={e => setAge(e.target.checked)} />
        <span>I’m 18 or over and understand photo ID is checked at the door.</span>
      </label>
      <label className="oc-check">
        <input type="checkbox" checked={privacy} onChange={e => setPrivacy(e.target.checked)} />
        <span>I’ve read the <a href="/offcampus/privacy" target="_blank">privacy notice</a> and the{' '}
          <a href="/offcampus/terms" target="_blank">terms</a>.</span>
      </label>
      <label className="oc-check">
        <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} />
        <span style={{ color: '#B8B0CC' }}>Optional: send me Su Casa and Luna Group events and news.</span>
      </label>

      {err && <p role="alert" style={{ margin: 0, fontSize: 14, color: '#FCA5A5' }}>{err}</p>}
      <button className="oc-btn oc-btn-primary" style={{ justifyContent: 'center' }} disabled={busy}>
        {busy ? 'Getting your pass…' : 'Get my season pass'}
      </button>
      <p style={{ margin: 0, fontSize: 12.5, color: '#B8B0CC', textAlign: 'center' }}>
        Registering doesn’t count as a visit. Only a scan at the door does.
      </p>
    </form>
  )
}
