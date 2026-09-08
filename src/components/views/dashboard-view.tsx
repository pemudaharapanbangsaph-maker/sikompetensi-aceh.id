'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { DashboardStats } from '@/lib/types'
import { useNavStore } from '@/store/auth-store'
import { StatCard, PageHeader } from '@/components/shared/data-table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  BookOpen, Users, ClipboardList, Activity, TrendingUp,
  Calendar, CheckCircle2, UserCheck, BarChart3, Clock,
  Plus, ArrowRight, ArrowDownToLine,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { formatDateTime } from '@/components/shared/ui-helpers'

const COLORS = ['#0F4C81', '#198754', '#d97706', '#7c3aed', '#dc2626']

// Safe defaults to prevent undefined errors
const safeStats: DashboardStats = {
  totalPelatihan: 0, totalAngkatan: 0, totalPeserta: 0, totalAsesor: 0, totalAnalisis: 0,
  pelatihanBerjalan: 0, angkatanSelesai: 0, pendaftaranPortal: 0, pendaftaranMenunggu: 0,
  grafikPelatihanPerBulan: [], grafikKelulusan: [], grafikKategoriPelatihan: [],
  jadwalTerdekat: [], aktivitasTerbaru: [], trendPelatihan: null,
}

export function DashboardView() {
  const { setActiveView } = useNavStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.dashboard().then((d) => {
      setStats({ ...safeStats, ...d })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (loading || !stats) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-5 h-28 bg-slate-100 rounded-xl" /></Card>
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-5 h-72 bg-slate-100 rounded-xl" /></Card>
          ))}
        </div>
      </div>
    )
  }

  const grafikKategori = stats.grafikKategoriPelatihan || []
  const jadwal = stats.jadwalTerdekat || []
  const aktivitas = stats.aktivitasTerbaru || []
  const grafikBulan = stats.grafikPelatihanPerBulan || []
  const grafikAngkatan = (stats as any).grafikPesertaPerAngkatan || []

  const isEmpty = stats.totalPelatihan === 0 && stats.totalPeserta === 0 && stats.totalAnalisis === 0

  return (
    <div className="space-y-5">
      <PageHeader title="Selamat Datang di Sistem Informasi Kompetensi Teknis" description="Ringkasan aktivitas dan statistik Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti BPSDM Aceh" />

      {isEmpty ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 px-8">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mb-6 shadow-sm">
              <ClipboardList className="w-12 h-12 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">Belum ada analisis kebutuhan diklat</h3>
            <p className="text-sm text-slate-400 mt-2 text-center max-w-md">Klik <span className="font-semibold text-[#1B5E20]">Tambah Analisis</span> untuk memulai mengelola kebutuhan diklat di sistem ini.</p>
            <Button onClick={() => setActiveView('analisis-input')} className="mt-6 bg-gradient-to-r from-[#195737] to-emerald-500 hover:from-[#0F4227] hover:to-emerald-600 hover:-translate-y-0.5 shadow-md shadow-[#16A34A]/20 hover:shadow-lg hover:shadow-[#16A34A]/30 transition-all duration-300">
              <Plus className="w-4 h-4 mr-2" />
              Tambah Analisis
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 lg:gap-4">
        <StatCard title="Total Pelatihan" value={stats.totalPelatihan} subtitle={`${stats.totalAngkatan} angkatan`} icon={BookOpen} color="blue" trend={stats.trendPelatihan ?? undefined} onClick={() => setActiveView('pelatihan')} />
        <StatCard title="Total Peserta" value={stats.totalPeserta} subtitle={`${stats.totalAngkatan} angkatan`} icon={Users} color="green" onClick={() => setActiveView('peserta')} />
        <StatCard title="Analisis" value={stats.totalAnalisis} subtitle={`${stats.totalAsesor} asesor`} icon={ClipboardList} color="purple" onClick={() => setActiveView('analisis')} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 lg:gap-4">
        <StatCard title="Pelatihan Berjalan" value={stats.pelatihanBerjalan} icon={Activity} color="blue" onClick={() => setActiveView('angkatan')} />
        <StatCard title="Angkatan Selesai" value={stats.angkatanSelesai} icon={CheckCircle2} color="green" onClick={() => setActiveView('pelatihan-arsip')} />
        <StatCard title="Pendaftaran" value={stats.pendaftaranPortal} subtitle={`${stats.pendaftaranMenunggu} menunggu`} icon={ArrowDownToLine} color="amber" onClick={() => setActiveView('pendaftaran-list')} />
      </div>

      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#0F4C81]" />
                Pelatihan per Bulan
              </CardTitle>
              <Badge variant="outline" className="text-[9px] sm:text-[10px]">12 Bulan</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0">
            <div className="h-[180px] sm:h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafikBulan} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="bulan" tick={{ fontSize: 9, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="jumlah" name="Angkatan" fill="#0F4C81" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-5">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#198754]" />
              Kategori Pelatihan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0">
            <div className="h-[180px] sm:h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={grafikKategori} dataKey="jumlah" nameKey="kategori" cx="50%" cy="45%" innerRadius={35} outerRadius={60} paddingAngle={3}>
                  {grafikKategori.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-5">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#0F4C81]" />
              Peserta per Angkatan
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-5 pt-0">
            <div className="h-[180px] sm:h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafikAngkatan} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="nama" tick={{ fontSize: 8, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={55} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="peserta" name="Peserta" fill="#198754" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-5">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0F4C81]" />
              Jadwal Terdekat
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-1.5 max-h-[200px] sm:max-h-[260px] overflow-y-auto px-3 sm:px-4 pb-3 sm:pb-4">
              {jadwal.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <Calendar className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-400">Belum ada jadwal mendatang</p>
                <p className="text-xs text-slate-300 mt-1">Jadwal pelatihan akan tampil di sini</p>
              </div>
              ) : jadwal.map((j: any, i: number) => {
                const tanggal = j.tanggalMulai || j.tanggalUji
                const nama = j.pelatihan?.nama || j.namaAngkatan
                return (
                  <div key={i} className="flex items-start gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-md sm:rounded-lg bg-[#0F4C81]/10 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[9px] sm:text-[10px] font-medium text-[#0F4C81] leading-none">{new Date(tanggal).toLocaleDateString('id-ID', { month: 'short' })}</span>
                      <span className="text-xs sm:text-sm font-bold text-[#0F4C81] leading-none mt-0.5">{new Date(tanggal).getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-slate-900 truncate">{nama}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[8px] sm:text-[9px] py-0 h-3.5 sm:h-4">Pelatihan</Badge>
                        <span className="text-[10px] sm:text-[11px] text-slate-400 truncate">{j.lokasi || ''}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-1 sm:pb-2 p-3 sm:p-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0F4C81]" />
              Aktivitas Terbaru
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-[#0F4C81] h-7" onClick={() => setActiveView('user-log')}>Lihat Semua</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {aktivitas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <Activity className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-400">Belum ada aktivitas terbaru</p>
                <p className="text-xs text-slate-300 mt-1">Aktivitas pengguna akan tampil di sini</p>
              </div>
            ) : aktivitas.map((a: any) => (
              <div key={a.id} className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 hover:bg-slate-50 transition-colors">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  a.aksi?.includes('LOGIN') ? 'bg-green-100 text-[#15803D]' :
                  a.aksi?.includes('CREATE') ? 'bg-blue-100 text-blue-600' :
                  a.aksi?.includes('UPDATE') ? 'bg-amber-100 text-amber-600' :
                  a.aksi?.includes('DELETE') ? 'bg-red-100 text-red-600' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm text-slate-900 truncate">{a.deskripsi || ''}</p>
                  <p className="text-[10px] sm:text-xs text-slate-400">
                    <span className="font-medium">{a.username || ''}</span> · {a.modul || ''}
                  </p>
                </div>
                <span className="text-[10px] sm:text-xs text-slate-400 whitespace-nowrap">{a.createdAt ? formatDateTime(a.createdAt) : ''}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  )
}
