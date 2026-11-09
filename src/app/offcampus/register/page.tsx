import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Crest } from '@/components/offcampus/Crest'
import { loadPublicInfo } from '@/lib/offcampus/data'
import { RegisterForm } from './form'

export const dynamic = 'force-dynamic'

export default async function OffCampusRegister({ searchParams }: { searchParams: Promise<{ src?: string }> }) {
  const { src } = await searchParams
  const info = await loadPublicInfo()
  if (!info) notFound()

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 48px' }}>
      <Link href="/offcampus" style={{ fontSize: 13, color: '#B8B0CC', textDecoration: 'none' }}>← Off Campus</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '18px 0 22px' }}>
        <Crest size={70} />
        <div>
          <div className="oc-eyebrow">Season pass · free</div>
          <h1 className="oc-display" style={{ margin: '6px 0 0', fontSize: 30, lineHeight: 1 }}>REGISTER YOUR CLUB</h1>
        </div>
      </div>
      <p style={{ margin: '0 0 22px', fontSize: 15, lineHeight: 1.5, color: '#B8B0CC' }}>
        One pass for the whole season. Show it at the door every Thursday and every scan counts for your club.
      </p>
      <RegisterForm universities={info.universities} source={src ?? null} />
    </main>
  )
}
