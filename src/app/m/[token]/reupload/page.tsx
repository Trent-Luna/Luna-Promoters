import { Logo } from '@/components/Logo'
import Link from 'next/link'
import { ReuploadForm } from './reupload-form'

export const dynamic = 'force-dynamic'

export default async function Reupload({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <main className="min-h-screen">
      <header className="max-w-lg mx-auto px-5 pt-8 flex items-center justify-between">
        <Logo size={32} />
        <Link href={`/m/${token}`} className="text-sm text-luna-muted hover:text-white">← Back</Link>
      </header>
      <section className="max-w-lg mx-auto px-5 pt-8 pb-4 text-center">
        <h1 className="text-3xl font-extrabold">Upload a clearer university ID</h1>
        <p className="text-luna-muted mt-2">
          No need to re-apply — just upload a new, current photo of your student ID and we’ll re-check it.
        </p>
      </section>
      <section className="max-w-lg mx-auto px-5 pb-16">
        <div className="card p-6 sm:p-8"><ReuploadForm token={token} /></div>
      </section>
    </main>
  )
}
