import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  // Funnel the promoter home page to the memberships hub (where visitors choose
  // Promoter / University / DJ / Staff). Only the exact root is redirected —
  // all functional routes (/p, /g, /login, /admin, /reception, etc.) still work,
  // so existing promoter links, guest QR codes and passes are unaffected.
  const host = (request.headers.get('host') || '').split(':')[0]
  if (host.startsWith('promoter.') && request.nextUrl.pathname === '/') {
    const dest = new URL('https://memberships.lunagroup.com.au/')
    dest.search = request.nextUrl.search // preserve ?ref= etc.
    return NextResponse.redirect(dest)
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = path.startsWith('/admin') || path.startsWith('/promoter')
    || path.startsWith('/venue') || path.startsWith('/reception') || path.startsWith('/verify')
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }
  return response
}
