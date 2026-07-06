import { NextResponse } from 'next/server'
import QRCode from 'qrcode'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Public PNG of a guest's QR so email clients can render it.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const site = process.env.NEXT_PUBLIC_SITE_URL || ''
  const value = `${site}/g/${token}`
  const png = await QRCode.toBuffer(value, {
    width: 600, margin: 2, color: { dark: '#000000', light: '#ffffff' },
  })
  return new NextResponse(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=86400, immutable',
    },
  })
}
