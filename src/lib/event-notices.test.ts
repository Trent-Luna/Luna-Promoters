import { describe, expect, it } from 'vitest'
import { noticesFromRows } from './event-notices'

describe('event notices', () => {
  it('keeps the earliest cut-off and that row\'s note', () => {
    const notes = noticesFromRows([
      { venue_id: 'e', event_date: '2026-11-06', cutoff_at: null, description: 'later note', created_at: '2026-01-02T00:00:00Z' },
      { venue_id: 'e', event_date: '2026-11-06', cutoff_at: '2026-11-06T12:30:00Z', description: 'Strict 10:30pm guest list cut-off. No pass-outs.', created_at: '2026-01-01T00:00:00Z' },
      { venue_id: 'e', event_date: '2026-11-07', cutoff_at: null, description: '   ', created_at: '2026-01-01T00:00:00Z' },
    ])
    expect(notes).toEqual([
      {
        venueId: 'e',
        date: '2026-11-06',
        cutoffAt: '2026-11-06T12:30:00Z',
        description: 'Strict 10:30pm guest list cut-off. No pass-outs.',
      },
    ])
  })

  it('uses a note when the night has no cut-off of its own', () => {
    expect(noticesFromRows([
      { venue_id: 'p', event_date: '2026-11-08', cutoff_at: null, description: 'Doors at 9.', created_at: '2026-01-01T00:00:00Z' },
    ])).toEqual([
      { venueId: 'p', date: '2026-11-08', cutoffAt: null, description: 'Doors at 9.' },
    ])
  })
})
