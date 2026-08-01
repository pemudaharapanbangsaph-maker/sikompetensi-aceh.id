'use client'

interface LogoPancaCitaProps {
  className?: string
  size?: number
}

/**
 * Logo PEMDA Pemerintah Aceh
 * Menggunakan image PEMDA.png yang di-upload user
 */
export function LogoPancaCita({ className, size = 56 }: LogoPancaCitaProps) {
  return (
    <img
      src="/pemda-logo.png"
      alt="Logo Pemerintah Aceh"
      width={size}
      height={Math.round(size / 0.672)}
      className={`object-contain ${className || ''}`}
    />
  )
}
