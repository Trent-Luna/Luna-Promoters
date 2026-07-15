import { ApplyLayout } from '../apply-layout'

export const dynamic = 'force-dynamic'

// DJ sign-up — reuses the existing promoter application with category = 'dj'.
export default async function MembershipsDJ({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams
  return <ApplyLayout category="dj" refCode={ref ?? ''} />
}
