'use client'
import { useState } from 'react'

const CAPTION = (link: string) =>
  `On the guestlist tonight? Register free through my link and I'll see you at the door: ${link}`

export function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState<'' | 'link' | 'caption'>('')
  const enc = encodeURIComponent
  const caption = CAPTION(link)

  async function copy(what: 'link' | 'caption') {
    await navigator.clipboard.writeText(what === 'link' ? link : caption)
    setCopied(what); setTimeout(() => setCopied(''), 2000)
  }

  async function nativeShare() {
    if (navigator.share) {
      try { await navigator.share({ title: 'Join my Luna Group guestlist', text: caption, url: link }) } catch {}
    } else { await copy('link') }
  }

  // Instagram/TikTok have no prefilled web-share URL - copy the caption+link, then open the app.
  async function toInstagram() { await copy('caption'); window.open('https://instagram.com', '_blank') }
  async function toTikTok() { await copy('caption'); window.open('https://www.tiktok.com', '_blank') }

  const targets: { label: string; href: string; bg: string }[] = [
    { label: 'WhatsApp',  href: `https://wa.me/?text=${enc(caption)}`, bg: '#25D366' },
    { label: 'Messenger', href: `https://www.facebook.com/dialog/send?link=${enc(link)}&app_id=0&redirect_uri=${enc(link)}`, bg: '#0084FF' },
    { label: 'Facebook',  href: `https://www.facebook.com/sharer/sharer.php?u=${enc(link)}`, bg: '#1877F2' },
    { label: 'X',         href: `https://twitter.com/intent/tweet?text=${enc(caption)}`, bg: '#111827' },
    { label: 'SMS',       href: `sms:?&body=${enc(caption)}`, bg: '#34C759' },
    { label: 'Email',     href: `mailto:?subject=${enc('Join my Luna Group guestlist')}&body=${enc(caption)}`, bg: '#6b7280' },
  ]

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3">
        <code className="flex-1 bg-luna-surface border border-luna-border rounded-xl px-4 py-3 text-luna-gold text-sm truncate">{link}</code>
        <div className="flex gap-2">
          <button onClick={() => copy('link')} className="btn-gold">{copied === 'link' ? 'Copied' : 'Copy'}</button>
          <button onClick={nativeShare} className="btn-ghost">Share</button>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs text-luna-muted mb-2">Share to your socials</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={toInstagram} className="pill text-white font-semibold px-3 py-2"
            style={{ background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }}>Instagram</button>
          <button onClick={toTikTok} className="pill text-white font-semibold px-3 py-2" style={{ background: '#111' }}>TikTok</button>
          {targets.map(t => (
            <a key={t.label} href={t.href} target="_blank" rel="noopener noreferrer"
              className="pill text-white font-semibold px-3 py-2" style={{ background: t.bg }}>{t.label}</a>
          ))}
          <button onClick={() => copy('caption')} className="pill bg-luna-surface border border-luna-border text-luna-text px-3 py-2">
            {copied === 'caption' ? 'Caption copied' : 'Copy caption + link'}
          </button>
        </div>
        <p className="text-[11px] text-luna-muted mt-2">
          Instagram &amp; TikTok don&apos;t allow pre-filled links - we copy your caption &amp; link so you can paste it into your story or bio.
        </p>
      </div>
    </div>
  )
}
