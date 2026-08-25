'use client'

import { create } from 'zustand'
import type { User } from '@/lib/types'

interface AuthState {
  user: User | null
  loading: boolean
  initialized: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  initialize: () => Promise<void>
  login: (username: string, password: string, remember?: boolean) => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),

  initialize: async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        set({ user: data.user, initialized: true })
      } else {
        set({ user: null, initialized: true })
      }
    } catch {
      set({ user: null, initialized: true })
    }
  },

  login: async (username, password, remember) => {
    set({ loading: true })
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password, remember }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Login gagal')
      // Backup: set cookie from client side in case proxy strips Set-Cookie header
      if (data.token) {
        const maxAge = remember ? 7 * 24 * 60 * 60 : 30 * 60
        document.cookie = `bpsdm_session=${encodeURIComponent(data.token)}; path=/; max-age=${maxAge}; SameSite=Lax`
      }
      set({ user: data.user, loading: false })
    } catch (e) {
      set({ loading: false })
      throw e
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' })
    } catch {}
    set({ user: null })
  },
}))

interface UIState {
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  logoVersion: number
  bumpLogoVersion: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (open) => set({ mobileSidebarOpen: open }),
  logoVersion: 0,
  bumpLogoVersion: () => set((s) => ({ logoVersion: s.logoVersion + 1 })),
}))

export type ViewKey =
  | 'dashboard'
  | 'analisis' | 'analisis-input' | 'analisis-prioritas' | 'analisis-rekap'
  | 'pelatihan' | 'pelatihan-jadwal' | 'pelatihan-peserta-kegiatan' | 'pelatihan-arsip' | 'kehadiran' | 'angkatan'
  | 'uji-jadwal' | 'uji-asesor' | 'uji-biodata' | 'uji-penilaian' | 'uji-hasil' | 'uji-rekap'
  | 'arsip-pelatihan' | 'arsip-uji' | 'arsip-peserta'
  | 'peserta' | 'peserta-riwayat'
  | 'pendaftaran-list' | 'pendaftaran-dokumen'
  | 'monitoring-pretest' | 'monitoring-posttest' | 'monitoring-rekap'
  | 'laporan-pelatihan' | 'laporan-uji' | 'laporan-peserta'
  | 'user-data' | 'user-hak-akses' | 'user-log'
  | 'backup' | 'backup-restore' | 'backup-riwayat'
  | 'settings-profil' | 'settings-logo' | 'settings-login' | 'settings-smtp' | 'settings-audit'
  | 'account-profil' | 'account-keamanan'
  | 'sertifikat-pelatihan' | 'sertifikat-uji'
  | 'notifikasi'

interface NavigationState {
  activeView: ViewKey
  setActiveView: (view: ViewKey) => void
}

export const useNavStore = create<NavigationState>((set) => ({
  activeView: 'dashboard',
  setActiveView: (view) => set({ activeView: view }),
}))

// Permission helper
export function hasPermission(role: string | undefined, permission: string): boolean {
  if (!role) return false
  if (role === 'SUPER_ADMIN') return true
  const perms: Record<string, string[]> = {
    ADMIN_BIDANG: ['dashboard', 'analisis', 'pelatihan', 'uji_kompetensi', 'peserta', 'pendaftaran', 'monitoring', 'laporan', 'backup', 'settings'],
    OPERATOR: ['dashboard', 'analisis', 'pelatihan', 'uji_kompetensi', 'peserta', 'monitoring', 'laporan'],
  }
  const allowed = perms[role] || []
  return allowed.some((p) => permission.startsWith(p))
}
