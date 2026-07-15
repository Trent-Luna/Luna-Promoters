import { ApplyLayout } from '../apply-layout'

export const dynamic = 'force-dynamic'

// Luna Group staff sign-up — reuses the existing promoter application with category = 'staff'.
export default async function MembershipsStaff({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref } = await searchParams
  return <ApplyLayout category="staff" refCode={ref ?? ''} />
}
