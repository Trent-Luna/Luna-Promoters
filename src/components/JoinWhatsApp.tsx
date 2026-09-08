/**
 * "Join the WhatsApp" — the one way into the promoter group.
 *
 * Renders nothing when no link is configured, so every caller can drop it in
 * unconditionally and the group simply doesn't exist in the UI until Trent sets
 * one up. WhatsApp green rather than Luna gold on purpose: promoters should
 * recognise it as WhatsApp at a glance, not read it as another Luna button.
 */
export function JoinWhatsApp({
  href,
  label = 'Join the WhatsApp',
  hint,
  className = '',
}: {
  href: string | null
  label?: string
  hint?: string
  className?: string
}) {
  if (!href) return null
  return (
    <div className={className}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-[#0a0a0f] bg-[#25D366] hover:bg-[#1eb855] transition"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35z" />
          <path d="M12.04 2.5A9.5 9.5 0 0 0 3.9 16.86L2.5 21.5l4.76-1.37A9.5 9.5 0 1 0 12.04 2.5zm0 1.9a7.6 7.6 0 1 1-3.87 14.13l-.28-.16-2.82.81.83-2.75-.18-.29A7.6 7.6 0 0 1 12.04 4.4z" />
        </svg>
        {label}
      </a>
      {hint && <p className="text-xs text-luna-muted mt-2">{hint}</p>}
    </div>
  )
}
