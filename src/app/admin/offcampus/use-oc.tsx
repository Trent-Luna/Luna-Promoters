'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ocRpc, type OcResult } from './actions'

/** Run an Off Campus admin action, show its message, refresh the page on success. */
export function useOc() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  async function run(fn: string, args: Record<string, unknown>, opts: { refresh?: boolean; quiet?: boolean } = {}): Promise<OcResult> {
    const r = await ocRpc(fn, args)
    if (!opts.quiet || !r.ok) setMsg({ ok: r.ok, text: r.message })
    if (r.ok && opts.refresh !== false) start(() => router.refresh())
    return r
  }
  return { run, pending, msg, setMsg }
}

/** Ask for a reason. Returns null when cancelled or left blank. */
export function askReason(question: string): string | null {
  const r = window.prompt(question)
  return r && r.trim() ? r.trim() : null
}

export function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null
  return <p role="status" className={`text-sm ${msg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>
}
