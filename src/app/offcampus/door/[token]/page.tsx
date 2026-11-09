import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSession, hasRole } from '@/lib/auth'
import { Crest } from '@/components/offcampus/Crest'
import { DoorCount } from './count'

export const dynamic = 'force-dynamic'

/**
 * Where an Off Campus pass QR lands when it's scanned with a phone camera
 * instead of the door console. Staff only (middleware sends everyone else to
 * the login). Nothing is counted until staff tap the button: opening the link
 * alone never counts, so a guest scanning their own pass does nothing.
 */
export default async function OffCampusDoor({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const s = await getSession()
  if (!s) redirect(`/login?next=/offcampus/door/${token}`)
  if (!hasRole(s, 'reception', 'venue_manager', 'admin')) {
    return (
      <main style={{ maxWidth: 420, margin: '0 auto', padding: '48px 20px', textAlign: 'center' }}>
        <Crest size={80} />
        <h1 className="oc-display" style={{ fontSize: 26 }}>THIS IS YOUR PASS</h1>
        <p style={{ color: '#B8B0CC' }}>Show it to the Su Casa door staff on Thursday. Only their scan counts.</p>
        <Link href={`/offcampus`} className="oc-btn" style={{ justifyContent: 'center', marginTop: 16 }}>Off Campus</Link>
      </main>
    )
  }
  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '28px 20px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="oc-eyebrow">Off Campus · door</div>
        <Link href="/reception" style={{ fontSize: 13 }}>Door check-in</Link>
      </div>
      <DoorCount token={token} />
    </main>
  )
}
