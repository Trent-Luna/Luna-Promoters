import { Logo } from '@/components/Logo'
import Link from 'next/link'

export default function SignupSuccess() {
  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-8"><Logo size={38} /></div>
        <div className="card p-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-luna-gold/15 flex items-center justify-center mb-5">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#d4af37" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-2">Application received</h1>
          <p className="text-luna-muted">
            Thanks for applying to become a Luna Group promoter. Your application is
            <span className="text-luna-gold font-medium"> under review</span>. Our team will be in touch,
            and once approved you'll be able to log in and get your unique promoter link.
          </p>
          <Link href="/" className="btn-ghost w-full mt-6">Back to home</Link>
        </div>
      </div>
    </main>
  )
}
