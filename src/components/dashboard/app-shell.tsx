'use client'

import { useUIStore, useNavStore, useAuthStore } from '@/store/auth-store'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { DashboardView } from '@/components/views/dashboard-view'
import { lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'

// Lazy load views for better performance
const AnalisisView = lazy(() => import('@/components/views/analisis-view').then(m => ({ default: m.AnalisisView })))
const PelatihanView = lazy(() => import('@/components/views/pelatihan-view').then(m => ({ default: m.PelatihanView })))
const AngkatanView = lazy(() => import('@/components/views/angkatan-view').then(m => ({ default: m.AngkatanView })))
const UjiKompetensiView = lazy(() => import('@/components/views/uji-kompetensi-view').then(m => ({ default: m.UjiKompetensiView })))
const AsesorView = lazy(() => import('@/components/views/asesor-view').then(m => ({ default: m.AsesorView })))
const PesertaView = lazy(() => import('@/components/views/peserta-view').then(m => ({ default: m.PesertaView })))
const MonitoringView = lazy(() => import('@/components/views/monitoring-view').then(m => ({ default: m.MonitoringView })))
const LaporanView = lazy(() => import('@/components/views/laporan-view').then(m => ({ default: m.LaporanView })))
const UserView = lazy(() => import('@/components/views/user-view').then(m => ({ default: m.UserView })))
const BackupView = lazy(() => import('@/components/views/backup-view').then(m => ({ default: m.BackupView })))
const SettingsView = lazy(() => import('@/components/views/settings-view').then(m => ({ default: m.SettingsView })))

function ViewLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-[#0F4C81]" />
    </div>
  )
}

function renderView(view: string): React.ReactNode {
  switch (view) {
    case 'dashboard': return <DashboardView />
    case 'analisis':
    case 'analisis-input':
    case 'analisis-prioritas':
    case 'analisis-rekap':
      return <AnalisisView />
    case 'pelatihan':
    case 'pelatihan-jadwal':
    case 'pelatihan-arsip':
      return <PelatihanView />
    case 'pelatihan-angkatan':
    case 'pelatihan-kehadiran':
    case 'pelatihan-dokumentasi':
      return <AngkatanView />
    case 'uji-jadwal':
    case 'uji-penilaian':
    case 'uji-hasil':
    case 'uji-rekap':
      return <UjiKompetensiView />
    case 'uji-asesor':
      return <AsesorView />
    case 'peserta':
    case 'peserta-riwayat':
      return <PesertaView />
    case 'monitoring-pretest':
    case 'monitoring-posttest':
    case 'monitoring-kuesioner':
    case 'monitoring-rekap':
      return <MonitoringView />
    case 'laporan-pelatihan':
    case 'laporan-uji':
    case 'laporan-peserta':
      return <LaporanView />
    case 'user-data':
    case 'user-hak-akses':
    case 'user-log':
      return <UserView />
    case 'backup':
    case 'backup-restore':
    case 'backup-riwayat':
      return <BackupView />
    case 'settings-profil':
    case 'settings-logo':
    case 'settings-login':
    case 'settings-audit':
      return <SettingsView />
    default: return <DashboardView />
  }
}

export function AppShell() {
  const { user } = useAuthStore()
  const { sidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()
  const { activeView } = useNavStore()

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar userRole={user?.role || 'OPERATOR'} />
      </div>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-64 bg-[#0F4C81]">
          <Sidebar userRole={user?.role || 'OPERATOR'} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <div key={activeView} className="animate-fade-in-up">
            <Suspense fallback={<ViewLoader />}>
              {renderView(activeView)}
            </Suspense>
          </div>
        </main>
        <footer className="mt-auto bg-[#0F4C81] text-white py-4 px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Sistem Informasi Kompetensi Teknis</span>
            <span className="text-blue-200">— BPSDM Provinsi Aceh</span>
          </div>
          <div className="text-blue-200">
            © {new Date().getFullYear()} Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti
          </div>
        </footer>
      </div>
    </div>
  )
}
