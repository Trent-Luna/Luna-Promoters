'use client'
import { useEffect, useRef } from 'react'
import { Icon } from './icons'

/**
 * Global admin search in the top bar. A plain GET form to /admin/search, so it
 * works before hydration; ⌘K / Ctrl+K focuses it once JS is up.
 */
export function SearchBox() {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); ref.current?.focus(); ref.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <form action="/admin/search" method="get" className="relative">
      <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-luna-muted pointer-events-none" />
      <input
        ref={ref} name="q" type="search" autoComplete="off"
        placeholder="Search promoters, guests, phones"
        className="w-[300px] bg-luna-surface border border-white/[0.07] rounded-[10px] pl-9 pr-12 py-1.5 text-[13px] text-luna-text placeholder:text-luna-muted focus:outline-none focus:border-luna-gold/60 transition"
      />
      <kbd className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-luna-muted bg-white/[0.07] rounded px-1.5 py-0.5 pointer-events-none">⌘K</kbd>
    </form>
  )
}
