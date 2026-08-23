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
  BookOpen, Users, Award, ClipboardList, Activity, TrendingUp,
  Calendar, CheckCircle2, UserCheck, BarChart3, Clock,
  Plus, ArrowRight, FileCheck, ArrowDownToLine,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { formatDateTime } from '@/components/shared/ui-helpers'

const COLORS = ['#0F4C81', '#198754', '#d97706', '#7c3aed', '#dc2626']

export function DashboardView() {
  const { setActiveView } = useNavStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.dashboard().then((d) => {
      setStats(d)
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

  // Check if dashboard is essentially empty (no data)
  const isEmpty =
    stats.totalPelatihan === 0 &&
    stats.totalPeserta === 0 &&
    stats.totalUjiKompetensi === 0 &&
    stats.totalAnalisis === 0

  return (
    <div className="space-y-5">
      <PageHeader title="Selamat Datang di Sistem Informasi Kompetensi Teknis" description="Ringkasan aktivitas dan statistik Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti BPSDM Aceh" />

      {/* Empty State */}
      {isEmpty ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 px-8">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mb-6 shadow-sm">
              <ClipboardList className="w-12 h-12 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-700">Belum ada analisis kebutuhan diklat</h3>
            <p className="text-sm text-slate-400 mt-2 text-center max-w-md">Klik <span className="font-semibold text-[#1B5E20]">Tambah Analisis</span> untuk memulai mengelola kebutuhan diklat di sistem ini.</p>
            <Button
              onClick={() => setActiveView('analisis-input')}
              className="mt-6 bg-gradient-to-r from-[#195737] to-emerald-500 hover:from-[#0F4227] hover:to-emerald-600 hover:-translate-y-0.5 shadow-md shadow-[#16A34A]/20 hover:shadow-lg hover:shadow-[#16A34A]/30 transition-all duration-300"
            >
              <Plus className="w-4 h-4 mr-2" />
              Tambah Analisis
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Total Pelatihan" value={stats.totalPelatihan} subtitle={`${stats.totalAngkatan} angkatan`} icon={BookOpen} color="blue" trend={stats.trendPelatihan ?? undefined}} />
        <StatCard title="Total Peserta" value={stats.totalPeserta} subtitle={`${stats.totalAngkatan} angkatan`} icon={Users} color="green" />
        <StatCard title="Uji Kompetensi" value={stats.totalUjiKompetensi} subtitle={`${stats.ujiSelesai} selesai`} icon={Award} color="amber" />
        <StatCard title="Analisis Kebutuhan" value={stats.totalAnalisis} subtitle={`${stats.totalAsesor} asesor`} icon={ClipboardList} color="purple" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Pelatihan Berjalan" value={stats.pelatihanBerjalan} icon={Activity} color="blue" />
        <StatCard title="Angkatan Selesai" value={stats.angkatanSelesai} icon={CheckCircle2} color="green" />
        <StatCard title="Pendaftaran Portal" value={stats.pendaftaranPortal} subtitle={`${stats.pendaftaranMenunggu} menunggu`} icon={ArrowDownToLine} color="amber" />
        <StatCard title="Uji Kompetensi Selesai" value={stats.ujiSelesai} icon={FileCheck} color="green" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Pelatihan per bulan */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#0F4C81]" />
                Pelatihan per Bulan
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">12 Bulan Terakhir</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.grafikPelatihanPerBulan}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="bulan" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="jumlah" name="Jumlah Angkatan" fill="#0F4C81" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Kategori Pelatihan - Pie */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#198754]" />
              Kategori Pelatihan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={stats.grafikKategoriPelatihan}
                  dataKey="jumlah"
                  nameKey="kategori"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {stats.grafikKategoriPelatihan.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Peserta per Angkatan chart + Jadwal terdekat */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#0F4C81]" />
              Peserta per Angkatan Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stats.grafikPesertaPerAngkatan}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="nama" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="peserta" name="Jumlah Peserta" fill="#198754" radius={[4, 4, 0, 0]} maxBarSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Jadwal Terdekat */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0F4C81]" />
              Jadwal Terdekat
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-2 max-h-[260px] overflow-y-auto px-4 pb-4">
              {stats.jadwalTerdekat.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <Calendar className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-400">Belum ada jadwal mendatang</p>
                <p className="text-xs text-slate-300 mt-1">Jadwal pelatihan & uji kompetensi akan tampil di sini</p>
              </div>
              ) : stats.jadwalTerdekat.map((j, i) => {
                const isAngkatan = 'tanggalMulai' in j
                const tanggal = isAngkatan ? j.tanggalMulai : j.tanggalUji
                const nama = isAngkatan ? (j.pelatihan?.nama || j.namaAngkatan) : `Uji Kompetensi ${j.kode}`
                const tipe = isAngkatan ? 'Pelatihan' : 'Uji Kompetensi'
                return (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors border border-slate-100">
                    <div className="w-10 h-10 rounded-lg bg-[#0F4C81]/10 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-medium text-[#0F4C81] leading-none">{new Date(tanggal).toLocaleDateString('id-ID', { month: 'short' })}</span>
                      <span className="text-sm font-bold text-[#0F4C81] leading-none mt-0.5">{new Date(tanggal).getDate()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{nama}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="outline" className="text-[9px] py-0 h-4">{tipe}</Badge>
                        <span className="text-[11px] text-slate-400">
                          {isAngkatan && j.lokasi ? j.lokasi : (j as any).tempat || ''}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aktivitas Terbaru */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#0F4C81]" />
              Aktivitas Terbaru
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-[#0F4C81]">Lihat Semua</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {stats.aktivitasTerbaru.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <Activity className="w-7 h-7 text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-400">Belum ada aktivitas terbaru</p>
                <p className="text-xs text-slate-300 mt-1">Aktivitas pengguna akan tampil di sini</p>
              </div>
            ) : stats.aktivitasTerbaru.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  a.aksi.includes('LOGIN') ? 'bg-green-100 text-[#15803D]' :
                  a.aksi.includes('CREATE') ? 'bg-blue-100 text-blue-600' :
                  a.aksi.includes('UPDATE') ? 'bg-amber-100 text-amber-600' :
                  a.aksi.includes('DELETE') ? 'bg-red-100 text-red-600' :
                  'bg-slate-100 text-slate-600'
                }`}>
                  <Activity className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 truncate">{a.deskripsi}</p>
                  <p className="text-xs text-slate-400">
                    <span className="font-medium">{a.username}</span> · {a.modul}
                  </p>
                </div>
                <span className="text-xs text-slate-400 whitespace-nowrap">{formatDateTime(a.createdAt)}</span>
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
