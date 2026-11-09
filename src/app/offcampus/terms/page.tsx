import { notFound } from 'next/navigation'
import { loadPublicInfo } from '@/lib/offcampus/data'
import { LegalPage } from '../legal'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Off Campus terms · Su Casa' }

const TIE: Record<string, string> = {
  shared: 'If clubs finish level, they share the prize as co-winners.',
  first_to_total: 'If clubs finish level, the club that reached the final total first (by the time of its last counted arrival) wins.',
  most_weekly_wins: 'If clubs finish level on the season, the club with the most weekly wins that season takes it. If they are still level, Su Casa decides under these terms and records why.',
  admin: 'If clubs finish level, Su Casa decides under these terms and records the reason.',
}

export default async function OffCampusTerms() {
  const info = await loadPublicInfo()
  if (!info) notFound()
  const level = info.winner_level === 'university' ? 'university' : 'club or society'
  return (
    <LegalPage title="TERMS" sub="Off Campus Thursdays at Su Casa Brisbane" sections={[
      { h: '1. What Off Campus is', p: [
        'Off Campus is a free weekly Thursday night at Su Casa Brisbane, 648 Ann Street, Fortitude Valley, for university clubs and societies. It is run by Su Casa Brisbane, part of Luna Group, and is not run, endorsed or sponsored by any university.',
      ] },
      { h: '2. Who can join', p: [
        'You must be 18 or over. Register with your own name, email and mobile and choose your university and your club or society. One pass per person. Registration is free and no purchase is ever needed to take part or to win.',
      ] },
      { h: '3. What counts', p: [
        'An arrival counts only when Su Casa door staff scan your season pass during the door window of an Off Campus Thursday (shown on the What’s On page). Each person counts once per Thursday, even if they leave and come back or arrive after midnight. Registering, RSVPing or opening your pass does not count.',
        'Your arrival counts for the club (or, if your club is still being added or you are not in one, the university) on your pass at the moment you are scanned. Nothing counts for spending, drinks or any challenge.',
      ] },
      { h: '4. Entry', p: [
        'Your pass is not a ticket and does not guarantee entry. Su Casa’s normal conditions of entry apply every week: valid photo ID, dress code, capacity and responsible service of alcohol. Management may refuse entry or remove anyone at its discretion.',
      ] },
      { h: '5. The weekly VIP booth', p: [
        'The club with the most counted arrivals on an Off Campus Thursday wins a VIP booth at Su Casa on a later Off Campus Thursday, arranged with the club’s confirmed captain or organiser. The booth and what comes with it are as advised by Su Casa. It can’t be exchanged for cash or transferred to another group.',
      ] },
      { h: '6. The $5,000 season celebration', p: [
        `Every 12 Thursdays makes a season. The ${level} with the most counted arrivals across the season wins a season celebration at Su Casa valued at $5,000. What the celebration includes is confirmed with the winner’s organiser and set out in writing before it’s held. It can’t be exchanged for cash.`,
      ] },
      { h: '7. Ties', p: [info.tie_rule ? TIE[info.tie_rule] : 'How a tie is decided will be published on this page before the first prize is awarded. A winner is never picked at random.'] },
      { h: '8. Winners', p: [
        'Results are checked before any prize is confirmed. Every prize is confirmed by Su Casa and awarded to the winning group’s confirmed captain or organiser. Su Casa may withhold a prize while results are checked.',
      ] },
      { h: '9. Fair play', p: [
        'Passes are personal. Sharing a pass, registering people who aren’t real or aren’t coming, or any attempt to inflate a count may lead to arrivals being removed, passes being paused and a club being excluded. Every correction is recorded with a reason.',
      ] },
      { h: '10. Results', p: [
        'Results are published as club and university totals only, never names. Groups with fewer than three counted arrivals show as “<3”.',
      ] },
      { h: '11. Your information', p: [
        'See the Off Campus privacy notice for what we collect and why.',
      ] },
      { h: '12. Changes', p: [
        'Su Casa may change, pause or end Off Campus, including the prizes, by updating this page. Arrivals already counted stay counted.',
      ] },
    ]} />
  )
}
