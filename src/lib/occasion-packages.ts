// =====================================================================
// Luna Group :: occasion content for guest confirmation emails
// ---------------------------------------------------------------------
// For a Birthday / Hens / Bucks guestlist signup the email shows TWO things:
//
//  1. THE FREE GUESTLIST DEAL (no booth needed) — free group entry before
//     10:30pm, a complimentary all-night VIP wristband for the guest of
//     honour, min 5 people, within 2 weeks of the actual date.
//
//  2. THE VIP BOOTH UPSELL — "go bigger" with a booth, and (birthday only,
//     at venues we have a menu for) pre-add a Silver/Gold/Platinum package.
//
// Any other occasion, or none, just gets the VIP booth CTA.
//
// Edit points:
//  • Free deal wording:   DEAL_PERKS / dealCard().
//  • Package prices:      BIRTHDAY_TIERS.
//  • Venues with a menu:  BIRTHDAY_SHOT.
//  • Reservations link:   RESERVATIONS_URL.
// =====================================================================

export const RESERVATIONS_URL = 'https://reservations.lunagroup.com.au'

type Tier = { name: string; price: number; items: string[] }

const BIRTHDAY_TIERS = (shot: string): Tier[] => [
  { name: 'SILVER', price: 100, items: [`6 × ${shot} Shots`, '1 × Martini', '1 × Birthday Sign'] },
  { name: 'GOLD', price: 150, items: [`10 × ${shot} Shots`, '1 × Martini', '1 × Confetti Cannon', '1 × Birthday Sign'] },
  { name: 'PLATINUM', price: 200, items: [`15 × ${shot} Shots`, '1 × Martini', '1 × Birthday Sign', '2 × Confetti Cannons', '1 × Birthday Shoutout'] },
]

// venue slug -> house shot name (also gates which venues show the tiers)
const BIRTHDAY_SHOT: Record<string, string> = {
  'eclipse': 'Eclipse',
  'eclipse-afterdark': 'After Dark',
  'su-casa-brisbane': 'Su Casa',
}

// occasion (exact form value) -> wording
const PARTY: Record<string, { emoji: string; label: string; honour: string; when: string }> = {
  'Birthday': { emoji: '🎂', label: 'YOUR BIRTHDAY, ON US', honour: 'birthday star', when: 'your actual birthday' },
  'Hens party': { emoji: '🥂', label: 'HENS NIGHT, SORTED', honour: 'hen', when: 'the celebration' },
  'Bucks party': { emoji: '🍺', label: 'BUCKS NIGHT, SORTED', honour: 'buck', when: 'the celebration' },
}

// ---- small HTML helpers (email-safe, table based) -------------------
const card = (inner: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#14141c;border:1px solid #23232e;border-radius:16px;margin-top:16px"><tr><td style="padding:24px">${inner}</td></tr></table>`

const pill = (bg: string, color: string, text: string) =>
  `<span style="display:inline-block;background:${bg};color:${color};font-size:12px;font-weight:700;letter-spacing:1px;padding:6px 12px;border-radius:999px">${text}</span>`

const perk = (text: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0"><tr>` +
  `<td width="22" valign="top" style="color:#34d399;font-size:15px;font-weight:700">✓</td>` +
  `<td style="color:#d1d5db;font-size:14px;line-height:1.55;text-align:left">${text}</td></tr></table>`

const goldButton = (label: string) =>
  `<a href="${RESERVATIONS_URL}" target="_blank" style="display:inline-block;background:#d4af37;color:#0a0a0f;font-weight:700;text-decoration:none;padding:13px 28px;border-radius:10px;margin-top:6px">${label}</a>`

function dealCard(occasion: string): string {
  const p = PARTY[occasion]
  if (!p) return ''
  const perks =
    perk('<strong>Free entry</strong> for you and your guests before 10:30pm') +
    perk(`A complimentary <strong>all-night VIP wristband</strong> for the ${p.honour} — bar access all night`) +
    perk('Just roll in with a group of <strong>5 or more</strong> to unlock it') +
    perk(`Valid within <strong>2 weeks</strong> of ${p.when}`)
  return card(
    `<div style="text-align:center">${pill('rgba(16,185,129,.15)', '#34d399', `${p.emoji} ${p.label}`)}` +
      `<h2 style="font-size:19px;margin:14px 0 12px;color:#ffffff">Here's your guestlist deal 🎉</h2></div>` +
      perks +
      `<p style="color:#6b7280;font-size:12px;margin:14px 0 0;text-align:center">Subject to availability, dress code, valid 18+ ID and management discretion.</p>`,
  )
}

function boothCard(venueSlug: string | null | undefined, occasion: string): string {
  const shot = venueSlug ? BIRTHDAY_SHOT[venueSlug] : undefined
  const showTiers = occasion === 'Birthday' && !!shot
  const tiersHtml = showTiers
    ? BIRTHDAY_TIERS(shot as string)
        .map(
          (t) =>
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #23232e;border-radius:12px;margin:10px 0"><tr><td style="padding:13px 16px">` +
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>` +
            `<td style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:1px">${t.name}</td>` +
            `<td align="right" style="font-size:16px;font-weight:800;color:#d4af37">$${t.price}</td></tr></table>` +
            `<div style="color:#9ca3af;font-size:13px;margin-top:7px;line-height:1.7;text-align:left">${t.items.join(' &nbsp;·&nbsp; ')}</div>` +
            `</td></tr></table>`,
        )
        .join('')
    : ''
  const intro = showTiers
    ? 'Book a VIP booth for bottle service and the best seats in the house — then pre-add a birthday package:'
    : 'Book a VIP booth for bottle service and the best seats in the house, and our events team will look after your group.'
  return card(
    `<div style="text-align:center">${pill('rgba(212,175,55,.15)', '#d4af37', '🍾 WANT TO GO BIGGER?')}` +
      `<h2 style="font-size:19px;margin:14px 0 4px;color:#ffffff">Add a VIP booth</h2>` +
      `<p style="color:#9ca3af;font-size:13px;margin:0 0 ${tiersHtml ? '16px' : '18px'}">${intro}</p></div>` +
      tiersHtml +
      `<div style="text-align:center">${goldButton('Book a VIP Booth →')}` +
      `<p style="color:#6b7280;font-size:12px;margin:16px 0 0">Prefer to chat? Just reply to this email and our team will sort your celebration.</p></div>`,
  )
}

// Returns the occasion-specific card HTML to drop into the email body.
export function occasionBlocksHtml(
  venueSlug: string | null | undefined,
  occasion: string | null | undefined,
): string {
  const occ = (occasion ?? '').trim()
  if (PARTY[occ]) {
    return dealCard(occ) + boothCard(venueSlug, occ)
  }
  // any other occasion, or none — just the generic booth CTA
  return card(
    `<div style="text-align:center">${pill('rgba(212,175,55,.15)', '#d4af37', '🍾 VIP BOOTHS')}` +
      `<h2 style="font-size:19px;margin:14px 0 4px;color:#ffffff">Want the VIP treatment?</h2>` +
      `<p style="color:#9ca3af;font-size:13px;margin:0 0 18px">Skip the queue with your own booth — bottle service and the best seats in the house, sorted before you arrive.</p>` +
      goldButton('Book a VIP Booth →') +
      `</div>`,
  )
}
