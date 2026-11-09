'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import QR from 'qrcode'
import { createClient } from '@/lib/supabase/client'
import { DOOR_PATH, registerError } from '@/lib/offcampus/logic'
import { rememberPass } from '../remember'

type Uni = { id: string; name: string; short: string | null; teams: { id: string; name: string }[] }

/** Save-to-photos, "remember on this phone", and changing club before the first scan. */
export function PassExtras({ token, firstName, clubLine, university, canChange, universityId, teamId, universities }: {
  token: string; firstName: string; clubLine: string; university: string; canChange: boolean
  universityId: string; teamId: string | null; universities: Uni[]
}) {
  useEffect(() => { rememberPass(token) }, [token])
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const blob = await drawPass(`${window.location.origin}${DOOR_PATH}${token}`, firstName, clubLine, university)
      if (!blob) return
      const file = new File([blob], 'off-campus-pass.png', { type: 'image/png' })
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: 'Off Campus season pass' }).catch(() => {})
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'off-campus-pass.png'; a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 2000)
      }
    } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
      <button type="button" className="oc-btn oc-btn-primary" style={{ justifyContent: 'center' }} onClick={save} disabled={busy}>
        {busy ? 'Making your pass…' : 'Save pass to photos'}
      </button>
      {canChange && <ChangeClub token={token} universityId={universityId} teamId={teamId} universities={universities} />}
    </div>
  )
}

function ChangeClub({ token, universityId, teamId, universities }: {
  token: string; universityId: string; teamId: string | null; universities: Uni[]
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [uni, setUni] = useState(universityId)
  const [club, setClub] = useState(teamId ?? '')
  const [newClub, setNewClub] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const u = universities.find(x => x.id === uni)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!club) { setErr(registerError('bad_team')); return }
    if (club === '__new' && newClub.trim().length < 2) { setErr(registerError('bad_team')); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('offcampus_member_change_team', {
      p_token: token, p_university: uni,
      p_team: club.startsWith('__') ? null : club, p_new_team: club === '__new' ? newClub : null,
    })
    setBusy(false)
    if (error || !data?.ok) { setErr(registerError(data?.error)); return }
    setOpen(false); router.refresh()
  }

  if (!open) return (
    <button type="button" className="oc-btn" style={{ justifyContent: 'center', fontSize: 13 }} onClick={() => setOpen(true)}>
      Wrong club? Change it
    </button>
  )
  return (
    <form onSubmit={submit} className="oc-card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: '#B8B0CC' }}>You can change this until you’re first counted at the door this season.</p>
      <select className="oc-select" value={uni} onChange={e => { setUni(e.target.value); setClub('') }} aria-label="University">
        {universities.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <select className="oc-select" value={club} onChange={e => setClub(e.target.value)} aria-label="Club or society">
        <option value="">Choose your club or society</option>
        {u?.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        <option value="__new">My club isn’t listed</option>
        <option value="__none">Not in a club: count me for my uni</option>
      </select>
      {club === '__new' && (
        <input className="oc-input" maxLength={60} placeholder="Your club or society’s name" value={newClub} onChange={e => setNewClub(e.target.value)} />
      )}
      {err && <p role="alert" style={{ margin: 0, fontSize: 14, color: '#FCA5A5' }}>{err}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="oc-btn" style={{ justifyContent: 'center' }} onClick={() => setOpen(false)}>Cancel</button>
        <button className="oc-btn oc-btn-primary" style={{ justifyContent: 'center' }} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}

/** A 720×1080 pass image: crest colours, first name, club, QR. */
async function drawPass(qrUrl: string, name: string, club: string, uni: string): Promise<Blob | null> {
  const W = 720, H = 1080
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const x = c.getContext('2d'); if (!x) return null
  try { await document.fonts.ready } catch { /* older browsers */ }
  const display = "'OC Graduate', Rockwell, Georgia, serif"
  const body = "'OC Josefin', Arial, sans-serif"
  x.fillStyle = '#0B0812'; x.fillRect(0, 0, W, H)
  x.fillStyle = '#A78BFA'; x.fillRect(0, 0, W, 190)
  x.fillStyle = '#0B0812'; x.textAlign = 'center'
  x.font = `700 22px ${body}`; x.fillText('S E A S O N   P A S S', W / 2, 70)
  x.font = `64px ${display}`; x.fillText('OFF CAMPUS', W / 2, 145)
  x.fillStyle = '#F0EDF8'; x.font = `60px ${display}`; x.fillText(name.toUpperCase().slice(0, 16), W / 2, 290)
  x.font = `700 30px ${body}`; x.fillText(club.slice(0, 40), W / 2, 345)
  x.fillStyle = '#B8B0CC'; x.font = `400 26px ${body}`; x.fillText(uni.slice(0, 44), W / 2, 385)
  const qr = await QR.toDataURL(qrUrl, { width: 440, margin: 2, color: { dark: '#0B0812', light: '#FFFFFF' }, errorCorrectionLevel: 'M' })
  const img = new Image(); img.src = qr
  await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r() })
  x.fillStyle = '#FFFFFF'; x.fillRect(W / 2 - 236, 430, 472, 472)
  x.drawImage(img, W / 2 - 220, 446, 440, 440)
  x.fillStyle = '#7DD3FC'; x.font = `700 24px ${body}`; x.fillText('SHOW AT THE SU CASA DOOR EVERY THURSDAY', W / 2, 960)
  x.fillStyle = '#B8B0CC'; x.font = `400 22px ${body}`; x.fillText('648 Ann Street, Fortitude Valley · 18+ · photo ID required', W / 2, 1000)
  return await new Promise(r => c.toBlob(b => r(b), 'image/png'))
}
