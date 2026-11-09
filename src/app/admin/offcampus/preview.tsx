'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { boardCaption, type Board, type Level, type Period } from '@/lib/offcampus/logic'

/** Admin results: full counts, tonight included when "live" is on, and change since last week. */
export function Preview() {
  const supabase = useMemo(() => createClient(), [])
  const [period, setPeriod] = useState<Period>('week')
  const [level, setLevel] = useState<Level>('team')
  const [live, setLive] = useState(true)
  const [b, setB] = useState<Board | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let on = true
    supabase.rpc('offcampus_board', { p_period: period, p_level: level, p_live: live }).then(({ data, error }) => {
      if (!on) return
      if (error || !data?.ok) { setErr(error?.message ?? data?.error ?? 'Could not load'); return }
      setErr(''); setB(data as Board)
    })
    return () => { on = false }
  }, [supabase, period, level, live])

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="eyebrow mr-auto">Results preview</div>
        {(['week', 'month', 'season'] as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)} className={`pill ${period === p ? 'bg-luna-gold text-black' : 'bg-luna-surface'}`}>{p}</button>
        ))}
        {(['team', 'university'] as Level[]).map(l => (
          <button key={l} onClick={() => setLevel(l)} className={`pill ${level === l ? 'bg-luna-gold text-black' : 'bg-luna-surface'}`}>{l === 'team' ? 'club' : 'uni'}</button>
        ))}
        <label className="text-xs text-luna-muted flex items-center gap-1.5 ml-2">
          <input type="checkbox" checked={live} onChange={e => setLive(e.target.checked)} /> include tonight
        </label>
      </div>
      {err && <p className="text-sm text-red-400">{err}</p>}
      {b?.night ? (
        <>
          <p className="text-xs text-luna-muted mb-3">{boardCaption(b, period, level, true)}</p>
          {b.rows.length === 0 ? <p className="text-sm text-luna-muted">No arrivals yet.</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-luna-muted text-xs"><th className="py-1">#</th><th>Group</th><th className="text-right">Arrivals</th>
                {period === 'week' && <th className="text-right">Last week</th>}</tr></thead>
              <tbody>
                {b.rows.map((r, i) => (
                  <tr key={i} className="border-t border-white/[0.06]">
                    <td className="py-1.5 w-8">{r.rank}</td>
                    <td>{r.name}{r.uni ? <span className="text-luna-muted"> · {r.uni}</span> : null}</td>
                    <td className="text-right font-semibold">{r.n}</td>
                    {period === 'week' && <td className="text-right text-luna-muted">{r.key && b.previous ? (b.previous[r.key] ?? '–') : '–'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs text-luna-muted mt-3">The public page shows completed Thursdays only, and counts under {b.min_public_count} as “&lt;{b.min_public_count}”.</p>
        </>
      ) : !err && <p className="text-sm text-luna-muted">No Off Campus night has started yet.</p>}
    </div>
  )
}
