'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/format'

type Guest = {
  first_name: string; last_name: string; venue_name: string
  event_date: string; no_entry: boolean; special_occasion: string | null
}
type Person = {
  id: string; full_name: string; promoter_code: string | null
  category: 'house' | 'promoter' | 'dj' | 'staff'
  checked_in: number; no_entry: number; guests: Guest[]
}

const CAT_LABEL: Record<string, string> = {
  house: 'Luna Group — public guestlist', promoter: 'Promoters', dj: 'DJs', staff: 'Staff',
}
const CAT_ORDER = ['house', 'promoter', 'dj', 'staff']

export function ReportView({ from, to, label }: { from: string; to: string; label: string }) {
  const supabase = useMemo(() => createClient(), [])
  const [people, setPeople] = useState<Person[] | null>(null)

  useEffect(() => {
    supabase.rpc('get_week_breakdown', { p_from: from, p_to: to })
      .then(({ data }) => setPeople((data ?? []) as Person[]))
  }, [from, to, supabase])

  const totals = useMemo(() => {
    const p = people ?? []
    return {
      people: p.filter(x => x.checked_in > 0).length,
      checkedIn: p.reduce((s, x) => s + (x.checked_in || 0), 0),
      noEntry: p.reduce((s, x) => s + (x.no_entry || 0), 0),
    }
  }, [people])

  const groups = useMemo(() => {
    const p = people ?? []
    return CAT_ORDER
      .map(cat => ({ cat, rows: p.filter(x => x.category === cat) }))
      .filter(g => g.rows.length > 0)
  }, [people])

  const generatedAt = new Date().toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })

  return (
    <div style={S.page}>
      <style>{PRINT_CSS}</style>

      <div className="rpt-bar no-print" style={S.bar}>
        <a href="/admin/summary" style={S.back}>← Back to summary</a>
        <button onClick={() => window.print()} style={S.btn}>Download / Print PDF</button>
      </div>

      <div className="rpt-doc" style={S.doc}>
        <header style={S.head}>
          <div>
            <div style={S.brand}>LUNA GROUP</div>
            <div style={S.sub}>Weekly check-in report</div>
          </div>
          <div style={S.headRight}>
            <div style={S.period}>{label || 'Selected week'}</div>
            <div style={S.gen}>Generated {generatedAt}</div>
          </div>
        </header>

        {people === null && <p style={S.muted}>Loading report…</p>}

        {people && (
          <>
            <div style={S.totals}>
              <Tot n={totals.checkedIn} l="Total checked in" />
              <Tot n={totals.people} l="Active people" />
              <Tot n={totals.noEntry} l="No entries" />
            </div>

            {groups.length === 0 && <p style={S.muted}>No check-ins recorded for this week.</p>}

            {groups.map(g => (
              <section key={g.cat} style={S.section} className="rpt-section">
                <h2 style={S.h2}>{CAT_LABEL[g.cat]}</h2>
                {g.rows.map(person => (
                  <div key={person.id} style={S.person} className="rpt-person">
                    <div style={S.personHead}>
                      <span style={S.personName}>
                        {person.full_name}
                        {person.promoter_code ? <span style={S.code}> ({person.promoter_code})</span> : null}
                      </span>
                      <span style={S.count}>{person.checked_in} checked in</span>
                    </div>
                    {person.guests.length > 0 ? (
                      <table style={S.table}>
                        <thead>
                          <tr>
                            <th style={S.th}>#</th>
                            <th style={S.th}>Guest</th>
                            <th style={S.th}>Venue</th>
                            <th style={S.th}>Date</th>
                            <th style={S.th}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {person.guests.map((gs, i) => (
                            <tr key={i}>
                              <td style={S.td}>{i + 1}</td>
                              <td style={S.td}>
                                {gs.first_name} {gs.last_name}
                                {gs.special_occasion ? <em style={S.occ}> · {gs.special_occasion}</em> : null}
                              </td>
                              <td style={S.td}>{gs.venue_name}</td>
                              <td style={S.td}>{fmtDate(gs.event_date)}</td>
                              <td style={S.td}>{gs.no_entry ? 'No entry' : 'Checked in'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p style={S.none}>No individual guests recorded.</p>
                    )}
                  </div>
                ))}
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

function Tot({ n, l }: { n: number; l: string }) {
  return (
    <div style={S.tot}>
      <div style={S.totN}>{n}</div>
      <div style={S.totL}>{l}</div>
    </div>
  )
}

const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  .rpt-doc { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
  .rpt-person { break-inside: avoid; }
  .rpt-section { break-inside: auto; }
}
`

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#f3f4f6', color: '#111', padding: '24px 16px 64px' },
  bar: { maxWidth: 820, margin: '0 auto 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  back: { color: '#374151', textDecoration: 'none', fontSize: 14, fontWeight: 600 },
  btn: { background: '#111827', color: '#fff', border: 'none', borderRadius: 10, padding: '12px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  doc: { maxWidth: 820, margin: '0 auto', background: '#fff', borderRadius: 12, boxShadow: '0 1px 6px rgba(0,0,0,.12)', padding: 40 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #111', paddingBottom: 16, marginBottom: 20 },
  brand: { fontSize: 24, fontWeight: 800, letterSpacing: 2 },
  sub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  headRight: { textAlign: 'right' },
  period: { fontSize: 15, fontWeight: 700 },
  gen: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  totals: { display: 'flex', gap: 12, marginBottom: 24 },
  tot: { flex: 1, border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' },
  totN: { fontSize: 26, fontWeight: 800 },
  totL: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  section: { marginBottom: 26 },
  h2: { fontSize: 16, fontWeight: 800, background: '#111', color: '#fff', padding: '6px 12px', borderRadius: 6, marginBottom: 12 },
  person: { marginBottom: 14, paddingBottom: 4 },
  personHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  personName: { fontSize: 15, fontWeight: 700 },
  code: { color: '#6b7280', fontWeight: 400, fontSize: 13 },
  count: { fontSize: 14, fontWeight: 700, color: '#059669' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', color: '#6b7280', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', padding: '4px 8px', borderBottom: '1px solid #e5e7eb' },
  td: { padding: '5px 8px', borderBottom: '1px solid #f1f1f1' },
  occ: { color: '#7c3aed', fontStyle: 'italic' },
  none: { fontSize: 13, color: '#9ca3af', margin: '2px 0 0' },
  muted: { color: '#6b7280' },
}
