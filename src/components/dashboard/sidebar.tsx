'use client'

import { useState } from 'react'
import { useNavStore, useUIStore, hasPermission, type ViewKey } from '@/store/auth-store'
import { cn } from '@/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronDown, LayoutDashboard, ClipboardList, BookOpen, Award, Users, BarChart3, FileText, UserCog, DatabaseBackup, Settings } from 'lucide-react'
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
      { key: 'pelatihan-angkatan', label: 'Data Angkatan', view: 'pelatihan-angkatan', permission: 'pelatihan' },
      { key: 'pelatihan-kehadiran', label: 'Kehadiran Peserta', view: 'pelatihan-kehadiran', permission: 'pelatihan' },
      { key: 'pelatihan-dokumentasi', label: 'Dokumentasi', view: 'pelatihan-dokumentasi', permission: 'pelatihan' },
      { key: 'pelatihan-arsip', label: 'Arsip Pelatihan', view: 'pelatihan-arsip', permission: 'pelatihan' },
    ],
  },
  {
    key: 'uji', label: 'Uji Kompetensi', icon: Award, permission: 'uji_kompetensi',
    children: [
      { key: 'uji-jadwal', label: 'Jadwal Uji Kompetensi', view: 'uji-jadwal', permission: 'uji_kompetensi' },
      { key: 'uji-asesor', label: 'Data Asesor', view: 'uji-asesor', permission: 'uji_kompetensi' },
      { key: 'uji-penilaian', label: 'Penilaian', view: 'uji-penilaian', permission: 'uji_kompetensi' },
      { key: 'uji-hasil', label: 'Hasil Uji', view: 'uji-hasil', permission: 'uji_kompetensi' },
      { key: 'uji-rekap', label: 'Rekap Nilai', view: 'uji-rekap', permission: 'uji_kompetensi' },
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
    key: 'monitoring', label: 'Monitoring & Evaluasi', icon: BarChart3, permission: 'monitoring',
    children: [
      { key: 'monitoring-pretest', label: 'Pre-Test', view: 'monitoring-pretest', permission: 'monitoring' },
      { key: 'monitoring-posttest', label: 'Post-Test', view: 'monitoring-posttest', permission: 'monitoring' },
      { key: 'monitoring-kuesioner', label: 'Kuesioner', view: 'monitoring-kuesioner', permission: 'monitoring' },
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
  const { sidebarCollapsed, setMobileSidebarOpen } = useUIStore()

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
        'sidebar-transition bg-[#0F4C81] text-white flex flex-col h-screen sticky top-0',
        sidebarCollapsed ? 'w-[68px]' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center gap-2.5 px-4 border-b border-white/10 flex-shrink-0">
        <div className="flex-shrink-0">
          <LogoPancaCita size={32} />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold leading-tight truncate">SIKOMPETENSI</p>
            <p className="text-[10px] text-green-200 leading-tight truncate">BPSDM Aceh</p>
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
      {!sidebarCollapsed && (
        <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
          <p className="text-[10px] text-blue-200 text-center">v1.0.0 — Internal Use Only</p>
        </div>
      )}
    </aside>
  )
}

function SidebarItem({
  item, activeView, activeTopKey, collapsed, onSelect,
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
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
          isActive ? 'bg-white text-[#0F4C81] font-semibold' : 'text-blue-100 hover:bg-white/10',
          collapsed && 'justify-center px-0'
        )}
        title={collapsed ? item.label : undefined}
      >
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
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
            isParentActive ? 'bg-white/15 text-white font-medium' : 'text-blue-100 hover:bg-white/10',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? item.label : undefined}
        >
          {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
          {!collapsed && (
            <>
              <span className="truncate flex-1 text-left">{item.label}</span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
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
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                    childActive ? 'bg-white/20 text-white font-medium' : 'text-blue-100 hover:bg-white/10'
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', childActive ? 'bg-white' : 'bg-blue-300/50')} />
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
