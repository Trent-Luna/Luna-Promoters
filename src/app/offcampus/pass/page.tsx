import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Crest } from '@/components/offcampus/Crest'
import { loadPublicInfo } from '@/lib/offcampus/data'
import { FindPass } from './find'

export const dynamic = 'force-dynamic'

export default async function FindPassPage() {
  if (!(await loadPublicInfo())) notFound()
  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '24px 20px 48px' }}>
      <Link href="/offcampus" style={{ fontSize: 13, color: '#B8B0CC', textDecoration: 'none' }}>← Off Campus</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '18px 0 22px' }}>
        <Crest size={64} />
        <h1 className="oc-display" style={{ margin: 0, fontSize: 30, lineHeight: 1 }}>MY SEASON PASS</h1>
      </div>
      <FindPass />
    </main>
  )
}
