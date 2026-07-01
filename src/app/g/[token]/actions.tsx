'use client'
interface Props { title: string; date: string; start?: string | null; end?: string | null; shareUrl: string }

export function CalendarShare({ title, date, start, end, shareUrl }: Props) {
  function gcal() {
    const s = (date + 'T' + (start || '21:00') + ':00').replace(/[-:]/g, '')
    const e = (date + 'T' + (end || '23:59') + ':00').replace(/[-:]/g, '')
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${s}/${e}`
    window.open(url, '_blank')
  }
  async function share() {
    if (navigator.share) { try { await navigator.share({ title, url: shareUrl }) } catch {} }
    else { await navigator.clipboard.writeText(shareUrl); alert('Link copied!') }
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <button onClick={gcal} className="btn-ghost">Add to calendar</button>
      <button onClick={share} className="btn-ghost">Share with friends</button>
    </div>
  )
}
