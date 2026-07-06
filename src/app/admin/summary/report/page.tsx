import { getSession, hasRole } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ReportView } from './view'

export const dynamic = 'force-dynamic'

export default async function WeeklyReport(
  { searchParams }: { searchParams: Promise<{ from?: string; to?: string; label?: string }> }
) {
  const s = await getSession()
  if (!s) redirect('/login')
  if (!hasRole(s, 'admin')) redirect('/dashboard')
  const { from, to, label } = await searchParams
  if (!from || !to) redirect('/admin/summary')
  return <ReportView from={from} to={to} label={label ?? ''} />
}
