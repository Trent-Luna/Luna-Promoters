'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SignOut() {
  const router = useRouter()
  async function out() {
    await createClient().auth.signOut()
    router.push('/login'); router.refresh()
  }
  return (
    <button onClick={out} className="text-sm text-luna-muted hover:text-luna-gold px-2 py-1">
      Sign out
    </button>
  )
}
