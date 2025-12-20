'use client'

import Image from 'next/image'
import { useTheme } from './ThemeProvider'
import { useEffect, useState } from 'react'

export default function Logo() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Use light logo by default until mounted to avoid hydration mismatch
  const logoSrc = mounted && theme === 'dark' ? '/fst-logo-dark.png' : '/fst-logo.png'

  return (
    <Image
      src={logoSrc}
      alt="FST Frisbee Statistics Tracker"
      width={300}
      height={150}
      style={{ maxWidth: '100%', height: 'auto', cursor: 'pointer' }}
      priority
    />
  )
}


