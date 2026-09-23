import { ApplyLayout } from '../apply-layout'

export const dynamic = 'force-dynamic'

/**
 * Close Friends sign-up — the same application everyone else fills in, with
 * category preset to 'close_friend'.
 *
 * Trent, 23 Sep 2026: "in our promoters crm, i want to bulid out another group
 * called close friends where they can sign up as a 'close friend' promoter."
 *
 * A fourth category rather than a flag on an existing promoter, because Close
 * Friends is measured differently — week by week on check-ins, no Bronze/Silver/
 * Gold — and mixing the two would have put a Wednesday scheme into the monthly
 * tier maths.
 */
export default async function MembershipsCloseFriends({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>
}) {
  const { ref } = await searchParams
  return <ApplyLayout category="close_friend" refCode={ref ?? ''} />
}
