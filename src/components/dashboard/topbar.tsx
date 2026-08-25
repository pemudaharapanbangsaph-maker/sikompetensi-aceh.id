'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useUIStore, useAuthStore, useNavStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Menu, PanelLeftClose, PanelLeft, Bell, Search, LogOut, User as UserIcon,
  ChevronDown, Settings, ShieldCheck, Loader2, BookOpen, Users, Award,
  ClipboardList, GraduationCap,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { roleLabel, roleBadgeClass } from '@/components/shared/ui-helpers'
import { cn } from '@/lib/utils'

const viewTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Ringkasan sistem dan statistik' },
  'analisis': { title: 'Data Analisis Kebutuhan', subtitle: 'Kelola data analisis kebutuhan diklat' },
  'analisis-input': { title: 'Input Analisis', subtitle: 'Tambah analisis kebutuhan diklat baru' },
  'analisis-prioritas': { title: 'Prioritas Pelatihan', subtitle: 'Analisis berdasarkan prioritas' },
  'analisis-rekap': { title: 'Rekap Analisis', subtitle: 'Rekapitulasi analisis kebutuhan diklat' },
  'pelatihan': { title: 'Data Pelatihan', subtitle: 'Kelola data pelatihan' },
  'pelatihan-jadwal': { title: 'Jadwal Pelatihan', subtitle: 'Jadwal pelatihan terjadwal' },
  'angkatan': { title: 'Data Angkatan', subtitle: 'Kelola angkatan pelatihan' },
  'kehadiran': { title: 'Kehadiran Peserta', subtitle: 'Rekap kehadiran peserta pelatihan' },
  'pelatihan-peserta-kegiatan': { title: 'Peserta Per Kegiatan', subtitle: 'Data peserta per kegiatan pelatihan' },
  'pelatihan-arsip': { title: 'Arsip Pelatihan', subtitle: 'Arsip pelatihan yang telah selesai' },
  'uji-jadwal': { title: 'Jadwal Uji Kompetensi', subtitle: 'Jadwal uji kompetensi terjadwal' },
  'uji-asesor': { title: 'Data Asesor', subtitle: 'Kelola data asesor kompetensi' },
  'uji-penilaian': { title: 'Penilaian', subtitle: 'Input penilaian uji kompetensi' },
  'uji-hasil': { title: 'Hasil Uji', subtitle: 'Hasil uji kompetensi peserta' },
  'uji-rekap': { title: 'Rekap Nilai', subtitle: 'Rekapitulasi nilai uji kompetensi' },
  'peserta': { title: 'Data Peserta', subtitle: 'Kelola data peserta diklat' },
  'peserta-riwayat': { title: 'Riwayat Peserta', subtitle: 'Riwayat pelatihan dan uji kompetensi' },
  'pendaftaran-list': { title: 'Data Pendaftar', subtitle: 'Pendaftaran peserta dari portal publik' },
  'pendaftaran-dokumen': { title: 'Dokumen Peserta', subtitle: 'Dokumen & verifikasi pendaftaran' },
  'monitoring-pretest': { title: 'Pre-Test', subtitle: 'Data nilai pre-test peserta' },
  'monitoring-posttest': { title: 'Post-Test', subtitle: 'Data nilai post-test peserta' },
  'monitoring-rekap': { title: 'Rekap Evaluasi', subtitle: 'Rekapitulasi evaluasi pelatihan' },
  'laporan-pelatihan': { title: 'Laporan Pelatihan', subtitle: 'Laporan kegiatan pelatihan' },
  'laporan-uji': { title: 'Laporan Uji Kompetensi', subtitle: 'Laporan uji kompetensi' },
  'laporan-peserta': { title: 'Laporan Peserta', subtitle: 'Laporan data peserta' },
  'user-data': { title: 'Data User', subtitle: 'Kelola data pengguna sistem' },
  'user-hak-akses': { title: 'Hak Akses', subtitle: 'Manajemen hak akses pengguna (RBAC)' },
  'user-log': { title: 'Log Aktivitas', subtitle: 'Riwayat aktivitas pengguna' },
  'backup': { title: 'Backup Database', subtitle: 'Cadangkan database sistem' },
  'backup-restore': { title: 'Restore Database', subtitle: 'Pulihkan database dari backup' },
  'backup-riwayat': { title: 'Riwayat Backup', subtitle: 'Riwayat pencadangan database' },
  'settings-profil': { title: 'Profil Instansi', subtitle: 'Pengaturan profil instansi' },
  'settings-logo': { title: 'Logo', subtitle: 'Pengaturan logo instansi' },
  'settings-login': { title: 'Pengaturan Login', subtitle: 'Konfigurasi keamanan login' },
  'settings-smtp': { title: 'Pengaturan SMTP', subtitle: 'Konfigurasi server email' },
  'settings-audit': { title: 'Audit Log', subtitle: 'Log audit sistem' },
  'account-profil': { title: 'Profil Saya', subtitle: 'Informasi akun dan profil' },
  'account-keamanan': { title: 'Keamanan Akun', subtitle: 'Pengaturan keamanan dan autentikasi dua faktor' },
}

interface SearchResult {
  type: string
  label: string
  sub: string
  view: string
  id: string
}

const typeIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  'Pelatihan': BookOpen,
  'Angkatan': BookOpen,
  'Peserta': Users,
  'Uji Kompetensi': Award,
  'Asesor': GraduationCap,
  'Analisis': ClipboardList,
}

const typeColor: Record<string, string> = {
  'Pelatihan': 'text-blue-600 bg-blue-50',
  'Angkatan': 'text-cyan-600 bg-cyan-50',
  'Peserta': 'text-emerald-600 bg-emerald-50',
  'Uji Kompetensi': 'text-amber-600 bg-amber-50',
  'Asesor': 'text-purple-600 bg-purple-50',
  'Analisis': 'text-rose-600 bg-rose-50',
}

export function Topbar() {
  const { toggleSidebar, sidebarCollapsed, setMobileSidebarOpen } = useUIStore()
  const { user, logout } = useAuthStore()
  const { activeView, setActiveView } = useNavStore()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const [notifOpen, setNotifOpen] = useState(false)
  const title = viewTitles[activeView] || { title: 'Dashboard', subtitle: '' }

  const initials = user?.nama
    ?.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() || 'U'

  // Global search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data.results || [])
        setSearchOpen(true)
      }
    } catch {
      setSearchResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  const handleSearchChange = (v: string) => {
    setSearchQuery(v)
    setActiveIndex(-1)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(v), 300)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (!searchOpen || searchResults.length === 0) {
      if (e.key === 'Enter' && searchQuery.length >= 2) {
        doSearch(searchQuery)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, searchResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault()
      const item = searchResults[activeIndex]
      setActiveView(item.view)
      setSearchOpen(false)
      setSearchQuery('')
    } else if (e.key === 'Escape') {
      setSearchOpen(false)
    }
  }

  const handleResultClick = (item: SearchResult) => {
    setActiveView(item.view)
    setSearchOpen(false)
    setSearchQuery('')
  }

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center px-4 gap-3 shadow-sm">
      {/* Mobile menu */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileSidebarOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Desktop collapse toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:flex"
        onClick={toggleSidebar}
      >
        {sidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
      </Button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-base lg:text-lg font-bold text-slate-900 truncate">{title.title}</h1>
        <p className="text-xs text-slate-500 truncate hidden sm:block">{title.subtitle}</p>
      </div>

      {/* Global Search */}
      <div className="hidden md:block relative" ref={searchRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setSearchOpen(true) }}
            onKeyDown={handleSearchKeyDown}
            placeholder="Cari pelatihan, peserta, uji kompetensi..."
            className="pl-9 pr-8 py-2 w-56 lg:w-72 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81] transition-colors"
          />
          {searchLoading && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
          )}
          {searchQuery && !searchLoading && (
            <button
              onClick={() => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false) }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {searchOpen && searchResults.length > 0 && (
          <div className="absolute top-full mt-1.5 right-0 w-[420px] bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">Hasil pencarian</p>
              <span className="text-[10px] text-slate-400">Tekan Enter untuk navigasi, Esc untuk tutup</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {searchResults.map((item, i) => {
                const Icon = typeIcon[item.type] || Search
                const colorCls = typeColor[item.type] || 'text-slate-600 bg-slate-50'
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0',
                      i === activeIndex && 'bg-slate-50'
                    )}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => handleResultClick(item)}
                  >
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', colorCls)}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.label}</p>
                      <p className="text-xs text-slate-400 truncate">{item.sub}</p>
                    </div>
                    <span className={cn(
                      'text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0',
                      colorCls
                    )}>
                      {item.type}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* No results */}
        {searchOpen && !searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
          <div className="absolute top-full mt-1.5 right-0 w-[320px] bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden z-50">
            <div className="px-4 py-6 text-center">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">Tidak ditemukan</p>
              <p className="text-xs text-slate-400 mt-0.5">Coba kata kunci lain</p>
            </div>
          </div>
        )}
      </div>

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5 text-slate-600" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Notifikasi</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="px-3 py-6 text-center">
            <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Tidak ada notifikasi</p>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <Avatar className="w-8 h-8 border border-slate-200">
              <AvatarFallback className="bg-[#0F4C81] text-white text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-slate-900 leading-tight truncate max-w-[140px]">{user?.nama}</p>
              <span className={cn('inline-block text-[10px] font-medium px-1.5 py-0.5 rounded border leading-none', roleBadgeClass(user?.role || ''))}>
                {roleLabel(user?.role || '')}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col gap-1">
              <span>{user?.nama}</span>
              <span className="text-xs font-normal text-slate-500">{user?.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer" onClick={() => setActiveView('account-profil')}>
            <UserIcon className="w-4 h-4 mr-2" /> Profil Saya
          </DropdownMenuItem>
          {isSuperAdmin && (
            <DropdownMenuItem className="cursor-pointer" onClick={() => setActiveView('account-keamanan')}>
              <ShieldCheck className="w-4 h-4 mr-2" /> Keamanan
            </DropdownMenuItem>
          )}
          {isSuperAdmin && (
            <DropdownMenuItem className="cursor-pointer" onClick={() => setActiveView('settings-profil')}>
              <Settings className="w-4 h-4 mr-2" /> Pengaturan
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50" onClick={() => logout()}>
            <LogOut className="w-4 h-4 mr-2" /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
