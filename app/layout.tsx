import type { Metadata } from 'next'
import './globals.css'
import Footer from './components/Footer'

export const metadata: Metadata = {
  title: 'FST Frisbee Statistics Tracker',
  description: 'Track frisbee player statistics in real time',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <div className="layout-wrapper">
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  )
}

