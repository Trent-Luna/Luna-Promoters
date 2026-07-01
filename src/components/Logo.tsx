export function Logo({ size = 28 }: { size?: number }) {
  // Official Luna Group logo. Aspect ~3.8:1; height scales with `size`.
  const h = Math.round(size * 1.15)
  return (
    <div className="flex items-center select-none">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/luna-group-white.png" alt="Luna Group" style={{ height: h }} className="w-auto" />
    </div>
  )
}
