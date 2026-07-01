import './globals.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Luna Promoters',
  description: 'Luna Group promoter, guestlist & door check-in system',
}
export const viewport: Viewport = {
  themeColor: '#0a0a0f', width: 'device-width', initialScale: 1, maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
