'use client'
import { useState } from 'react'
import QR from 'qrcode'

interface Props {
  qrValue: string
  title?: string          // big line, e.g. guest name
  lines?: string[]        // small lines, e.g. venue / date
  fileName?: string
  label?: string
}

// Builds a branded PNG (Luna Group header + QR + details) and lets the
// user save it to their photos (share sheet on iOS) or download it.
export function SaveQR({ qrValue, title, lines = [], fileName = 'luna-guestlist.png', label = 'Save QR to photos' }: Props) {
  const [busy, setBusy] = useState(false)

  async function build(): Promise<Blob | null> {
    const W = 640, H = 860
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // background
    ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, W, H)

    // header wordmark
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.font = '700 46px Inter, Arial, sans-serif'
    ctx.fillText('LUNA GROUP', W / 2, 90)
    ctx.fillStyle = '#9a9aa8'
    ctx.font = '600 18px Inter, Arial, sans-serif'
    ctx.fillText('G U E S T L I S T   P A S S', W / 2, 122)

    // QR on a white rounded card
    const qrDataUrl = await QR.toDataURL(qrValue, { width: 420, margin: 1, errorCorrectionLevel: 'M' })
    const img = new Image()
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(); img.src = qrDataUrl })
    const size = 400, x = (W - size) / 2, y = 170
    ctx.fillStyle = '#ffffff'
    const r = 28
    ctx.beginPath()
    ctx.moveTo(x - 20 + r, y - 20)
    ctx.arcTo(x + size + 20, y - 20, x + size + 20, y + size + 20, r)
    ctx.arcTo(x + size + 20, y + size + 20, x - 20, y + size + 20, r)
    ctx.arcTo(x - 20, y + size + 20, x - 20, y - 20, r)
    ctx.arcTo(x - 20, y - 20, x + size + 20, y - 20, r)
    ctx.closePath(); ctx.fill()
    ctx.drawImage(img, x, y, size, size)

    // details
    let ty = y + size + 80
    if (title) {
      ctx.fillStyle = '#ffffff'; ctx.font = '700 40px Inter, Arial, sans-serif'
      ctx.fillText(title, W / 2, ty); ty += 44
    }
    ctx.fillStyle = '#c9c9d2'; ctx.font = '400 26px Inter, Arial, sans-serif'
    for (const l of lines) { ctx.fillText(l, W / 2, ty); ty += 36 }

    ctx.fillStyle = '#8a8a92'; ctx.font = '400 20px Inter, Arial, sans-serif'
    ctx.fillText('Show this at the door', W / 2, H - 40)

    return await new Promise<Blob | null>(res => canvas.toBlob(b => res(b), 'image/png'))
  }

  async function save() {
    setBusy(true)
    try {
      const blob = await build()
      if (!blob) return
      const file = new File([blob], fileName, { type: 'image/png' })
      const nav: any = navigator
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try { await nav.share({ files: [file], title: 'Luna Group Guestlist' }); return } catch { /* fall through */ }
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    } finally { setBusy(false) }
  }

  return (
    <button onClick={save} disabled={busy} className="btn-gold w-full">
      {busy ? 'Preparing…' : label}
    </button>
  )
}
