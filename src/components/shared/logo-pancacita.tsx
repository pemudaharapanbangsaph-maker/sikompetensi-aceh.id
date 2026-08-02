'use client'

import { useUIStore } from '@/store/auth-store'

interface LogoPancaCitaProps {
  className?: string
  size?: number
}

/**
 * Logo PEMDA Pemerintah Aceh
 * Membaca dari /pemda-logo.png dengan cache-busting via logoVersion dari UIStore
 */
export function LogoPancaCita({ className, size = 56 }: LogoPancaCitaProps) {
  const logoVersion = useUIStore((s) => s.logoVersion)
  const src = `/pemda-logo.png${logoVersion ? `?v=${logoVersion}` : ''}`

  return (
    <img
      src={src}
      alt="Logo Pemerintah Aceh"
      width={size}
      height={Math.round(size / 0.672)}
      className={`object-contain ${className || ''}`}
    />
  )
}
