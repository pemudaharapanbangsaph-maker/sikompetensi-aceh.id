'use client'

import { useState } from 'react'
import { useNavStore, useUIStore, hasPermission, type ViewKey } from '@/store/auth-store'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, LayoutDashboard, ClipboardList, BookOpen, Users, BarChart3, FileText, UserCog, DatabaseBackup, Settings, FileUser, ClipboardCheck, UsersRound, Archive, FileBadge, Mail } from 'lucide-react'
import { LogoPancaCita } from "@/components/shared/logo-pancacita"

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
    key: 'arsip', label: 'Arsip', icon: Archive, permission: 'laporan',
    children: [
      { key: 'arsip-pelatihan', label: 'Arsip Pelatihan', view: 'arsip-pelatihan', permission: 'laporan' },
      { key: 'arsip-peserta', label: 'Arsip Peserta', view: 'arsip-peserta', permission: 'peserta' },
    ],
  },
  {
    key: 'peserta', label: 'Data Peserta', icon: Users, permission: 'peserta',
    children: [
      { key: 'peserta-data', label: 'Data Peserta', view: 'peserta', permission: 'peserta' },
      { key: 'peserta-riwayat', label: 'Riwayat Pelatihan', view: 'peserta-riwayat', permission: 'peserta' },
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
    key: 'sertifikat', label: 'Sertifikat', icon: FileBadge, permission: 'pelatihan',
    children: [
      { key: 'sertifikat-pelatihan', label: 'Sertifikat Pelatihan', view: 'sertifikat-pelatihan' as ViewKey, permission: 'pelatihan' },
    ],
  },
  { key: 'notifikasi', label: 'Notifikasi Email', icon: Mail, view: 'notifikasi' as ViewKey, permission: 'settings' },
  {
    key: 'settings', label: 'Pengaturan Sistem', icon: Settings, permission: 'settings',
    children: [
      { key: 'settings-profil', label: 'Profil Instansi', view: 'settings-profil', permission: 'settings' },
      { key: 'settings-logo', label: 'Logo', view: 'settings-logo', permission: 'settings' },
      { key: 'settings-login', label: 'Pengaturan Login', view: 'settings-login', permission: 'settings' },
      { key: 'settings-smtp', label: 'Pengaturan SMTP', view: 'settings-smtp', permission: 'settings' },
      { key: 'settings-audit', label: 'Audit Log', view: 'settings-audit', permission: 'settings' },
    ],
  },
]

export function Sidebar({ userRole, variant = 'desktop' }: { userRole: string; variant?: 'desktop' | 'mobile' }) {
  const { activeView, setActiveView } = useNavStore()
  const { sidebarCollapsed, setMobileSidebarOpen } = useUIStore()
  const isMobile = variant === 'mobile'
  // Di drawer mobile, sidebar SELALU tampil penuh (abaikan state collapsed desktop)
  const collapsed = isMobile ? false : sidebarCollapsed

  const filterMenu = (items: MenuItem[]): MenuItem[] => {
    return items
      .filter((item) => !item.permission || hasPermission(userRole, item.permission))
      .map((item) => (item.children ? { ...item, children: filterMenu(item.children) } : item))
  }

  const visibleMenu = filterMenu(menuItems)
  const activeTopKey = activeView.split('-')[0]

  return (
    <aside
      className={cn(
        'bg-[#0F4C81] text-white flex flex-col',
        isMobile ? 'h-full w-full' : 'sidebar-transition h-screen sticky top-0',
        !isMobile && (collapsed ? 'w-[68px]' : 'w-64')
      )}
    >
      {/* Logo */}
      <div className={cn(
        'h-16 flex items-center gap-2.5 border-b border-white/10 flex-shrink-0',
        collapsed ? 'justify-center px-2' : 'px-4'
      )}>
        <div className="flex-shrink-0">
          <LogoPancaCita size={32} />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold leading-tight truncate">SIKOMPETENSI</p>
            <p className="text-[10px] text-[#86EFAC] leading-tight truncate">BPSDM Aceh</p>
          </div>
        )}
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto sidebar-scroll py-3">
        <div className="space-y-0.5 px-2">
          {visibleMenu.map((item) => (
            <SidebarItem
              key={item.key}
              item={item}
              activeView={activeView}
              activeTopKey={activeTopKey}
              collapsed={collapsed}
              isMobile={isMobile}
              onSelect={(v) => {
                setActiveView(v)
                setMobileSidebarOpen(false)
              }}
            />
          ))}
        </div>
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="px-4 py-3 border-t border-white/10 flex-shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          <p className="text-[10px] text-blue-200 text-center">PSKTI — System_Internal Use Only</p>
        </div>
      )}
    </aside>
  )
}

function SidebarItem({
  item, activeView, activeTopKey, collapsed, isMobile, onSelect,
}: {
  item: MenuItem
  activeView: ViewKey
  activeTopKey: string
  collapsed: boolean
  isMobile: boolean
  onSelect: (v: ViewKey) => void
}) {
  const [open, setOpen] = useState(item.key === activeTopKey)
  const Icon = item.icon
  const isActive = item.view === activeView
  const isParentActive = item.key === activeTopKey
  const touchCls = isMobile ? 'min-h-[44px] py-3' : 'py-2.5'

  if (!item.children || item.children.length === 0) {
    return (
      <button
        onClick={() => item.view && onSelect(item.view)}
        className={cn(
          'w-full flex items-center gap-3 px-3 rounded-lg text-sm relative transition-all duration-200 ease-out',
          touchCls,
          isActive ? 'bg-white/20 text-white font-semibold shadow-sm shadow-black/10' : 'text-blue-100 hover:bg-white/10 active:bg-white/20',
          collapsed && 'justify-center px-0'
        )}
        title={collapsed ? item.label : undefined}
      >
        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full bg-[#22C55E] shadow-sm shadow-[#22C55E]/50" />}
        {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    )
  }

  return (
    <Collapsible open={open && !collapsed} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          onClick={() => {
            if (collapsed) {
              if (item.children && item.children[0]?.view) onSelect(item.children[0].view)
            } else {
              setOpen(!open)
            }
          }}
          className={cn(
            'w-full flex items-center gap-3 px-3 rounded-lg text-sm relative transition-all duration-200 ease-out',
            touchCls,
            isParentActive ? 'bg-white/20 text-white font-medium shadow-sm shadow-black/10' : 'text-blue-100 hover:bg-white/10 active:bg-white/20',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? item.label : undefined}
        >
          {isParentActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-r-full bg-[#22C55E] shadow-sm shadow-[#22C55E]/50" />}
          {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
          {!collapsed && (
            <>
              <span className="truncate flex-1 text-left">{item.label}</span>
              <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', open && 'rotate-180')} />
            </>
          )}
        </button>
      </CollapsibleTrigger>
      {!collapsed && (
        <CollapsibleContent>
          <div className="ml-4 pl-4 border-l border-white/10 space-y-0.5 mt-0.5 mb-1">
            {item.children.map((child) => {
              const ChildIcon = child.icon
              const childActive = child.view === activeView
              return (
                <button
                  key={child.key}
                  onClick={() => child.view && onSelect(child.view)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 rounded-md text-sm transition-all duration-200 ease-out',
                    isMobile ? 'min-h-[40px] py-2.5' : 'py-2',
                    childActive ? 'bg-white/20 text-white font-medium' : 'text-blue-100 hover:bg-white/10 active:bg-white/20'
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all duration-200', childActive ? 'bg-[#22C55E] scale-125' : 'bg-blue-300/50')} />
                  <span className="truncate">{child.label}</span>
                </button>
              )
            })}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}
