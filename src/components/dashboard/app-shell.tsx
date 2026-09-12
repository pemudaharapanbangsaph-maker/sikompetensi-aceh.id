'use client'

import { useUIStore, useNavStore, useAuthStore } from '@/store/auth-store'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { DashboardView } from '@/components/views/dashboard-view'
import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

// Lazy load views for better performance
const AnalisisView = lazy(() => import('@/components/views/analisis-view').then(m => ({ default: m.AnalisisView })))
const AnalisisDiklatInputView = lazy(() => import('@/components/views/analisis-diklat-input-view').then(m => ({ default: m.AnalisisDiklatInputView })))
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
const PendaftaranView = lazy(() => import('@/components/views/pendaftaran-view').then(m => ({ default: m.PendaftaranView })))
const ArsipView = lazy(() => import('@/components/views/arsip-view').then(m => ({ default: m.ArsipView })))
const SertifikatView = lazy(() => import('@/components/views/sertifikat-view').then(m => ({ default: m.SertifikatView })))
const NotifikasiView = lazy(() => import('@/components/views/notifikasi-view').then(m => ({ default: m.NotifikasiView })))
const UserAccountView = lazy(() => import('@/components/views/user-account-view').then(m => ({ default: m.UserAccountView })))

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
    case 'analisis-input': return <AnalisisDiklatInputView />
    case 'analisis':
    case 'analisis-prioritas':
    case 'analisis-rekap':
      return <AnalisisView />
    case 'pelatihan':
    case 'pelatihan-jadwal':
    case 'pelatihan-arsip':
      return <PelatihanView />
    case 'angkatan':
    case 'kehadiran':
    case 'pelatihan-peserta-kegiatan':
      return <AngkatanView />
    case 'uji-biodata':
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
    case 'pendaftaran-list':
    case 'pendaftaran-dokumen':
      return <PendaftaranView />
    case 'monitoring-pretest':
    case 'monitoring-posttest':
    case 'monitoring-rekap':
      return <MonitoringView />
    case 'laporan-pelatihan':
    case 'laporan-peserta':
      return <LaporanView />
    case 'arsip-pelatihan':
    case 'arsip-sertifikat':
    case 'arsip-pendaftar':
    case 'arsip-analisis':
    case 'arsip-dokumentasi':
    case 'arsip-peserta':
      return <ArsipView />
    case 'sertifikat-pelatihan':
      return <SertifikatView />
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
    case 'settings-smtp':
    case 'settings-audit':
      return <SettingsView />
    case 'notifikasi':
      return <NotifikasiView />
    case 'account-profil':
    case 'account-keamanan':
      return <UserAccountView />
    default: return <DashboardView />
  }
}

export function AppShell() {
  const { user } = useAuthStore()
  const { mobileSidebarOpen, setMobileSidebarOpen } = useUIStore()
  const { activeView } = useNavStore()

  // === Loading 2 detik setiap kali ganti menu ===
  const [isLoading, setIsLoading] = useState(false)
  const loadingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setIsLoading(true)
    if (loadingTimer.current) clearTimeout(loadingTimer.current)
    loadingTimer.current = setTimeout(() => {
      setIsLoading(false)
    }, 2000)
    return () => {
      if (loadingTimer.current) clearTimeout(loadingTimer.current)
    }
  }, [activeView])

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block flex-shrink-0">
        <Sidebar userRole={user?.role || 'OPERATOR'} />
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="p-0 w-[85vw] max-w-[320px] bg-[#0F4C81] border-r-0 overflow-y-auto">
          <Sidebar userRole={user?.role || 'OPERATOR'} inSheet />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <Topbar />

        <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-x-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
              <div className="relative">
                <Loader2 className="w-10 h-10 animate-spin text-[#0F4C81]" />
              </div>
              <p className="text-sm text-slate-500 mt-4 font-medium">Memuat data...</p>
              <div className="mt-3 w-32 h-1 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-[#0F4C81] rounded-full" style={{ animation: 'loading 2s ease-in-out', width: '100%' }} />
              </div>
            </div>
          ) : (
            <div key={activeView} className="animate-fade-in-up">
              <Suspense fallback={<ViewLoader />}>
                {renderView(activeView)}
              </Suspense>
            </div>
          )}
        </main>

        <footer className="mt-auto bg-[#0F4C81] text-white py-4 px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <span className="font-semibold">Sistem Informasi Kompetensi Teknis</span>
            <span className="text-blue-200 hidden sm:inline">, BPSDM Aceh</span>
          </div>
          <div className="text-blue-200 text-center sm:text-right leading-relaxed">
            © {new Date().getFullYear()} Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti
          </div>
        </footer>
      </div>
    </div>
  )
}
