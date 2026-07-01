import { Logo } from '@/components/Logo'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function SignupSuccess({ searchParams }: { searchParams: Promise<{ approved?: string }> }) {
  const { approved } = await searchParams
  const isApproved = approved === '1'

  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-8"><Logo size={38} /></div>
        <div className="card p-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/10 flex items-center justify-center mb-5">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {isApproved ? (
            <>
              <h1 className="text-2xl font-bold mb-2">You&apos;re approved! 🎉</h1>
              <p className="text-luna-muted">
                Welcome to the Luna Group promoter team. Create your login with the same email
                you just applied with, and you&apos;ll get your unique promoter link and dashboard.
              </p>
              <Link href="/login" className="btn-gold w-full mt-6">Create my login</Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold mb-2">Application received</h1>
              <p className="text-luna-muted">
                Thanks for applying to become a Luna Group promoter. Your application is
                <span className="text-white font-medium"> under review</span>. Our team will be in touch,
                and once approved you&apos;ll be able to log in and get your unique promoter link.
              </p>
              <Link href="/" className="btn-ghost w-full mt-6">Back to home</Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
