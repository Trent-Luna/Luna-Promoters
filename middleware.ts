import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || ''
  // guestlist.lunagroup.com.au -> public guestlist page
  if (host.split(':')[0].startsWith('guestlist.') && request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/guestlist', request.url))
  }
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
