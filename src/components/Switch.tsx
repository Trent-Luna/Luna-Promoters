'use client'

/** Atlas-style toggle: gold when on, 34×20, black knob. */
export function Switch({ on, onChange, disabled = false, label }:
  { on: boolean; onChange: (next: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-[34px] h-5 rounded-full transition shrink-0 disabled:opacity-50 ${on ? 'bg-luna-gold' : 'bg-white/[0.12]'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${on ? 'left-[16px] bg-black' : 'left-0.5 bg-luna-muted'}`} />
    </button>
  )
}
