import './globals.css'
import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: 'Luna Group',
  description: 'Luna Group promoter, guestlist & door check-in system',
  appleWebApp: { capable: true, title: 'Luna Group', statusBarStyle: 'black-translucent' },
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
