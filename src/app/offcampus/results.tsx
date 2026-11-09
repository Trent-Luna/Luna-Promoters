'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { barShare, boardCaption, countText, dayLabel, type Board, type Level, type Period } from '@/lib/offcampus/logic'

const PERIODS: [Period, string][] = [['week', 'This week'], ['month', 'This month'], ['season', 'Season']]
const LEVELS: [Level, string][] = [['team', 'By club'], ['university', 'By uni']]

/**
 * The public results: this week, this month and the season, by club or by
 * university. Totals only, never names, and completed Thursdays only.
 */
export function Results({ initial, enabled, showPrizes, firstNight }: {
  initial: Board | null; enabled: boolean; showPrizes: boolean; firstNight: string | null
}) {
  const supabase = useMemo(() => createClient(), [])
  const [period, setPeriod] = useState<Period>('week')
  const [level, setLevel] = useState<Level>('team')
  const cache = useRef(new Map<string, Board>(initial ? [['week:team', initial]] : []))
  const [board, setBoard] = useState<Board | null>(initial)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const key = `${period}:${level}`
    const hit = cache.current.get(key)
    if (hit) { setBoard(hit); setFailed(false); return }
    let live = true
    setLoading(true)
    supabase.rpc('offcampus_board', { p_period: period, p_level: level }).then(({ data, error }) => {
      if (!live) return
      setLoading(false)
      if (error || !data?.ok) { setFailed(true); return }
      cache.current.set(key, data as Board)
      setBoard(data as Board); setFailed(false)
    })
    return () => { live = false }
  }, [period, level, enabled, supabase])

  const rows = board?.rows ?? []
  const top = rows.find(r => r.n != null)?.n ?? null
  const min = board?.min_public_count ?? 3

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }} aria-labelledby="oc-results">
      <h2 id="oc-results" className="oc-display" style={{ margin: 0, fontSize: 26, lineHeight: 1 }}>THE RESULTS</h2>
      {!enabled ? (
        <p className="oc-card" style={{ margin: 0, padding: 16, fontSize: 14, color: '#B8B0CC' }}>
          Results go up here after each Thursday: this week, this month and the season, by club and by uni.
        </p>
      ) : (
        <>
          <div className="oc-seg" role="group" aria-label="Period">
            {PERIODS.map(([p, label]) => (
              <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>{label}</button>
            ))}
          </div>
          <div className="oc-seg" role="group" aria-label="Group by" style={{ background: 'transparent', border: 0, padding: 0 }}>
            {LEVELS.map(([l, label]) => (
              <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(l)}
                style={level === l ? undefined : { border: '1px solid #3A2F52' }}>{label}</button>
            ))}
          </div>
          {board?.night && <span style={{ fontSize: 13, color: '#B8B0CC' }}>{boardCaption(board, period, level, showPrizes)}</span>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: loading ? 0.5 : 1 }} aria-live="polite">
            {failed ? (
              <p style={{ margin: 0, fontSize: 14, color: '#B8B0CC' }}>Couldn’t load the results. Try again in a moment.</p>
            ) : !board?.night ? (
              <p className="oc-card" style={{ margin: 0, padding: 16, fontSize: 14, color: '#B8B0CC' }}>
                {firstNight ? `First results go up after launch night, ${dayLabel(firstNight)}.` : 'First results go up after the first Thursday.'}
              </p>
            ) : rows.length === 0 ? (
              <p className="oc-card" style={{ margin: 0, padding: 16, fontSize: 14, color: '#B8B0CC' }}>No arrivals counted for this one yet.</p>
            ) : rows.map((r, i) => {
              const lead = r.rank === 1
              return (
                <div key={`${r.name}-${r.uni}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14,
                  background: lead ? '#A78BFA' : '#161022', color: lead ? '#0B0812' : '#F0EDF8' }}>
                  <span className="oc-display" style={{ fontSize: 22, width: 28, lineHeight: 1 }}>{r.rank}</span>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.name}{r.uni && <span style={{ fontWeight: 400, opacity: 0.8 }}> · {r.uni}</span>}
                    </span>
                    <div style={{ height: 6, borderRadius: 999, background: lead ? '#0B0812' : '#7DD3FC', width: `${Math.round(barShare(r.n, top) * 100)}%` }} />
                  </div>
                  <span className="oc-display" style={{ fontSize: r.n == null ? 16 : 24, lineHeight: 1 }}
                    title={r.n == null ? `Fewer than ${min}` : undefined}>{countText(r, min)}</span>
                </div>
              )
            })}
          </div>
          {board?.booth && period === 'week' && (
            <div style={{ border: '1px dashed #3A2F52', borderRadius: 14, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="oc-eyebrow">This week’s VIP booth</span>
              <span style={{ fontSize: 14 }}>Won by <b>{board.booth.team}</b>{board.booth.uni ? ` (${board.booth.uni})` : ''} with {board.booth.n} arrivals</span>
            </div>
          )}
          <span style={{ fontSize: 12, lineHeight: 1.5, color: '#B8B0CC' }}>
            Counts are arrivals scanned at the door, once per person per night, updated after each Thursday. Club totals only, never
            names. Groups under {min} show as &lt;{min}.
          </span>
        </>
      )}
    </section>
  )
}
