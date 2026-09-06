/**
 * Stroke icons on a 24-unit grid, drawn inline so they recolour with `currentColor`
 * and never fetch. Server-safe (no hooks). Keep the set small and one style.
 */
const PATHS: Record<string, string> = {
  home: 'M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  users: 'M12.5 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zM2.5 20a6.5 6.5 0 0 1 13 0M19.5 9a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM15.5 14.5a5 5 0 0 1 6 5',
  grad: 'M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5',
  list: 'M8 6h13M8 12h13M8 18h13M4 6h.01M4 12h.01M4 18h.01',
  cal: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  ban: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM5.6 5.6l12.8 12.8',
  building: 'M5 3h14a1 1 0 0 1 1 1v17H4V4a1 1 0 0 1 1-1zM9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3',
  badge: 'M17 9a5 5 0 1 1-10 0 5 5 0 0 1 10 0zM8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5',
  door: 'M4 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M2 21h20M13 12h.01',
  trophy: 'M7 4h10v4a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6',
  download: 'M12 3v12M6 9l6 6 6-6M4 21h16',
  sliders: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M18 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM12 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM20 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  search: 'M17.5 11a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0zM20 20l-4.3-4.3',
  qr: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3M21 14v3h-3M14 21h3M17 17v4',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  chev: 'M9 6l6 6-6 6',
  chevd: 'M6 9l6 6 6-6',
  back: 'M15 6l-6 6 6 6',
  logout: 'M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M19 12H9',
  share: 'M20.5 5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM8.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM20.5 19a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM8.2 10.8l7.6-4.6M8.2 13.2l7.6 4.6',
  gift: 'M3 9h18v12H3zM3 13h18M12 9v12M12 9c-2-4-7-3-6-1s5 1 6 1zM12 9c2-4 7-3 6-1s-5 1-6 1z',
  camera: 'M4 8h3l2-3h6l2 3h3v12H4zM15.5 13a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z',
  warn: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2',
  menu: 'M4 7h16M4 12h16M4 17h16',
  mail: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 7l9 6 9-6',
  pen: 'M4 20h4l11-11-4-4L4 16zM13 7l4 4',
  swap: 'M4 8h13l-3-3M20 16H7l3 3',
  wifi: 'M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01',
  offline: 'M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01M3 3l18 18',
  phone: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM11 18h2',
  plus: 'M12 5v14M5 12h14',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
}

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 16, className = '' }: { name: IconName | string; size?: number; className?: string }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      className={`shrink-0 ${className}`}
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
