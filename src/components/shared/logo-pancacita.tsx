'use client'

import { useUIStore } from '@/store/auth-store'

interface LogoPancaCitaProps {
  className?: string
  size?: number
}

/**
 * Logo PEMDA Pemerintah Aceh
 * Menggunakan API route /api/settings/logo yang membaca dari volume (persistent storage).
 * Fallback ke logo default jika belum ada upload kustom.
 */
export function LogoPancaCita({ className, size = 56 }: LogoPancaCitaProps) {
  const logoVersion = useUIStore((s) => s.logoVersion)
  const src = `/api/settings/logo${logoVersion ? `?v=${logoVersion}` : ''}`

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
