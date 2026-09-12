'use client'

import { useState, useRef, useEffect } from 'react'
import { useUIStore, useAuthStore, useNavStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Menu, PanelLeftClose, PanelLeft, Bell, Search, LogOut, User as UserIcon,
  ChevronDown, Settings, ShieldCheck, ArrowLeft, Loader2,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { roleLabel, roleBadgeClass } from '@/components/shared/ui-helpers'
import { cn } from '@/lib/utils'
import type { ViewKey } from '@/store/auth-store'

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
  'peserta-riwayat': { title: 'Riwayat Pelatihan', subtitle: 'Riwayat pelatihan per peserta' },
  'pendaftaran-list': { title: 'Data Pendaftar', subtitle: 'Pendaftaran peserta dari portal publik' },
  'pendaftaran-dokumen': { title: 'Dokumen Peserta', subtitle: 'Dokumen & verifikasi pendaftaran' },
  'monitoring-pretest': { title: 'Pre-Test', subtitle: 'Data nilai pre-test peserta' },
  'monitoring-posttest': { title: 'Post-Test', subtitle: 'Data nilai post-test peserta' },
  'monitoring-rekap': { title: 'Rekap Evaluasi', subtitle: 'Rekapitulasi evaluasi pelatihan' },
  'laporan-pelatihan': { title: 'Laporan Pelatihan', subtitle: 'Laporan kegiatan pelatihan' },
  'laporan-peserta': { title: 'Laporan Peserta', subtitle: 'Laporan data peserta' },
  'sertifikat-pelatihan': { title: 'Sertifikat Pelatihan', subtitle: 'Kelola dan upload sertifikat pelatihan (PDF)' },
  'user-data': { title: 'Data User', subtitle: 'Kelola data pengguna sistem' },
  'user-hak-akses': { title: 'Hak Akses', subtitle: 'Manajemen hak akses pengguna (RBAC)' },
  'user-log': { title: 'Log Aktivitas', subtitle: 'Riwayat aktivitas pengguna' },
  'backup': { title: 'Backup Database', subtitle: 'Cadangkan database sistem' },
  'backup-restore': { title: 'Restore Database', subtitle: 'Pulihkan database dari backup' },
  'backup-riwayat': { title: 'Riwayat Backup', subtitle: 'Riwayat pencadangan database' },
  'settings-profil': { title: 'Profil Instansi', subtitle: 'Pengaturan profil instansi' },
  'settings-logo': { title: 'Logo', subtitle: 'Pengaturan logo instansi' },
  'settings-login': { title: 'Pengaturan Login', subtitle: 'Konfigurasi keamanan login' },
  'settings-smtp': { title: 'Pengaturan Email', subtitle: 'Konfigurasi SMTP untuk notifikasi email' },
  'settings-audit': { title: 'Audit Log', subtitle: 'Log audit sistem' },
  'notifikasi': { title: 'Notifikasi Email', subtitle: 'Kirim dan kelola notifikasi email' },
  'arsip-sertifikat': { title: 'Arsip Sertifikat', subtitle: 'Sertifikat yang telah dihapus' },
  'arsip-pendaftar': { title: 'Arsip Pendaftar', subtitle: 'Data pendaftar portal yang telah dihapus' },
  'arsip-analisis': { title: 'Arsip Analisis', subtitle: 'Analisis kebutuhan yang telah dihapus' },
  'arsip-dokumentasi': { title: 'Arsip Dokumentasi', subtitle: 'Dokumentasi yang telah dihapus' },
  'account-profil': { title: 'Profil Saya', subtitle: 'Informasi akun dan profil' },
  'account-keamanan': { title: 'Keamanan Akun', subtitle: 'Pengaturan keamanan dan autentikasi dua faktor' },
}

interface SearchResult {
  type: string
  label: string
  sub: string
  view: ViewKey
  id: string
}

export function Topbar() {
  const { toggleSidebar, sidebarCollapsed, setMobileSidebarOpen } = useUIStore()
  const { user, logout } = useAuthStore()
  const { activeView, setActiveView } = useNavStore()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const [notifOpen, setNotifOpen] = useState(false)
  const title = viewTitles[activeView] || { title: 'Dashboard', subtitle: '' }

  // === Search State ===
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // === Search Function ===
  const handleSearch = (value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) {
      setSearchResults([])
      setSearchOpen(false)
      return
    }
    setSearchLoading(true)
    setSearchOpen(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`, { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.results || [])
        } else {
          setSearchResults([])
        }
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }

  const handleSelectResult = (result: SearchResult) => {
    setActiveView(result.view)
    setSearchQuery('')
    setSearchResults([])
    setSearchOpen(false)
  }

  // Close dropdown when click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Tombol Kembali hanya muncul jika BUKAN di Dashboard
  const showBackButton = activeView !== 'dashboard'

  const handleGoBack = () => {
    setActiveView('dashboard')
  }

  const initials = user?.nama
    ?.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() || 'U'

  return (
    <header className="h-14 lg:h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center px-3 sm:px-4 gap-1.5 sm:gap-2 lg:gap-3 shadow-sm">
      {/* Mobile menu */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden flex-shrink-0"
        onClick={() => setMobileSidebarOpen(true)}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Desktop collapse toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:flex flex-shrink-0"
        onClick={toggleSidebar}
      >
        {sidebarCollapsed ? <PanelLeft className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
      </Button>

      {/* Tombol Kembali ke Dashboard */}
      {showBackButton && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleGoBack}
          className="flex items-center gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 text-xs sm:text-sm border-slate-200 hover:border-[#0F4C81]/40 hover:text-[#0F4C81] hover:bg-[#0F4C81]/5 transition-all duration-200 active:scale-95 flex-shrink-0"
          title="Kembali ke Dashboard"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          <span className="hidden sm:inline">Kembali</span>
        </Button>
      )}

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 truncate leading-tight">{title.title}</h1>
        <p className="text-[11px] sm:text-xs text-slate-500 truncate hidden sm:block">{title.subtitle}</p>
      </div>

      {/* Search — berfungsi penuh */}
      <div ref={searchRef} className="hidden md:block relative flex-shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
          placeholder="Cari pelatihan, peserta, angkatan..."
          className="pl-9 pr-4 py-2 w-72 lg:w-96 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81] transition-colors"
        />
        {/* Search Results Dropdown */}
        {searchOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 max-h-96 overflow-y-auto z-50">
            {searchLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[#0F4C81]" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Search className="w-6 h-6 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Tidak ditemukan</p>
              </div>
            ) : (
              <div className="py-1">
                {searchResults.map((result, i) => (
                  <button
                    key={`${result.id}-${i}`}
                    onClick={() => handleSelectResult(result)}
                    className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#0F4C81]/10 flex items-center justify-center">
                      <Search className="w-3.5 h-3.5 text-[#0F4C81]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{result.label}</p>
                      <p className="text-xs text-slate-400 truncate">{result.sub} • {result.type}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative flex-shrink-0">
            <Bell className="w-5 h-5 text-slate-600" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[calc(100vw-1.5rem)] max-w-80">
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
          <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0">
            <Avatar className="w-8 h-8 border border-slate-200">
              <AvatarFallback className="bg-[#0F4C81] text-white text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-left min-w-0">
              <p className="text-sm font-semibold text-slate-900 leading-tight truncate max-w-[120px] lg:max-w-[140px]">{user?.nama}</p>
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
              <span className="text-xs font-normal text-slate-500 break-all">{user?.email}</span>
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
