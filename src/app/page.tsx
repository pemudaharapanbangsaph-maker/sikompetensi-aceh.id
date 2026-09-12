'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { LoginPage } from '@/components/login/login-page'
import { AppShell } from '@/components/dashboard/app-shell'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { user, initialized, initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  // Anti-back-exit: LANGSUNG jalan saat halaman dimuat (sebelum auth check)
  useEffect(() => {
    // Replace history saat ini untuk hapus referensi halaman sebelumnya
    window.history.replaceState({ page: 'home' }, '', window.location.href)
    // Push beberapa dummy state supaya back button "terjebak"
    window.history.pushState({ page: 'home' }, '', window.location.href)
    window.history.pushState({ page: 'home' }, '', window.location.href)

    const handlePopState = () => {
      // Kalau user klik back, tetap di halaman ini
      window.history.pushState({ page: 'home' }, '', window.location.href)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, []) // ← empty array = jalan SEKALI, LANGSUNG saat mount

  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-[#0F4C81]" />
          <p className="text-sm text-slate-500">Memuat sistem...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return <AppShell />
}
