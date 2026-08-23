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
