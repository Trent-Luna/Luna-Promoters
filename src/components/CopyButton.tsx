'use client'
import { useState } from 'react'
import { Icon } from './icons'

export function CopyButton({ text, label = 'Copy', className = '' }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800) } catch {}
  }
  return (
    <button type="button" onClick={copy} className={`btn-ghost !py-1.5 !px-3 text-xs ${className}`}>
      <Icon name={done ? 'check' : 'link'} size={14} /> {done ? 'Copied' : label}
    </button>
  )
}
