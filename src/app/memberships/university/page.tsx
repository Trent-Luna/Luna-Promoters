import { Logo } from '@/components/Logo'
import Link from 'next/link'
import { UniversitySignupForm } from './signup-form'

export const dynamic = 'force-dynamic'

export default function UniversitySignupPage() {
  return (
    <main className="min-h-screen">
      <header className="max-w-lg mx-auto px-5 pt-8 flex items-center justify-between">
        <Logo size={32} />
        <Link href="/memberships" className="text-sm text-luna-muted hover:text-white">← Memberships</Link>
      </header>

      <section className="max-w-lg mx-auto px-5 pt-8 pb-4 text-center">
        <span className="pill bg-white/10 text-white mb-3">University Member</span>
        <h1 className="text-3xl font-extrabold">Luna University Membership</h1>
        <p className="text-luna-muted mt-2">
          Verified university students get a digital membership pass. You must be 18 or older
          and have a valid, current student ID.
        </p>
      </section>

      <section className="max-w-lg mx-auto px-5 pb-16">
        <div className="card p-6 sm:p-8">
          <UniversitySignupForm />
        </div>
      </section>
    </main>
  )
}
