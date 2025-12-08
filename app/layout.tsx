import type { Metadata } from 'next'
import './globals.css'

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
      <body>{children}</body>
    </html>
  )
}
