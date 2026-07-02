import { Logo } from '@/components/Logo'
import Link from 'next/link'

export const metadata = { title: 'Terms & Conditions · Luna Group' }

const SECTIONS: { h: string; p: string[] }[] = [
  { h: '1. About these terms', p: [
    'These Terms & Conditions govern registration for and entry via the Luna Group guestlist across our venues, including Eclipse, Eclipse AfterDark, Su Casa Brisbane and Pump Nightclub. By registering for a guestlist you agree to these terms.',
  ] },
  { h: '2. Guestlist entry is subject to availability', p: [
    'Registering for a guestlist does not guarantee entry. All guestlists operate subject to availability and venue capacity, and may close without notice once capacity or a guestlist limit is reached.',
    'To avoid disappointment we recommend arriving early. Entry may be refused once a venue reaches capacity, regardless of guestlist registration.',
  ] },
  { h: '3. Cut-off times may vary', p: [
    'Guestlist cut-off times vary by venue, event and night, and may change at any time at management’s discretion. Guests must arrive before the applicable cut-off time to be eligible for guestlist entry or any associated benefit.',
    'Any specific arrival time, free-entry window or discount is only valid up to the cut-off and is not guaranteed after it.',
  ] },
  { h: '4. Special events may be excluded', p: [
    'Standard guestlists may not apply on special events, ticketed events, public holidays or promoter/private functions. On these dates the guestlist may be unavailable, or different entry conditions, pricing and cut-off times may apply.',
    'Where a date is blacked out, guestlist registration for that venue and date will not be available.',
  ] },
  { h: '5. Age and identification', p: [
    'All patrons must be 18 years or older. Valid, current photo identification must be presented on entry when requested. Entry will be refused without acceptable ID.',
  ] },
  { h: '6. Dress code and conditions of entry', p: [
    'Entry is subject to the venue dress code and standard conditions of entry. Management reserves the right to refuse entry or remove any person at its absolute discretion, including for intoxication or anti-social behaviour, in line with responsible service of alcohol obligations.',
  ] },
  { h: '7. Your guestlist pass', p: [
    'Each guest receives a personal QR code for a specific venue and date. It is valid for one entry only and is not transferable. If you do not save your QR code, our door team can still check you in using your name and details.',
  ] },
  { h: '8. Accurate information', p: [
    'You must provide accurate details when registering. Duplicate or fraudulent registrations may be removed. The same mobile number cannot be registered more than once for the same venue and date.',
  ] },
  { h: '9. Privacy and your information', p: [
    'By registering you consent to Luna Group collecting and handling the personal information you provide (such as your name, contact details and date of birth) for the purposes of managing guestlists, entry and venue operations. We handle your information in accordance with applicable Australian privacy laws.',
  ] },
  { h: '10. Marketing communications', p: [
    'Where you opt in, Luna Group may contact you about events, offers and promoter opportunities. You can opt out of marketing communications at any time.',
  ] },
  { h: '11. Promoters', p: [
    'Promoters participating in the Luna Group promoter program agree to follow Luna Group promoter guidelines. Abusive behaviour, or submitting fake or duplicate guests, may result in removal from the program. Only checked-in guests count toward rankings, tiers and rewards.',
  ] },
  { h: '12. Changes to these terms', p: [
    'Luna Group may update these terms at any time. The current version will always be available on this page. Continued use of the guestlist constitutes acceptance of the latest terms.',
  ] },
  { h: '13. Liability', p: [
    'To the maximum extent permitted by law, Luna Group is not liable for any loss or inconvenience arising from guestlist availability, entry refusal, changes to cut-off times, or the cancellation or variation of any event.',
  ] },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen">
      <header className="max-w-2xl mx-auto px-5 pt-8 flex items-center justify-between">
        <Logo size={30} />
        <Link href="/" className="text-sm text-luna-muted hover:text-white">Home</Link>
      </header>
      <section className="max-w-2xl mx-auto px-5 py-10">
        <h1 className="text-3xl font-extrabold mb-1">Terms &amp; Conditions</h1>
        <p className="text-luna-muted text-sm mb-8">Luna Group Hospitality · Guestlist &amp; entry</p>
        <div className="space-y-6">
          {SECTIONS.map(s => (
            <div key={s.h}>
              <h2 className="font-bold mb-1.5">{s.h}</h2>
              {s.p.map((para, i) => (
                <p key={i} className="text-luna-muted text-sm leading-relaxed mb-2">{para}</p>
              ))}
            </div>
          ))}
        </div>
        <p className="text-xs text-luna-muted mt-10">
          For questions about these terms, contact the Luna Group team.
        </p>
      </section>
    </main>
  )
}
