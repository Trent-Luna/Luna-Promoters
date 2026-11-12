import { Archivo } from 'next/font/google'

// Sonda's type: Archivo with its width axis, so headings run expanded like the
// Sonda wordmark (font-stretch 125%) and body text stays at normal width.
export const nightFont = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--font-night',
})
