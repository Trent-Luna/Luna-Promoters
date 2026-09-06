'use client'
import { useState, useTransition, useRef } from 'react'
import { createStaff, removeStaffRole } from '../actions'

interface Venue { id: string; name: string }
interface Staff { id: string; role: string; email: string; venue: string; name?: string | null }

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin', venue_manager: 'Venue Manager', reception: 'Reception / Door',
}

export function StaffManager({ venues, staff }: { venues: Venue[]; staff: Staff[] }) {
  const [role, setRole] = useState('reception')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const needsVenue = role === 'reception' || role === 'venue_manager'

  function submit(fd: FormData) {
    setMsg(null)
    start(async () => {
      try {
        await createStaff(fd)
        setMsg({ ok: true, text: 'Account created. They can now log in with these details.' })
        formRef.current?.reset(); setRole('reception')
      } catch (e: any) {
        setMsg({ ok: false, text: e?.message || 'Could not create account.' })
      }
    })
  }

  const grouped = {
    reception: staff.filter(s => s.role === 'reception'),
    venue_manager: staff.filter(s => s.role === 'venue_manager'),
    admin: staff.filter(s => s.role === 'admin'),
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
      {/* existing staff */}
      <div className="space-y-4">
        {(['admin', 'venue_manager', 'reception'] as const).map(r => (
          <div key={r} className="card px-5 py-4">
            <div className="flex items-center gap-3">
              <h3 className="font-bold">{ROLE_LABEL[r]}{r !== 'admin' ? ' staff' : 's'}</h3>
              <span className="ml-auto text-xs text-luna-muted">{grouped[r].length}</span>
            </div>
            {grouped[r].length === 0 && <p className="text-sm text-luna-muted py-3">None yet.</p>}
            {grouped[r].map(s => (
              <div key={s.id} className="flex items-center gap-3 py-2.5 border-t border-white/[0.07]">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{s.name || s.email}</div>
                  <div className="text-xs text-luna-muted truncate">{s.name ? `${s.email} · ` : ''}{s.venue}</div>
                </div>
                {r !== 'admin' && <span className="pill bg-white/[0.07] text-luna-text/90 font-medium hidden sm:inline-flex">{s.venue}</span>}
                <RemoveBtn id={s.id} />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* create form */}
      <form ref={formRef} action={submit} className="card p-5 space-y-3">
        <h2 className="font-bold">Add a staff account</h2>
        <p className="text-xs text-luna-muted">They log in at the normal login page and are taken straight to their screen.</p>
        <div><label className="label">Full name</label><input name="full_name" required className="input" placeholder="Jane Smith" /></div>
        <div><label className="label">Email</label><input name="email" type="email" required className="input" placeholder="name@lunagroup.com.au" /></div>
        <div><label className="label">Temporary password</label><input name="password" required minLength={6} className="input" placeholder="6+ characters" /></div>
        <div><label className="label">Role</label>
          <select name="role" className="input" value={role} onChange={e => setRole(e.target.value)}>
            <option value="reception">Reception / Door staff</option>
            <option value="venue_manager">Venue Manager</option>
            <option value="admin">Admin (full access)</option>
          </select>
        </div>
        {needsVenue && (
          <div><label className="label">Venue</label>
            <select name="venue_id" required className="input">
              <option value="">Select a venue…</option>
              {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <p className="text-[11px] text-luna-muted mt-1">They'll only see this venue's guests and check-ins.</p>
          </div>
        )}
        {msg && <p className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>}
        <button className="btn-gold w-full" disabled={pending}>{pending ? 'Creating…' : 'Create account'}</button>
      </form>

    </div>
  )
}

function RemoveBtn({ id }: { id: string }) {
  const [pending, start] = useTransition()
  return (
    <button disabled={pending}
      onClick={() => { if (confirm('Remove this access?')) start(() => removeStaffRole(id)) }}
      className="btn-ghost !py-1.5 !px-3 text-xs !text-luna-muted hover:!text-red-400">
      Remove
    </button>
  )
}
