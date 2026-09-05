'use client'

import { useEffect, useState } from 'react'
import { useUIStore } from '@/store/auth-store'

interface LogoPancaCitaProps {
  className?: string
  size?: number
}

const DEFAULT_LOGO_SRC = '/logo-pancacita.png'

function getLogoSrc(version?: string | number) {
  const versionValue = version
    ? encodeURIComponent(String(version))
    : ''

  return versionValue
    ? `/api/settings/logo?v=${versionValue}`
    : '/api/settings/logo'
}

/**
 * Logo PEMDA Pemerintah Aceh.
 * Mengambil logo kustom dari API dan menggunakan
 * logo default jika request gagal.
 */
export function LogoPancaCita({
  className,
  size = 56,
}: LogoPancaCitaProps) {
  const logoVersion = useUIStore((state) => state.logoVersion)

  const remoteLogoSrc = getLogoSrc(logoVersion)

  const [src, setSrc] = useState(remoteLogoSrc)
  const [hasFailed, setHasFailed] = useState(false)

  // Memuat ulang URL logo ketika versi logo berubah
  useEffect(() => {
    setSrc(remoteLogoSrc)
    setHasFailed(false)
  }, [remoteLogoSrc])

  function handleImageError() {
    if (hasFailed) return

    setHasFailed(true)
    setSrc(DEFAULT_LOGO_SRC)
  }

  return (
    [image removed]
  )
}
