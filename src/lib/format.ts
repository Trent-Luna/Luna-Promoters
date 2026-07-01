export const pct = (checked: number, registered: number) =>
  registered > 0 ? Math.round((checked / registered) * 100) : 0

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

export const fmtTime = (t?: string | null) => {
  if (!t) return ''
  const [h, m] = t.split(':')
  const hr = parseInt(h, 10)
  const ampm = hr >= 12 ? 'pm' : 'am'
  const h12 = hr % 12 || 12
  return `${h12}:${m}${ampm}`
}

export const fmtDateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''

export const tierLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export const csvEscape = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCSV(headers: string[], rows: (unknown[])[]) {
  const head = headers.map(csvEscape).join(',')
  const body = rows.map(r => r.map(csvEscape).join(',')).join('\n')
  return head + '\n' + body
}
