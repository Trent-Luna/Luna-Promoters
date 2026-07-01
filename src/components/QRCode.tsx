'use client'
import { useEffect, useState } from 'react'
import QR from 'qrcode'

export function QRCode({ value, size = 220 }: { value: string; size?: number }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    // Ensure the QR always encodes an absolute URL, even if NEXT_PUBLIC_SITE_URL
    // wasn't set at build time (fall back to the current origin).
    let target = value
    if (typeof window !== 'undefined' && value.startsWith('/')) {
      target = window.location.origin + value
    }
    QR.toDataURL(target, {
      width: size, margin: 1,
      color: { dark: '#0a0a0f', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).then(setUrl).catch(() => {})
  }, [value, size])
  if (!url) return <div style={{ width: size, height: size }} className="bg-white/5 rounded-xl animate-pulse" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="QR code" width={size} height={size} className="rounded-xl bg-white p-2" />
}
