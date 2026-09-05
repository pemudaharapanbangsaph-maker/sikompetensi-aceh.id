'use client'

import {
  createElement,
  useEffect,
  useState,
} from 'react'

import { useUIStore } from '@/store/auth-store'

interface LogoPancaCitaProps {
  className?: string
  size?: number
}

const DEFAULT_LOGO_SRC = '/logo-pancacita.png'

function getLogoSrc(version?: string | number) {
  if (version) {
    return `/api/settings/logo?v=${encodeURIComponent(
      String(version),
    )}`
  }

  return '/api/settings/logo'
}

export function LogoPancaCita({
  className,
  size = 56,
}: LogoPancaCitaProps) {
  const logoVersion = useUIStore(
    (state) => state.logoVersion,
  )

  const remoteLogoSrc = getLogoSrc(logoVersion)

  const [src, setSrc] = useState<string>(
    remoteLogoSrc,
  )

  const [hasFailed, setHasFailed] = useState(false)

  useEffect(() => {
    setSrc(remoteLogoSrc)
    setHasFailed(false)
  }, [remoteLogoSrc])

  function handleImageError() {
    if (hasFailed) {
      return
    }

    setHasFailed(true)
    setSrc(DEFAULT_LOGO_SRC)
  }

  return createElement('img', {
    src,
    alt: 'Logo Pemerintah Aceh',
    width: size,
    height: Math.round(size / 0.672),
    className: `object-contain ${className ?? ''}`,
    onError: handleImageError,
    loading: 'eager',
    decoding: 'async',
  })
}
