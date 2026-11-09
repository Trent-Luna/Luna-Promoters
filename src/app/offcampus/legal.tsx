import Link from 'next/link'
import { Crest } from '@/components/offcampus/Crest'

/** Shared shell for the Off Campus terms and privacy notice. */
export function LegalPage({ title, sub, sections }: { title: string; sub: string; sections: { h: string; p: string[] }[] }) {
  return (
    <main style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 56px' }}>
      <Link href="/offcampus" style={{ fontSize: 13, color: '#B8B0CC', textDecoration: 'none' }}>← Off Campus</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '18px 0 6px' }}>
        <Crest size={48} />
        <h1 className="oc-display" style={{ margin: 0, fontSize: 28, lineHeight: 1 }}>{title}</h1>
      </div>
      <p style={{ margin: '0 0 26px', fontSize: 13, color: '#B8B0CC' }}>{sub}</p>
      {sections.map(s => (
        <section key={s.h} style={{ marginBottom: 22 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700 }}>{s.h}</h2>
          {s.p.map((t, i) => <p key={i} style={{ margin: '0 0 8px', fontSize: 14.5, lineHeight: 1.6, color: '#D9D3E8' }}>{t}</p>)}
        </section>
      ))}
    </main>
  )
}
