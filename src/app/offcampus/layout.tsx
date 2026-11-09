import type { Metadata, Viewport } from 'next'
import './offcampus.css'

export const metadata: Metadata = {
  title: 'Off Campus Thursdays at Su Casa',
  description: 'A night for uni clubs and societies at Su Casa Brisbane. Register your club, show your pass, climb the board.',
  appleWebApp: { capable: true, title: 'Off Campus', statusBarStyle: 'black-translucent' },
}
export const viewport: Viewport = {
  themeColor: '#0B0812', width: 'device-width', initialScale: 1,
}

export default function OffCampusLayout({ children }: { children: React.ReactNode }) {
  return <div className="oc">{children}</div>
}
