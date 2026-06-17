import type { Metadata } from 'next'
import './globals.css'
import Footer from './components/Footer'
import { ThemeProvider } from './components/ThemeProvider'
import { AuthProvider } from './components/AuthProvider'
import TopBar from './components/TopBar'

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
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <TopBar />
            <div className="layout-wrapper">
              <main>{children}</main>
              <Footer />
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

