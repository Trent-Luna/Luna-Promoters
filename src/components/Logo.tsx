export function Logo({ size = 28 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="18" stroke="#d4af37" strokeWidth="2" />
        <path d="M26 12a10 10 0 1 0 2 14 8 8 0 1 1-2-14Z" fill="#d4af37" />
      </svg>
      <div className="leading-none">
        <div className="font-extrabold tracking-tight text-luna-text">LUNA GROUP</div>
        <div className="text-[10px] tracking-[0.28em] text-luna-gold -mt-0.5">PROMOTERS</div>
      </div>
    </div>
  )
}
