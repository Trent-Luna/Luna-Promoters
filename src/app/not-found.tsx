import Link from 'next/link'
import { Logo } from '@/components/Logo'
export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center p-5">
      <div className="text-center">
        <div className="flex justify-center mb-6"><Logo size={36} /></div>
        <h1 className="text-2xl font-bold">Not found</h1>
        <p className="text-luna-muted mt-2">This link isn't active. It may have expired or the promoter isn't approved yet.</p>
        <Link href="/" className="btn-gold mt-6 inline-flex">Back to home</Link>
      </div>
    </main>
  )
}
