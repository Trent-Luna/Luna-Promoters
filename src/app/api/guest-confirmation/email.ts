export const TRENT_PROMOTER_ID = '44ba5714-717b-46fb-ac6d-93116db6167a'
export const TRENT_PROMOTER_CODE = 'trent49'

/** Trent Redman's promoter list — owner's guest list wording. UUID first; code is a backup. */
export function isTrentPromoter(promoterId?: string | null, promoterCode?: string | null): boolean {
  if (promoterId === TRENT_PROMOTER_ID) return true
  if (typeof promoterCode === 'string' && promoterCode.toLowerCase() === TRENT_PROMOTER_CODE) return true
  return false
}

export function confirmationSubject(venue: string, ownerGuestList: boolean): string {
  return ownerGuestList
    ? `You're on the owner's guest list — ${venue}`
    : `You're on the guestlist — ${venue}`
}

export function emailHtml(o: {
  first: string
  venue: string
  dateLabel: string
  qrImg: string
  pass: string
  occasionBlocks: string
  ownerGuestList?: boolean
}) {
  const pill = o.ownerGuestList
    ? `<span style="display:inline-block;background:rgba(212,175,55,.15);color:#d4af37;font-size:12px;font-weight:700;letter-spacing:1px;padding:6px 12px;border-radius:999px">OWNER'S GUEST LIST</span>`
    : `<span style="display:inline-block;background:rgba(16,185,129,.15);color:#34d399;font-size:12px;font-weight:700;letter-spacing:1px;padding:6px 12px;border-radius:999px">YOU'RE ON THE LIST</span>`
  const ownerLine = o.ownerGuestList
    ? `<p style="color:#e5e7eb;font-size:15px;margin:8px 0 10px">You're on the <span style="color:#d4af37;font-weight:700">owner's guest list</span>.</p>`
    : ''
  const qrCard = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#14141c;border:1px solid #23232e;border-radius:16px;margin-top:24px"><tr><td align="center" style="padding:28px">
        ${pill}
        <h1 style="font-size:22px;margin:14px 0 4px;color:#ffffff">Hey ${o.first} 👋</h1>
        ${ownerLine}<p style="color:#9ca3af;margin:0 0 2px">${o.venue}</p>
        <p style="color:#9ca3af;font-size:14px;margin:0">${o.dateLabel}</p>
        <table role="presentation" align="center" cellpadding="0" cellspacing="0" style="margin:22px auto 8px"><tr><td style="background:#ffffff;border-radius:14px;padding:16px">
          <img src="${o.qrImg}" width="200" height="200" alt="Your QR code" style="display:block;width:200px;height:200px" />
        </td></tr></table>
        <p style="color:#9ca3af;font-size:13px;margin:6px 0 18px">Show this QR at the door — it's personal to you.</p>
        <a href="${o.pass}" style="display:inline-block;background:#d4af37;color:#0a0a0f;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px">View &amp; save your QR</a>
        <p style="color:#6b7280;font-size:12px;margin:20px 0 0">No screenshot? No problem — just give your name at the door and we'll find you.</p>
      </td></tr></table>`
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#0a0a0f;font-family:Helvetica,Arial,sans-serif;color:#ffffff">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f"><tr><td align="center" style="padding:28px 14px">
      <table role="presentation" width="500" cellpadding="0" cellspacing="0" style="width:500px;max-width:500px;margin:0 auto">
        <tr><td align="center" style="font-size:22px;font-weight:800;letter-spacing:3px;color:#ffffff">LUNA GROUP</td></tr>
        <tr><td align="center" style="font-size:12px;letter-spacing:2px;color:#9ca3af;padding-top:2px">HOSPITALITY</td></tr>
        <tr><td>${qrCard}</td></tr>
        <tr><td>${o.occasionBlocks}</td></tr>
        <tr><td align="center" style="color:#6b7280;font-size:11px;padding-top:18px">Everyone needs their own QR — only checked-in guests count toward rewards.</td></tr>
      </table>
    </td></tr></table>
  </body></html>`
}
