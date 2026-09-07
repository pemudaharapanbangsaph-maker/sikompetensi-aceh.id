'use client'

import { useState } from 'react'
import { useNavStore, useUIStore, hasPermission, type ViewKey } from '@/store/auth-store'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  ChevronDown, LayoutDashboard, ClipboardList, BookOpen, 
  Award, Users, BarChart3, FileText, UserCog, 
  DatabaseBackup, Settings, FileUser, ClipboardCheck, 
  UsersRound, Archive, X 
} from 'lucide-react'
import { LogoPancaCita } from '@/components/shared/logo-pancacita'

interface MenuItem {
  key: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  view?: ViewKey
  permission?: string
  children?: MenuItem[]
}

const menuItems: MenuItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, view: 'dashboard', permission: 'dashboard' },
  {
    key: 'analisis', label: 'Analisis Kebutuhan Diklat', icon: ClipboardList, permission: 'analisis',
    children: [
      { key: 'analisis-data', label: 'Data Analisis Kebutuhan', view: 'analisis', permission: 'analisis' },
      { key: 'analisis-input', label: 'Input Analisis', view: 'analisis-input', permission: 'analisis' },
      { key: 'analisis-prioritas', label: 'Prioritas Pelatihan', view: 'analisis-prioritas', permission: 'analisis' },
      { key: 'analisis-rekap', label: 'Rekap Analisis', view: 'analisis-rekap', permission: 'analisis' },
    ],
  },
  {
    key: 'pelatihan', label: 'Pelatihan', icon: BookOpen, permission: 'pelatihan',
    children: [
      { key: 'pelatihan-jadwal', label: 'Jadwal Pelatihan', view: 'pelatihan-jadwal', permission: 'pelatihan' },
      { key: 'pelatihan-data', label: 'Data Pelatihan', view: 'pelatihan', permission: 'pelatihan' },
      { key: 'pelatihan-peserta-kegiatan', label: 'Peserta Per Kegiatan', view: 'pelatihan-peserta-kegiatan', permission: 'pelatihan' },
    ],
  },
  { key: 'kehadiran', label: 'Kehadiran Peserta', icon: ClipboardCheck, view: 'kehadiran', permission: 'pelatihan' },
  { key: 'angkatan', label: 'Data Angkatan', icon: UsersRound, view: 'angkatan', permission: 'pelatihan' },
  {
    key: 'uji', label: 'Uji Kompetensi', icon: Award, permission: 'uji_kompetensi',
    children: [
      { key: 'uji-jadwal', label: 'Jadwal Uji Kompetensi', view: 'uji-jadwal', permission: 'uji_kompetensi' },
      { key: 'uji-biodata', label: 'Biodata Peserta', view: 'uji-biodata', permission: 'uji_kompetensi' },
      { key: 'uji-asesor', label: 'Data Asesor', view: 'uji-asesor', permission: 'uji_kompetensi' },
      { key: 'uji-penilaian', label: 'Penilaian', view: 'uji-penilaian', permission: 'uji_kompetensi' },
      { key: 'uji-hasil', label: 'Hasil Uji', view: 'uji-hasil', permission: 'uji_kompetensi' },
      { key: 'uji-rekap', label: 'Rekap Nilai', view: 'uji-rekap', permission: 'uji_kompetensi' },
    ],
  },
  {
    key: 'arsip', label: 'Arsip', icon: Archive, permission: 'laporan',
    children: [
      { key: 'arsip-pelatihan', label: 'Arsip Pelatihan', view: 'arsip-pelatihan', permission: 'laporan' },
      { key: 'arsip-uji', label: 'Arsip Uji Kompetensi', view: 'arsip-uji', permission: 'laporan' },
      { key: 'arsip-peserta', label: 'Arsip Peserta', view: 'arsip-peserta', permission: 'peserta' },
    ],
  },
  {
    key: 'peserta', label: 'Data Peserta', icon: Users, permission: 'peserta',
    children: [
      { key: 'peserta-data', label: 'Data Peserta', view: 'peserta', permission: 'peserta' },
      { key: 'peserta-riwayat', label: 'Riwayat Pelatihan & Uji', view: 'peserta-riwayat', permission: 'peserta' },
    ],
  },
  {
    key: 'pendaftaran', label: 'Biodata Peserta Portal', icon: FileUser, permission: 'pendaftaran',
    children: [
      { key: 'pendaftaran-list', label: 'Data Pendaftar', view: 'pendaftaran-list', permission: 'pendaftaran' },
      { key: 'pendaftaran-dokumen', label: 'Dokumen Peserta', view: 'pendaftaran-dokumen', permission: 'pendaftaran' },
    ],
  },
  {
    key: 'monitoring', label: 'Monitoring & Evaluasi', icon: BarChart3, permission: 'monitoring',
    children: [
      { key: 'monitoring-pretest', label: 'Pre-Test', view: 'monitoring-pretest', permission: 'monitoring' },
      { key: 'monitoring-posttest', label: 'Post-Test', view: 'monitoring-posttest', permission: 'monitoring' },
      { key: 'monitoring-rekap', label: 'Rekap Evaluasi', view: 'monitoring-rekap', permission: 'monitoring' },
    ],
  },
  {
    key: 'laporan', label: 'Laporan', icon: FileText, permission: 'laporan',
    children: [
      { key: 'laporan-pelatihan', label: 'Laporan Pelatihan', view: 'laporan-pelatihan', permission: 'laporan' },
      { key: 'laporan-uji', label: 'Laporan Uji Kompetensi', view: 'laporan-uji', permission: 'laporan' },
      { key: 'laporan-peserta', label: 'Laporan Peserta', view: 'laporan-peserta', permission: 'laporan' },
    ],
  },
  {
    key: 'user', label: 'Manajemen User', icon: UserCog, permission: 'users',
    children: [
      { key: 'user-data', label: 'Data User', view: 'user-data', permission: 'users' },
      { key: 'user-hak', label: 'Hak Akses', view: 'user-hak-akses', permission: 'users' },
      { key: 'user-log', label: 'Log Aktivitas', view: 'user-log', permission: 'users' },
    ],
  },
  {
    key: 'backup', label: 'Backup & Restore', icon: DatabaseBackup, permission: 'backup',
    children: [
      { key: 'backup-data', label: 'Backup Database', view: 'backup', permission: 'backup' },
      { key: 'backup-restore', label: 'Restore Database', view: 'backup-restore', permission: 'backup' },
      { key: 'backup-riwayat', label: 'Riwayat Backup', view: 'backup-riwayat', permission: 'backup' },
    ],
  },
  {
    key: 'settings', label: 'Pengaturan Sistem', icon: Settings, permission: 'settings',
    children: [
      { key: 'settings-profil', label: 'Profil Instansi', view: 'settings-profil', permission: 'settings' },
      { key: 'settings-logo', label: 'Logo', view: 'settings-logo', permission: 'settings' },
      { key: 'settings-login', label: 'Pengaturan Login', view: 'settings-login', permission: 'settings' },
      { key: 'settings-audit', label: 'Audit Log', view: 'settings-audit', permission: 'settings' },
    ],
  },
]

export function Sidebar({ userRole }: { userRole: string }) {
  const { activeView, setActiveView } = useNavStore()
  const { sidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()

  const filterMenu = (items: MenuItem[]): MenuItem[] => {
    return items
      .filter((item) => !item.permission || hasPermission(userRole, item.permission))
      .map((item) => (item.children ? { ...item, children: filterMenu(item.children) } : item))
  }

  const visibleMenu = filterMenu(menuItems)
  const activeTopKey = activeView.split('-')[0]

  return (
    <>
      {/* Backdrop overlay khusus Mobile */}
      {mobileSidebarOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          'bg-[#0F4C81] text-white flex flex-col h-screen fixed inset-y-0 left-0 z-50 lg:sticky lg:top-0 shadow-xl lg:shadow-none transition-all duration-300 ease-in-out',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          sidebarCollapsed ? 'lg:w-[68px]' : 'lg:w-64',
          'w-72 max-w-[80vw] lg:max-w-none'
        )}
      >
        {/* Header / Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex-shrink-0">
              <LogoPancaCita size={32} />
            </div>
            {/* Hanya tampilkan teks jika tidak collapsed di Desktop */}
            <div className={cn('overflow-hidden transition-opacity duration-200', sidebarCollapsed ? 'lg:hidden' : 'block')}>
              <p className="text-sm font-bold leading-tight truncate tracking-wide">SIKOMPETENSI</p>
              <p className="text-[10px] text-[#86EFAC] font-medium leading-tight truncate">BPSDM Aceh</p>
            </div>
          </div>

          {/* Tombol Tutup Sidebar untuk Mobile */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden p-2 text-blue-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 overflow-y-auto sidebar-scroll py-3">
          <div className="space-y-1 px-2.5">
            {visibleMenu.map((item) => (
              <SidebarItem
                key={item.key}
                item={item}
                activeView={activeView}
                activeTopKey={activeTopKey}
                collapsed={sidebarCollapsed}
                onSelect={(v) => {
                  setActiveView(v)
                  setMobileSidebarOpen(false)
                }}
              />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div
          className={cn(
            'px-4 py-3 border-t border-white/10 flex-shrink-0 bg-[#0B3C67]/50',
            sidebarCollapsed ? 'lg:hidden' : 'block'
          )}
        >
          <p className="text-[10px] text-blue-200 text-center font-medium tracking-wider">
            PSKTI — Internal System
          </p>
        </div>
      </aside>
    </>
  )
}

function SidebarItem({
  item,
  activeView,
  activeTopKey,
  collapsed,
  onSelect,
}: {
  item: MenuItem
  activeView: ViewKey
  activeTopKey: string
  collapsed: boolean
  onSelect: (v: ViewKey) => void
}) {
  const [open, setOpen] = useState(item.key === activeTopKey)
  const Icon = item.icon
  const isActive = item.view === activeView
  const isParentActive = item.key === activeTopKey

  if (!item.children || item.children.length === 0) {
    return (
      <button
        onClick={() => item.view && onSelect(item.view)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium relative transition-all duration-200 ease-in-out',
          isActive
            ? 'bg-white/20 text-white font-semibold shadow-sm'
            : 'text-blue-100 hover:bg-white/10 hover:text-white',
          collapsed ? 'lg:justify-center lg:px-0' : 'justify-start'
        )}
        title={collapsed ? item.label : undefined}
      >
        {isActive && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[#22C55E] shadow-sm shadow-[#22C55E]/50" />
        )}
        {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
        <span className={cn('truncate', collapsed ? 'lg:hidden' : 'inline')}>{item.label}</span>
      </button>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          onClick={() => {
            setOpen(!open)
          }}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium relative transition-all duration-200 ease-in-out',
            isParentActive
              ? 'bg-white/15 text-white shadow-sm'
              : 'text-blue-100 hover:bg-white/10 hover:text-white',
            collapsed ? 'lg:justify-center lg:px-0' : 'justify-start'
          )}
          title={collapsed ? item.label : undefined}
        >
          {isParentActive && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[#22C55E] shadow-sm shadow-[#22C55E]/50" />
          )}
          {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
          <span className={cn('truncate flex-1 text-left', collapsed ? 'lg:hidden' : 'inline')}>
            {item.label}
          </span>
          <ChevronDown
            className={cn(
              'w-4 h-4 transition-transform duration-200 opacity-80',
              open && 'rotate-180',
              collapsed ? 'lg:hidden' : 'block'
            )}
          />
        </button>
      </CollapsibleTrigger>
      
      {/* Submenu */}
      <CollapsibleContent>
        <div className={cn('space-y-1 mt-1 mb-1.5', collapsed ? 'lg:ml-0' : 'ml-4 pl-3 border-l border-white/15')}>
          {item.children.map((child) => {
            const childActive = child.view === activeView
            return (
              <button
                key={child.key}
                onClick={() => child.view && onSelect(child.view)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs sm:text-sm font-normal transition-all duration-150 ease-in-out',
                  childActive
                    ? 'bg-white/20 text-white font-medium shadow-sm'
                    : 'text-blue-100/90 hover:bg-white/10 hover:text-white'
                )}
              >
                <span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full flex-shrink-0 transition-transform duration-200',
                    childActive ? 'bg-[#22C55E] scale-125' : 'bg-blue-300/40'
                  )}
                />
                <span className="truncate">{child.label}</span>
              </button>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
