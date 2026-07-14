// =====================================================================
// Luna Group :: VIP booth + occasion content for guest confirmation emails
// ---------------------------------------------------------------------
// EVERY guestlist confirmation email now ends with a "Book a VIP Booth"
// block (links to reservations.lunagroup.com.au). On top of that:
//
//  • Birthday at a venue we have a menu for  -> full Silver/Gold/Platinum tiers
//  • Hens / Bucks                            -> tailored party CTA
//  • Any other occasion, or no occasion      -> generic VIP booth CTA
//
// To edit anything, this is the only file you touch:
//  • Prices / inclusions:  BIRTHDAY_TIERS below.
//  • Add a venue's birthday menu:  add its slug -> shot name in BIRTHDAY_SHOT.
//  • Add real Hens/Bucks menus:  give them tiers like the birthday ones.
//  • Reservations link:  RESERVATIONS_URL.
//
// (Pump Nightclub currently has no birthday menu, so a Pump birthday guest
// still gets the VIP booth block — just without the priced tiers.)
// =====================================================================

export const RESERVATIONS_URL = 'https://reservations.lunagroup.com.au'

type Tier = { name: string; price: number; items: string[] }

// The birthday menu is identical between venues apart from the house shot name.
const BIRTHDAY_TIERS = (shot: string): Tier[] => [
  { name: 'SILVER', price: 100, items: [`6 × ${shot} Shots`, '1 × Martini', '1 × Birthday Sign'] },
  { name: 'GOLD', price: 150, items: [`10 × ${shot} Shots`, '1 × Martini', '1 × Confetti Cannon', '1 × Birthday Sign'] },
  { name: 'PLATINUM', price: 200, items: [`15 × ${shot} Shots`, '1 × Martini', '1 × Birthday Sign', '2 × Confetti Cannons', '1 × Birthday Shoutout'] },
]

// venue slug -> house shot name used in that venue's birthday menu
const BIRTHDAY_SHOT: Record<string, string> = {
  'eclipse': 'Eclipse',
  'eclipse-afterdark': 'After Dark',
  'su-casa-brisbane': 'Su Casa',
}

type Block = { emoji: string; label: string; heading: string; intro: string; tiers: Tier[] }

function resolveBlock(venueSlug: string | null | undefined, occasion: string | null | undefined): Block {
  const occ = (occasion ?? '').trim()

  // Birthday — show the priced menu if we have one for this venue.
  if (occ === 'Birthday') {
    const shot = venueSlug ? BIRTHDAY_SHOT[venueSlug] : undefined
    if (shot) {
      return {
        emoji: '🎂',
        label: 'BIRTHDAY PACKAGES',
        heading: 'Make your birthday one to remember',
        intro: 'Pre-order a package and we’ll have it set up and waiting when you arrive. Add one when you book your booth below.',
        tiers: BIRTHDAY_TIERS(shot),
      }
    }
    return {
      emoji: '🎂',
      label: 'BIRTHDAY',
      heading: 'Celebrating a birthday?',
      intro: 'Lock in a VIP booth and we’ll make sure your night goes off — bottle service and the best seats in the house.',
      tiers: [],
    }
  }

  // Hens / Bucks — tailored CTA (real menus can be added as tiers later).
  if (occ === 'Hens party' || occ === 'Bucks party') {
    const word = occ === 'Hens party' ? 'hens' : 'bucks'
    return {
      emoji: '🎉',
      label: `${word.toUpperCase()} PARTY`,
      heading: `Planning a ${word} night?`,
      intro: 'Lock in a VIP booth and our events team will look after your group with bottle service and the best spot in the room.',
      tiers: [],
    }
  }

  // Everyone else (any other occasion, or none) — generic VIP booth CTA.
  return {
    emoji: '🍾',
    label: 'VIP BOOTHS',
    heading: 'Want the VIP treatment?',
    intro: 'Skip the queue with your own booth — bottle service and the best seats in the house, sorted before you arrive.',
    tiers: [],
  }
}

// Always returns a "Book a VIP Booth" block for the email, richer for
// birthdays where we have a menu.
export function packageBlockHtml(
  venueSlug: string | null | undefined,
  occasion: string | null | undefined,
): string {
  const b = resolveBlock(venueSlug, occasion)

  const tiers = b.tiers
    .map(
      (t) => `
      <div style="border:1px solid #23232e;border-radius:12px;padding:14px 16px;margin:10px 0;text-align:left">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td style="font-weight:700;color:#ffffff;font-size:15px;letter-spacing:1px">${t.name}</td>
          <td style="font-weight:800;color:#d4af37;font-size:16px;text-align:right">$${t.price}</td>
        </tr></table>
        <div style="color:#9ca3af;font-size:13px;margin-top:8px;line-height:1.7">${t.items.join(' &nbsp;·&nbsp; ')}</div>
      </div>`,
    )
    .join('')

  return `
    <div style="background:#14141c;border:1px solid #23232e;border-radius:16px;padding:26px;margin-top:16px;text-align:center">
      <div style="display:inline-block;background:rgba(212,175,55,.15);color:#d4af37;font-size:12px;font-weight:700;letter-spacing:1px;padding:6px 12px;border-radius:999px">${b.emoji} ${b.label}</div>
      <h2 style="font-size:19px;margin:14px 0 4px;color:#ffffff">${b.heading}</h2>
      <p style="color:#9ca3af;font-size:13px;margin:0 0 ${tiers ? '18px' : '20px'}">${b.intro}</p>
      ${tiers}
      <a href="${RESERVATIONS_URL}" target="_blank" style="display:inline-block;background:#d4af37;color:#0a0a0f;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px;margin-top:14px">Book a VIP Booth →</a>
      <p style="color:#6b7280;font-size:12px;margin:16px 0 0">Prefer to chat? Just reply to this email and our events team will sort your celebration.</p>
    </div>`
}
