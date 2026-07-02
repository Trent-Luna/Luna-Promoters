'use client'
interface Props { title: string; date: string; start?: string | null; end?: string | null; promoterLink: string; qrUrl: string }

export function CalendarShare({ title, date, start, end, promoterLink, qrUrl }: Props) {
  function gcal() {
    const s = (date + 'T' + (start || '21:00') + ':00').replace(/[-:]/g, '')
    const e = (date + 'T' + (end || '23:59') + ':00').replace(/[-:]/g, '')
    const details = `Your Luna Group guestlist pass (show this link at the door): ${qrUrl}`
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${s}/${e}&details=${encodeURIComponent(details)}`
    window.open(url, '_blank')
  }
  async function share() {
    const text = `Come out with me! Register on the guestlist here: ${promoterLink}`
    if (navigator.share) { try { await navigator.share({ title: 'Join the guestlist', text, url: promoterLink }) } catch {} }
    else { await navigator.clipboard.writeText(promoterLink); alert('Promoter link copied — send it to your friends!') }
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <button onClick={gcal} className="btn-ghost">Add to calendar</button>
      <button onClick={share} className="btn-ghost">Invite friends</button>
    </div>
  )
}
