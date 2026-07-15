import { createClient } from '@/lib/supabase/server'
import { Logo } from '@/components/Logo'
import { QRCode } from '@/components/QRCode'
import { fmtDate } from '@/lib/format'
import { notFound } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const STATUS_COPY: Record<string, { pill: string; cls: string; title: string; body: string }> = {
  pending_verification: {
    pill: 'Verifying', cls: 'bg-amber-500/15 text-amber-400',
    title: 'Your university membership is being verified',
    body: 'Hang tight — we’re checking your university ID now. This page will update automatically once it’s confirmed, and we’ll email you too.',
  },
  manual_review: {
    pill: 'Under review', cls: 'bg-amber-500/15 text-amber-400',
    title: 'Your application has been sent for review',
    body: 'We couldn’t automatically verify all of your details, so a member of our team is reviewing your application. No action is needed — we’ll be in touch shortly.',
  },
  rejected: {
    pill: 'Not approved', cls: 'bg-red-500/15 text-red-400',
    title: 'We could not approve your application',
    body: 'Unfortunately we weren’t able to approve your Luna University Membership. If your circumstances change or you have a current university ID, you’re welcome to try again.',
  },
  suspended: {
    pill: 'Suspended', cls: 'bg-zinc-500/20 text-zinc-300',
    title: 'Your membership is currently suspended',
    body: 'Please contact the Luna Group team for more information.',
  },
}

export default async function MembershipPass({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc('get_membership_pass', { p_token: token })
  if (!data?.ok) notFound()

  if (data.status !== 'approved') {
    const c = STATUS_COPY[data.status] ?? STATUS_COPY.manual_review
    return (
      <main className="min-h-screen flex items-center justify-center p-5">
        <div className="max-w-md w-full">
          <div className="flex justify-center mb-8"><Logo size={38} /></div>
          <div className="card p-8 text-center">
            <span className={`pill ${c.cls} mb-3`}>{c.pill}</span>
            <h1 className="text-2xl font-bold mb-2">{c.title}</h1>
            <p className="text-luna-muted">{c.body}</p>
            {data.status === 'rejected' && (
              <Link href={`/m/${token}/reupload`} className="btn-ghost w-full mt-6">Upload a new university ID</Link>
            )}
          </div>
        </div>
      </main>
    )
  }

  // Approved → digital membership pass
  return (
    <main className="min-h-screen">
      <header className="max-w-md mx-auto px-5 pt-8"><Logo size={30} /></header>
      <section className="max-w-md mx-auto px-5 pt-6 pb-16">
        <div className="card p-7 text-center">
          <span className="pill bg-emerald-500/15 text-emerald-400 mb-3">Luna University Membership</span>
          <h1 className="text-2xl font-bold">{data.full_name}</h1>
          <p className="text-luna-muted mt-1">{data.membership_type}</p>

          <div className="flex justify-center my-6">
            <QRCode value={`/verify/${token}`} size={240} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-left mt-2">
            <Field label="Status" value="Approved ✓" accent />
            <Field label="Member #" value={data.membership_number || '—'} />
            {data.institution && <Field label="Institution" value={data.institution} span />}
            <Field label="ID expiry" value={data.expiry_date ? fmtDate(data.expiry_date) : '—'} />
            <Field label="Approved" value={data.approved_at ? fmtDate(data.approved_at) : '—'} />
          </div>

          <p className="text-xs text-luna-muted mt-6">
            Show this QR at reception. It’s personal to you and verifies your membership securely.
          </p>
        </div>
        <p className="text-center text-xs text-luna-muted mt-5">
          Membership benefits are subject to venue capacity, dress code, valid 18+ ID and management discretion.
        </p>
      </section>
    </main>
  )
}

function Field({ label, value, accent, span }: { label: string; value: string; accent?: boolean; span?: boolean }) {
  return (
    <div className={`card bg-luna-surface p-3 ${span ? 'col-span-2' : ''}`}>
      <div className="text-[11px] uppercase tracking-wide text-luna-muted">{label}</div>
      <div className={`font-semibold ${accent ? 'text-emerald-400' : 'text-luna-text'}`}>{value}</div>
    </div>
  )
}
