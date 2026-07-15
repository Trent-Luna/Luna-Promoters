import { NextResponse } from 'next/server'
import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Public PNG of a membership pass QR (mirrors the guest /api/qr/[token]).
// The QR encodes the reception verification URL, not any database id.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const base = (process.env.NEXT_PUBLIC_MEMBERSHIPS_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')
  const value = `${base}/verify/${token}`
  const png = await QRCode.toBuffer(value, {
    width: 600, margin: 2, color: { dark: '#000000', light: '#ffffff' },
  })
  return new NextResponse(new Uint8Array(png), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' },
  })
}
