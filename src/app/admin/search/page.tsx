import { getSession, hasRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { ADMIN_NAV } from '@/components/AdminNav'
import { StatusPill, TierBadge, Th, Td, CellStack, EmptyRow } from '@/components/ui'
import { fmtDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

/**
 * One search box for the whole back end. Promoters and guests are matched on
 * name, email, phone, code and Instagram; each hit links to the place you
 * would act on it.
 */
export default async function AdminSearch({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  const { q = '' } = await searchParams
  const term = q.trim()
  const supabase = await createClient()

  let promoters: any[] = []
  let guests: any[] = []
  if (term.length >= 2) {
    const like = `%${term.replace(/[%_]/g, '')}%`
    const digits = term.replace(/\D/g, '')
    const phoneLike = digits.length >= 4 ? `%${digits}%` : null
    const pOr = [
      `full_name.ilike.${like}`, `email.ilike.${like}`, `promoter_code.ilike.${like}`, `instagram.ilike.${like}`,
      ...(phoneLike ? [`mobile.ilike.${phoneLike}`] : []),
    ].join(',')
    const gOr = [
      `first_name.ilike.${like}`, `last_name.ilike.${like}`, `email.ilike.${like}`, `instagram.ilike.${like}`,
      ...(phoneLike ? [`mobile.ilike.${phoneLike}`] : []),
    ].join(',')
    const [{ data: p }, { data: g }] = await Promise.all([
      supabase.from('promoters').select('id,full_name,email,mobile,status,promoter_code,current_tier,category,is_staff').or(pOr).order('full_name').limit(25),
      supabase.from('guests').select('id,first_name,last_name,email,mobile,instagram,guest_registrations(status,created_at,venues(name),events(event_date))').or(gOr).order('created_at', { ascending: false }).limit(25),
    ])
    promoters = p ?? []
    guests = g ?? []
  }

  return (
    <AppShell nav={ADMIN_NAV} current="/admin/search" eyebrow="Search" title={term ? `Results for “${term}”` : 'Search'}
      subtitle={term.length < 2 ? 'Type at least two characters — a name, phone, email, code or Instagram handle.' : `${promoters.length} promoter${promoters.length === 1 ? '' : 's'} · ${guests.length} guest${guests.length === 1 ? '' : 's'}`}>
      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <div className="card overflow-x-auto">
          <div className="px-4 pt-4 pb-2 font-bold">Promoters</div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.07]"><Th>Promoter</Th><Th>Status</Th><Th>Tier</Th><Th /></tr></thead>
            <tbody>
              {promoters.length === 0 && <EmptyRow colSpan={4}>{term.length < 2 ? 'Waiting for a search.' : 'No promoters match.'}</EmptyRow>}
              {promoters.map(p => (
                <tr key={p.id} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02]">
                  <Td><CellStack primary={p.full_name} secondary={`${p.promoter_code ? `/p/${p.promoter_code} · ` : ''}${p.mobile} · ${p.email}`} /></Td>
                  <Td><StatusPill status={p.status} /></Td>
                  <Td>{p.status === 'approved' ? <TierBadge tier={p.current_tier} /> : <span className="text-luna-muted">—</span>}</Td>
                  <Td className="text-right"><Link className="text-xs text-luna-gold" href={`/admin/promoters?q=${encodeURIComponent(p.full_name)}`}>Open</Link></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card overflow-x-auto">
          <div className="px-4 pt-4 pb-2 font-bold">Guests</div>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.07]"><Th>Guest</Th><Th>Last registration</Th><Th /></tr></thead>
            <tbody>
              {guests.length === 0 && <EmptyRow colSpan={3}>{term.length < 2 ? 'Waiting for a search.' : 'No guests match.'}</EmptyRow>}
              {guests.map(g => {
                const regs = (g.guest_registrations ?? []) as any[]
                const last = [...regs].sort((a, b) => (b.events?.event_date ?? '').localeCompare(a.events?.event_date ?? ''))[0]
                return (
                  <tr key={g.id} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.02]">
                    <Td><CellStack primary={`${g.first_name} ${g.last_name}`} secondary={`${g.mobile}${g.email ? ` · ${g.email}` : ''}${g.instagram ? ` · ${g.instagram}` : ''}`} /></Td>
                    <Td>
                      {last ? (
                        <span className="flex items-center gap-2 text-luna-muted">
                          {last.venues?.name} · {fmtDate(last.events?.event_date)} <StatusPill status={last.status} />
                        </span>
                      ) : <span className="text-luna-muted">—</span>}
                    </Td>
                    <Td className="text-right"><Link className="text-xs text-luna-gold" href={`/admin/guests?q=${encodeURIComponent(g.mobile)}`}>Open</Link></Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
