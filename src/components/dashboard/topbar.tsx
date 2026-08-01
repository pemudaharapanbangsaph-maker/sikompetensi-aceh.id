'use client'

import { useState, useRef, useEffect } from 'react'
import { useUIStore, useAuthStore, useNavStore } from '@/store/auth-store'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Menu, PanelLeftClose, PanelLeft, Bell, Search, LogOut, User as UserIcon,
  ChevronDown, Settings, ShieldCheck,
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
  'pelatihan-angkatan': { title: 'Data Angkatan', subtitle: 'Kelola angkatan pelatihan' },
  'pelatihan-kehadiran': { title: 'Kehadiran Peserta', subtitle: 'Rekap kehadiran peserta pelatihan' },
  'pelatihan-dokumentasi': { title: 'Dokumentasi', subtitle: 'Dokumentasi pelatihan' },
  'pelatihan-arsip': { title: 'Arsip Pelatihan', subtitle: 'Arsip pelatihan yang telah selesai' },
  'uji-jadwal': { title: 'Jadwal Uji Kompetensi', subtitle: 'Jadwal uji kompetensi terjadwal' },
  'uji-asesor': { title: 'Data Asesor', subtitle: 'Kelola data asesor kompetensi' },
  'uji-penilaian': { title: 'Penilaian', subtitle: 'Input penilaian uji kompetensi' },
  'uji-hasil': { title: 'Hasil Uji', subtitle: 'Hasil uji kompetensi peserta' },
  'uji-rekap': { title: 'Rekap Nilai', subtitle: 'Rekapitulasi nilai uji kompetensi' },
  'peserta': { title: 'Data Peserta', subtitle: 'Kelola data peserta diklat' },
  'peserta-riwayat': { title: 'Riwayat Peserta', subtitle: 'Riwayat pelatihan dan uji kompetensi' },
  'monitoring-pretest': { title: 'Pre-Test', subtitle: 'Data nilai pre-test peserta' },
  'monitoring-posttest': { title: 'Post-Test', subtitle: 'Data nilai post-test peserta' },
  'monitoring-kuesioner': { title: 'Kuesioner', subtitle: 'Data kuesioner evaluasi' },
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
  'settings-audit': { title: 'Audit Log', subtitle: 'Log audit sistem' },
}

export function Topbar() {
  const { toggleSidebar, sidebarCollapsed, setMobileSidebarOpen } = useUIStore()
  const { user, logout } = useAuthStore()
  const { activeView } = useNavStore()
  const [notifOpen, setNotifOpen] = useState(false)
  const title = viewTitles[activeView] || { title: 'Dashboard', subtitle: '' }

  const initials = user?.nama
    ?.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() || 'U'

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

      {/* Search (decorative on desktop) */}
      <div className="hidden md:flex items-center relative">
        <Search className="absolute left-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Cari cepat..."
          className="pl-9 pr-4 py-2 w-56 lg:w-64 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81] transition-colors"
        />
      </div>

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5 text-slate-600" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notifikasi</span>
            <span className="text-xs font-normal text-slate-400">3 baru</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { title: 'Pelatihan baru dijadwalkan', desc: 'Angkatan 15 - Pelatihan Cyber Security', time: '2 jam lalu' },
            { title: 'Hasil uji kompetensi tersedia', desc: 'UK-001 telah selesai dinilai', time: '5 jam lalu' },
            { title: 'Backup database berhasil', desc: 'Backup otomatis telah dibuat', time: '1 hari lalu' },
          ].map((n, i) => (
            <DropdownMenuItem key={i} className="flex flex-col items-start py-3 cursor-pointer">
              <div className="flex items-start gap-2 w-full">
                <div className="w-2 h-2 rounded-full bg-[#0F4C81] mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{n.title}</p>
                  <p className="text-xs text-slate-500">{n.desc}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{n.time}</p>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
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
          <DropdownMenuItem className="cursor-pointer">
            <UserIcon className="w-4 h-4 mr-2" /> Profil Saya
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <ShieldCheck className="w-4 h-4 mr-2" /> Keamanan
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer">
            <Settings className="w-4 h-4 mr-2" /> Pengaturan
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50" onClick={() => logout()}>
            <LogOut className="w-4 h-4 mr-2" /> Keluar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
