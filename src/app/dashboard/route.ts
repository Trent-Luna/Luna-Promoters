import { NextResponse } from 'next/server'
import { getSession, homeForRoles } from '@/lib/auth'

export async function GET(request: Request) {
  const s = await getSession()
  const { origin } = new URL(request.url)
  if (!s) return NextResponse.redirect(`${origin}/login`)
  return NextResponse.redirect(`${origin}${homeForRoles(s.roles)}`)
}
