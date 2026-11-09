'use client'
import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { doorResult, type DoorResult } from '@/lib/offcampus/logic'

const TONE = { ok: '#34D399', warn: '#FBBF24', err: '#F87171' } as const

export function DoorCount({ token }: { token: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [res, setRes] = useState<DoorResult | null>(null)
  const [busy, setBusy] = useState(false)

  async function count() {
    if (!navigator.onLine) { setRes({ kind: 'err', title: 'NO SIGNAL', sub: 'Off Campus arrivals need a connection. Try again when you’re back online.' }); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('offcampus_check_in', { p_token: token, p_device: 'phone camera' })
    setBusy(false)
    setRes(error ? { kind: 'err', title: 'NO SIGNAL', sub: 'Couldn’t reach the server. Try again.' } : doorResult(data))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 28 }}>
      {res ? (
        <div role="status" style={{ border: `2px solid ${TONE[res.kind]}`, borderRadius: 18, padding: '26px 18px', textAlign: 'center' }}>
          <div className="oc-display" style={{ fontSize: 34, color: TONE[res.kind], lineHeight: 1 }}>{res.title}</div>
          {res.sub && <div style={{ marginTop: 10, fontSize: 17 }}>{res.sub}</div>}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 15, color: '#B8B0CC' }}>Check their photo ID as usual, then count the arrival.</p>
      )}
      {!res && (
        <button type="button" className="oc-btn oc-btn-primary" style={{ justifyContent: 'center', minHeight: 64, fontSize: 18 }}
          onClick={count} disabled={busy}>{busy ? 'Counting…' : 'Count arrival'}</button>
      )}
      <a href="/reception" className="oc-btn" style={{ justifyContent: 'center' }}>Back to door check-in</a>
    </div>
  )
}
