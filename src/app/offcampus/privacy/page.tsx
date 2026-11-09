import { LegalPage } from '../legal'

export const metadata = { title: 'Off Campus privacy · Su Casa' }

// Version recorded against every member as offcampus_settings.privacy_version.
// Change both together when this notice changes.
export default function OffCampusPrivacy() {
  return (
    <LegalPage title="PRIVACY" sub="Off Campus Thursdays · notice oc-privacy-2026-11-09" sections={[
      { h: 'What we collect', p: [
        'Your name, email, mobile, university, club or society, whether you asked to be an organiser, and whether you want to hear from us. Each Thursday we also record that your pass was scanned, when, and which staff member scanned it.',
      ] },
      { h: 'Why', p: [
        'To give you a season pass, count your club’s arrivals, publish the results, award prizes, and keep the night fair and safe. We do not collect your date of birth or a copy of your ID for Off Campus; door staff check ID as usual.',
      ] },
      { h: 'Who sees it', p: [
        'Su Casa and Luna Group staff who run Off Campus. Door staff see your first name, university and club when they scan you. The public results show club and university totals only, never names. We don’t give your details to your university or your club.',
        'Your details are kept in Luna Group’s customer system alongside any other bookings or guest lists you’ve used with us.',
      ] },
      { h: 'Marketing', p: [
        'We only send you news and offers if you ticked the box to say yes. Joining Off Campus never depends on it, and you can opt out at any time from any message we send.',
      ] },
      { h: 'Your choices', p: [
        'You can ask the Su Casa team to see, correct or remove your details. Removing them ends your pass; arrivals already counted stay in club totals without your name.',
      ] },
    ]} />
  )
}
