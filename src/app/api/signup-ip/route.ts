import { NextResponse } from 'next/server'
export async function GET(request: Request) {
  const h = request.headers
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim()
    || h.get('x-real-ip') || null
  return NextResponse.json({ ip })
}
