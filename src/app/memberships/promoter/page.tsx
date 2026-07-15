import { ApplyLayout } from '../apply-layout'

export const dynamic = 'force-dynamic'

// The Promoter option on the memberships landing opens the EXISTING promoter
// application experience (same form + RPC, unchanged behaviour).
export default async function MembershipsPromoter({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams
  return <ApplyLayout category="promoter" refCode={ref ?? ''} />
}
