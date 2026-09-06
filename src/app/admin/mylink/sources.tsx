import { createClient } from '@/lib/supabase/server'
import { QRCode } from '@/components/QRCode'
import { CopyButton } from '@/components/CopyButton'
import { Th, Td, EmptyRow } from '@/components/ui'
import { Icon } from '@/components/icons'
import { createSourceLink, deleteSourceLinkForm } from '../actions'

interface SourceRow { key: string; label: string; clicks: number; registered: number; checked_in: number }

/**
 * Where a link's sign-ups come from. Every named source is `?src=<key>` on the
 * same link, so the poster QR, the SMS blast and the Instagram bio each show
 * their own visits → registered → checked in.
 */
export async function SourceLinks({ promoterId, code, link, title, days = 30 }:
  { promoterId: string; code: string; link: string; title: string; days?: number }) {
  const supabase = await createClient()
  const from = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10)
  const [{ data: stats }, { data: links }] = await Promise.all([
    supabase.rpc('get_source_stats', { p_promoter: promoterId, p_from: from }),
    supabase.from('source_links').select('id,key,label').eq('promoter_id', promoterId).order('created_at'),
  ])
  const rows = (stats ?? []) as SourceRow[]
  const idByKey = new Map((links ?? []).map(l => [l.key, l.id]))

  return (
    <div className="card">
      <div className="flex items-end gap-3 px-5 pt-5 pb-3">
        <div>
          <h2 className="font-bold leading-tight">{title}</h2>
          <p className="text-xs text-luna-muted mt-0.5">Last {days} days · each source is <code className="text-luna-subtle">{link.replace(/^https?:\/\//, '')}?src=…</code></p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-white/[0.07]">
              <Th>Source</Th><Th className="text-right">Visits</Th><Th className="text-right">Registered</Th><Th className="text-right">Checked in</Th><Th className="text-right">Show rate</Th><Th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <EmptyRow colSpan={6}>No sources yet — add one below and use it on a poster, story or SMS.</EmptyRow>}
            {rows.map(r => {
              const url = `${link}?src=${r.key}`
              const id = idByKey.get(r.key)
              return (
                <tr key={r.key} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02]">
                  <Td>
                    <div className="font-semibold">{r.label}</div>
                    <div className="text-xs text-luna-muted">?src={r.key}</div>
                  </Td>
                  <Td className="text-right tabular-nums">{r.clicks.toLocaleString('en-AU')}</Td>
                  <Td className="text-right tabular-nums">{r.registered.toLocaleString('en-AU')}</Td>
                  <Td className="text-right tabular-nums text-luna-gold font-semibold">{r.checked_in.toLocaleString('en-AU')}</Td>
                  <Td className="text-right tabular-nums text-luna-muted">{r.registered ? Math.round((r.checked_in / r.registered) * 100) : 0}%</Td>
                  <Td className="text-right">
                    <span className="inline-flex items-center gap-1.5">
                      <CopyButton text={url} />
                      <details className="relative">
                        <summary className="btn-ghost !py-1.5 !px-3 text-xs list-none cursor-pointer [&::-webkit-details-marker]:hidden"><Icon name="qr" size={14} /></summary>
                        <div className="absolute right-0 z-20 mt-2 card p-3 shadow-glow">
                          <QRCode value={url} size={160} />
                          <div className="text-[11px] text-luna-muted mt-2 text-center">{r.key}</div>
                        </div>
                      </details>
                      {id && (
                        <form action={deleteSourceLinkForm}>
                          <input type="hidden" name="id" value={id} />
                          <button className="btn-ghost !py-1.5 !px-2 text-xs !text-luna-muted" title="Remove this named source (registrations keep their source)"><Icon name="x" size={14} /></button>
                        </form>
                      )}
                    </span>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <form action={createSourceLink} className="flex flex-wrap items-end gap-3 px-5 py-4 border-t border-white/[0.07]">
        <input type="hidden" name="promoter_id" value={promoterId} />
        <div className="flex-1 min-w-[200px]">
          <label className="label">New source · label</label>
          <input name="label" required className="input !py-2.5" placeholder="e.g. Instagram story · Ju Ju" />
        </div>
        <div className="w-48">
          <label className="label">Key <span className="font-normal">(goes in the URL)</span></label>
          <input name="key" required className="input !py-2.5" placeholder="ig-juju" pattern="[A-Za-z0-9-]{1,40}" title="Letters, numbers and dashes" />
        </div>
        <button className="btn-gold !py-2.5"><Icon name="plus" size={14} /> Add source</button>
      </form>
    </div>
  )
}
