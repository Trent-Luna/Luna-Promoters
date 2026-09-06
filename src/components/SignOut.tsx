'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Icon } from './icons'

export function SignOut({ icon = false }: { icon?: boolean }) {
  const router = useRouter()
  async function out() {
    await createClient().auth.signOut()
    router.push('/login'); router.refresh()
  }
  if (icon) {
    return (
      <button onClick={out} title="Sign out" aria-label="Sign out"
        className="w-8 h-8 rounded-lg flex items-center justify-center text-luna-muted hover:text-luna-gold hover:bg-white/[0.04] transition">
        <Icon name="logout" size={16} />
      </button>
    )
  }
  return (
    <button onClick={out} className="text-sm text-luna-muted hover:text-luna-gold px-2 py-1">
      Sign out
    </button>
  )
}
