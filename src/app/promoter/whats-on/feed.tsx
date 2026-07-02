'use client'
import { useMemo, useState } from 'react'
import { fmtDateTime } from '@/lib/format'

interface Venue { id: string; name: string }
interface Post { id: string; title: string; body: string | null; image_url: string | null; created_at: string; venue_id: string | null; venue_name: string }

export function WhatsOnFeed({ venues, posts }: { venues: Venue[]; posts: Post[] }) {
  const [venue, setVenue] = useState('')
  const filtered = useMemo(
    () => venue ? posts.filter(p => p.venue_id === venue || p.venue_id === null) : posts,
    [posts, venue])

  return (
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setVenue('')}
          className={`pill border ${venue === '' ? 'bg-white/10 text-white border-white' : 'border-luna-border text-luna-muted'}`}>All venues</button>
        {venues.map(v => (
          <button key={v.id} onClick={() => setVenue(v.id)}
            className={`pill border ${venue === v.id ? 'bg-white/10 text-white border-white' : 'border-luna-border text-luna-muted'}`}>{v.name}</button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.length === 0 && <div className="card p-8 text-center text-luna-muted">Nothing on right now — check back soon!</div>}
        {filtered.map(p => (
          <div key={p.id} className="card overflow-hidden">
            {p.image_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={p.image_url} alt="" className="w-full max-h-64 object-cover" />
            )}
            <div className="p-5">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="pill bg-luna-purple/20 text-white text-[11px]">{p.venue_name}</span>
                <span className="text-[11px] text-luna-muted">{fmtDateTime(p.created_at)}</span>
              </div>
              <h3 className="font-bold text-lg">{p.title}</h3>
              {p.body && <p className="text-sm text-luna-muted mt-1 whitespace-pre-wrap">{p.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
