/**
 * The Off Campus crest, drawn inline so it uses the page's own fonts.
 * `mono` is the monogram (OC, SS for Social Study, NC for Night Class).
 */
function star(cx: number, cy: number, R = 10, r = 4.2) {
  const pts: string[] = []
  for (let k = 0; k < 10; k++) {
    const a = ((-90 + k * 36) * Math.PI) / 180
    const rad = k % 2 === 0 ? R : r
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

export function Crest({ size = 96, mono = 'OC', band = 'THURSDAYS', ring = '#A78BFA', inner = '#7DD3FC',
  ink = '#F0EDF8', bandFill = '#A78BFA', bandInk = '#0B0812', fill = '#0B0812', label = 'Off Campus crest' }: {
  size?: number; mono?: string; band?: string; ring?: string; inner?: string; ink?: string
  bandFill?: string; bandInk?: string; fill?: string; label?: string
}) {
  return (
    <svg viewBox="0 0 200 240" width={size} height={Math.round(size * 1.2)} role="img" aria-label={label}>
      <path d="M100 6 L190 32 V118 C190 178 150 214 100 234 C50 214 10 178 10 118 V32 Z" fill={fill} stroke={ring} strokeWidth="7" />
      <path d="M100 22 L176 44 V118 C176 168 142 199 100 217 C58 199 24 168 24 118 V44 Z" fill="none" stroke={inner} strokeWidth="2" />
      <polygon points={star(70, 66)} fill={inner} />
      <polygon points={star(100, 58, 12, 5)} fill={inner} />
      <polygon points={star(130, 66)} fill={inner} />
      <text x="100" y="146" textAnchor="middle" fontFamily="'OC Graduate', Rockwell, Georgia, serif" fontSize="78" fill={ink}>{mono}</text>
      <rect x="22" y="164" width="156" height="30" rx="4" fill={bandFill} />
      <text x="100" y="185" textAnchor="middle" fontFamily="'OC Josefin', Arial, sans-serif" fontWeight="700" fontSize="15" letterSpacing="2" fill={bandInk}>{band}</text>
    </svg>
  )
}

export function Arrow() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
