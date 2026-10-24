import { OccasionPage, occasionMetadata } from '@/app/occasion-page'

export const dynamic = 'force-dynamic'
export const metadata = occasionMetadata('bucks')

/** The bucks landing page for Meta ads (24 Oct 2026). See lib/occasion.ts. */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ src?: string; fbclid?: string; utm_source?: string }>
}) {
  return <OccasionPage occasion="bucks" searchParams={await searchParams} />
}
