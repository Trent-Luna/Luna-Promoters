// Client-side weekly PDF report generator (one-click download, no page nav).
import { createClient } from '@/lib/supabase/client'
import { fmtDate } from '@/lib/format'

type Guest = {
  first_name: string; last_name: string; venue_name: string
  event_date: string; no_entry: boolean; special_occasion: string | null
  plus_ones: number; method: string | null; checked_in_by: string | null
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

export async function downloadWeeklyReport(from: string, to: string, label: string) {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_week_breakdown', { p_from: from, p_to: to })
  if (error) throw new Error(error.message)
  const people = (data ?? []) as Person[]

  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const marginX = 40
  let y = 46

  const checkedIn = people.reduce((s, p) => s + (p.checked_in || 0), 0)
  const active = people.filter(p => p.checked_in > 0).length
  const noEntry = people.reduce((s, p) => s + (p.no_entry || 0), 0)
  const generatedAt = new Date().toLocaleString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
  let scanN = 0, manualN = 0
  for (const p of people) for (const g of p.guests) {
    if (g.no_entry) continue
    if (g.method === 'scan') scanN++
    else if (g.method === 'manual') manualN++
  }

  // Header
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(17, 17, 17)
  doc.text('LUNA GROUP', marginX, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110, 110, 110)
  doc.text('Weekly check-in report', marginX, y + 15)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(17, 17, 17)
  doc.text(label || 'Selected week', pageW - marginX, y, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110)
  doc.text(`Generated ${generatedAt}`, pageW - marginX, y + 14, { align: 'right' })
  y += 26
  doc.setDrawColor(17, 17, 17); doc.setLineWidth(1.2); doc.line(marginX, y, pageW - marginX, y)
  y += 22

  // Totals
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(17, 17, 17)
  doc.text(`${checkedIn} checked in`, marginX, y)
  doc.text(`${active} active people`, marginX + 150, y)
  doc.text(`${noEntry} no entries`, marginX + 300, y)
  y += 18
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110, 110, 110)
  doc.text(`Scanned in: ${scanN}     Manually checked in: ${manualN}`, marginX, y)
  y += 20

  if (people.length === 0) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(110, 110, 110)
    doc.text('No check-ins recorded for this week.', marginX, y)
    doc.save(fileName(label))
    return
  }

  const ensure = (need: number) => { if (y + need > 800) { doc.addPage(); y = 40 } }

  for (const cat of CAT_ORDER) {
    const rows = people.filter(p => p.category === cat)
    if (rows.length === 0) continue

    ensure(40)
    doc.setFillColor(17, 17, 17); doc.rect(marginX, y - 12, pageW - marginX * 2, 20, 'F')
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255)
    doc.text(CAT_LABEL[cat], marginX + 8, y + 2)
    y += 22

    for (const p of rows) {
      ensure(40)
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(17, 17, 17)
      const name = p.promoter_code ? `${p.full_name} (${p.promoter_code})` : p.full_name
      doc.text(name, marginX, y)
      doc.setTextColor(5, 150, 105)
      doc.text(`${p.checked_in} checked in`, pageW - marginX, y, { align: 'right' })
      y += 6

      if (p.guests.length > 0) {
        autoTable(doc, {
          startY: y + 4,
          margin: { left: marginX, right: marginX },
          head: [['#', 'Guest', 'Venue', 'Date', 'Method', 'By', 'Status']],
          body: p.guests.map((g, i) => [
            String(i + 1),
            `${g.first_name} ${g.last_name}${g.plus_ones > 0 ? ` (+${g.plus_ones})` : ''}${g.special_occasion ? ` · ${g.special_occasion}` : ''}`,
            g.venue_name,
            fmtDate(g.event_date),
            g.method === 'scan' ? 'Scan' : g.method === 'manual' ? 'Manual' : '—',
            g.checked_in_by || '—',
            g.no_entry ? 'No entry' : 'Checked in',
          ]),
          styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 30, 30] },
          headStyles: { fillColor: [240, 240, 240], textColor: [80, 80, 80], fontStyle: 'bold' },
          columnStyles: { 0: { cellWidth: 18 }, 3: { cellWidth: 55 }, 4: { cellWidth: 46 }, 6: { cellWidth: 54 } },
          theme: 'grid',
        })
        y = (doc as any).lastAutoTable.finalY + 14
      } else {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(150, 150, 150)
        doc.text('No individual guests recorded.', marginX, y + 12)
        y += 22
      }
    }
    y += 6
  }

  doc.save(fileName(label))
}

function fileName(label: string) {
  const safe = (label || 'week').replace(/[^\w\d]+/g, '-').replace(/^-|-$/g, '')
  return `Luna Group - Weekly Report - ${safe}.pdf`
}
