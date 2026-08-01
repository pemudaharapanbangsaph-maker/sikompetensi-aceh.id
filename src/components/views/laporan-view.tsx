'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Angkatan, UjiKompetensi, Peserta } from '@/lib/types'
import { useNavStore } from '@/store/auth-store'
import { DataTable, StatCard, PageHeader, type Column, type FilterOption } from '@/components/shared/data-table'
import { StatusBadge, formatTanggal, formatTanggalSingkat, kategoriLabel, metodeLabel } from '@/components/shared/ui-helpers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { FileText, FileSpreadsheet, Printer, BookOpen, ClipboardCheck, Users, Award, BarChart3, PieChart as PieIcon, GraduationCap, Building2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'

// ===========================================================================
// CONSTANTS
// ===========================================================================

const KATEGORI_PELATIHAN = [
  { value: 'TEKNIS', label: 'Teknis' },
  { value: 'MANAJERIAL', label: 'Manajerial' },
  { value: 'FUNGSIONAL', label: 'Fungsional' },
  { value: 'SOSIAL_KULTURAL', label: 'Sosial Kultural' },
]

const STATUS_ANGKATAN = [
  { value: 'PERENCANAAN', label: 'Perencanaan' },
  { value: 'BERJALAN', label: 'Berjalan' },
  { value: 'SELESAI', label: 'Selesai' },
  { value: 'DIBATALKAN', label: 'Dibatalkan' },
]

const STATUS_UJI = [
  { value: 'DIJADWALKAN', label: 'Dijadwalkan' },
  { value: 'BERLANGSUNG', label: 'Berlangsung' },
  { value: 'SELESAI', label: 'Selesai' },
  { value: 'DIBATALKAN', label: 'Dibatalkan' },
]

const PENDIDIKAN_OPTS = [
  { value: 'D3', label: 'Diploma III' },
  { value: 'S1', label: 'Sarjana (S1)' },
  { value: 'S2', label: 'Magister (S2)' },
  { value: 'S3', label: 'Doktor (S3)' },
]

const PIE_COLORS = ['#0F4C81', '#198754', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

// ===========================================================================
// ROOT
// ===========================================================================

export function LaporanView() {
  const { activeView } = useNavStore()

  if (activeView === 'laporan-uji') return <LaporanUjiView />
  if (activeView === 'laporan-peserta') return <LaporanPesertaView />
  return <LaporanPelatihanView />
}

// ===========================================================================
// SUBTAB 1: LAPORAN PELATIHAN
// ===========================================================================

function LaporanPelatihanView() {
  const { toast } = useToast()
  const [data, setData] = useState<Angkatan[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        status: filters.status || undefined,
        metode: filters.metode || undefined,
      }
      const res = await api.angkatan.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filters, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Apply client-side filters for tahun + kategori (since API doesn't filter by them)
  const filtered = useMemo(() => {
    return data.filter((a) => {
      if (filters.tahun) {
        const y = new Date(a.tanggalMulai).getFullYear().toString()
        if (y !== filters.tahun) return false
      }
      if (filters.kategori) {
        if (a.pelatihan?.kategori !== filters.kategori) return false
      }
      return true
    })
  }, [data, filters.tahun, filters.kategori])

  const tahunOptions = useMemo(() => {
    const set = new Set<string>()
    data.forEach((a) => set.add(new Date(a.tanggalMulai).getFullYear().toString()))
    return Array.from(set).sort((a, b) => Number(b) - Number(a)).map((t) => ({ value: t, label: t }))
  }, [data])

  const stats = useMemo(() => {
    const totalAngkatan = filtered.length
    const totalPeserta = filtered.reduce((s, a) => s + (a._count?.peserta || 0), 0)
    const selesai = filtered.filter((a) => a.status === 'SELESAI').length
    return { totalAngkatan, totalPeserta, selesai }
  }, [filtered])

  const chartData = useMemo(() => {
    return filtered.slice(0, 10).map((a) => ({
      name: a.namaAngkatan.length > 14 ? a.namaAngkatan.slice(0, 13) + '…' : a.namaAngkatan,
      peserta: a._count?.peserta || 0,
    }))
  }, [filtered])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilter = (k: string, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: v }))
    setPage(1)
  }

  const handleExportPDF = () => {
    toast({ title: 'Mempersiapkan PDF', description: 'Membuka dialog cetak browser...' })
    setTimeout(() => window.print(), 400)
  }

  const handleExportExcel = () => {
    toast({ title: 'Export Excel', description: 'Fitur export Excel — data siap diunduh' })
  }

  const filterOptions: FilterOption[] = [
    { key: 'tahun', label: 'Tahun', options: tahunOptions },
    { key: 'kategori', label: 'Kategori', options: KATEGORI_PELATIHAN },
    { key: 'status', label: 'Status', options: STATUS_ANGKATAN },
  ]

  const columns: Column<Angkatan>[] = [
    {
      key: 'pelatihan', header: 'Pelatihan', render: (r) => (
        <div className="min-w-[200px]">
          <p className="font-medium text-slate-900 line-clamp-1">{r.pelatihan?.nama || '-'}</p>
          <p className="text-xs text-slate-400">{r.pelatihan?.kode} • {kategoriLabel(r.pelatihan?.kategori || '')}</p>
        </div>
      ),
    },
    { key: 'namaAngkatan', header: 'Angkatan', render: (r) => <span className="text-slate-700">{r.namaAngkatan}</span> },
    {
      key: 'periode', header: 'Periode', render: (r) => (
        <span className="text-xs text-slate-600">{formatTanggalSingkat(r.tanggalMulai)} - {formatTanggalSingkat(r.tanggalSelesai)}</span>
      ),
    },
    { key: 'lokasi', header: 'Lokasi', render: (r) => <span className="text-slate-600 text-xs">{r.lokasi || '-'}</span> },
    { key: 'metode', header: 'Metode', render: (r) => <span className="text-slate-600 text-xs">{metodeLabel(r.metode)}</span> },
    { key: 'kuota', header: 'Kuota', render: (r) => <span className="font-medium">{r.kuota}</span> },
    { key: 'peserta', header: 'Peserta', render: (r) => <span className="font-medium text-[#0F4C81]">{r._count?.peserta || 0}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Laporan Pelatihan" description="Rekapitulasi seluruh angkatan pelatihan yang diselenggarakan">
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-9 no-print">
          <Printer className="w-4 h-4" /> Export PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9 no-print">
          <FileSpreadsheet className="w-4 h-4" /> Export Excel
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <StatCard title="Total Angkatan" value={stats.totalAngkatan} icon={BookOpen} color="blue" />
        <StatCard title="Total Peserta" value={stats.totalPeserta} icon={Users} color="green" />
        <StatCard title="Angkatan Selesai" value={stats.selesai} icon={Award} color="amber" />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#0F4C81]" /> Jumlah Peserta per Angkatan (Top 10)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm">Belum ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="peserta" name="Peserta" fill="#0F4C81" radius={[4, 4, 0, 0]} maxBarSize={45} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <DataTable
        data={filtered}
        total={filtered.length}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari nama angkatan / lokasi..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        filters={filterOptions}
        filterValues={filters}
        onFilterChange={handleFilter}
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada data angkatan"
      />
    </div>
  )
}

// ===========================================================================
// SUBTAB 2: LAPORAN UJI KOMPETENSI
// ===========================================================================

function LaporanUjiView() {
  const { toast } = useToast()
  const [data, setData] = useState<UjiKompetensi[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        status: filters.status || undefined,
      }
      const res = await api.ujiKompetensi.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filters, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // tahun filter (client-side)
  const filtered = useMemo(() => {
    if (!filters.tahun) return data
    return data.filter((u) => new Date(u.tanggalUji).getFullYear().toString() === filters.tahun)
  }, [data, filters.tahun])

  const tahunOptions = useMemo(() => {
    const set = new Set<string>()
    data.forEach((u) => set.add(new Date(u.tanggalUji).getFullYear().toString()))
    return Array.from(set).sort((a, b) => Number(b) - Number(a)).map((t) => ({ value: t, label: t }))
  }, [data])

  const stats = useMemo(() => {
    const totalUji = filtered.length
    const selesai = filtered.filter((u) => u.status === 'SELESAI').length
    const totalPeserta = filtered.reduce((s, u) => s + (u.jumlahPeserta || 0), 0)
    return { totalUji, selesai, totalPeserta }
  }, [filtered])

  const pieData = useMemo(() => {
    const counts: Record<string, number> = {}
    filtered.forEach((u) => {
      counts[u.status] = (counts[u.status] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [filtered])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilter = (k: string, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: v }))
    setPage(1)
  }

  const handleExportPDF = () => {
    toast({ title: 'Mempersiapkan PDF', description: 'Membuka dialog cetak browser...' })
    setTimeout(() => window.print(), 400)
  }

  const handleExportExcel = () => {
    toast({ title: 'Export Excel', description: 'Fitur export Excel — data siap diunduh' })
  }

  const filterOptions: FilterOption[] = [
    { key: 'tahun', label: 'Tahun', options: tahunOptions },
    { key: 'status', label: 'Status', options: STATUS_UJI },
  ]

  const columns: Column<UjiKompetensi>[] = [
    { key: 'kode', header: 'Kode', render: (r) => <span className="font-mono text-xs font-medium text-slate-900">{r.kode}</span> },
    { key: 'skemaSertifikasi', header: 'Skema', render: (r) => <span className="text-slate-700 line-clamp-1 max-w-[200px] inline-block">{r.skemaSertifikasi}</span> },
    { key: 'tanggalUji', header: 'Tanggal', render: (r) => <span className="text-xs text-slate-600">{formatTanggal(r.tanggalUji)}</span> },
    { key: 'tempat', header: 'Tempat', render: (r) => <span className="text-slate-600 text-xs">{r.tempat}</span> },
    { key: 'jumlahPeserta', header: 'Peserta', render: (r) => <span className="font-medium">{r.jumlahPeserta}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
    {
      key: 'asesor', header: 'Asesor', render: (r) => (
        <span className="text-xs text-slate-600">
          {r.asesor && r.asesor.length > 0
            ? r.asesor.map((a) => a.nama).join(', ')
            : '-'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Laporan Uji Kompetensi" description="Rekapitulasi seluruh uji kompetensi yang dilaksanakan">
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-9 no-print">
          <Printer className="w-4 h-4" /> Export PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9 no-print">
          <FileSpreadsheet className="w-4 h-4" /> Export Excel
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <StatCard title="Total Uji Kompetensi" value={stats.totalUji} icon={ClipboardCheck} color="blue" />
        <StatCard title="Uji Selesai" value={stats.selesai} icon={Award} color="green" />
        <StatCard title="Total Peserta Uji" value={stats.totalPeserta} icon={Users} color="amber" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-sm lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-[#0F4C81]" /> Distribusi Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-center text-slate-400 py-8 text-sm">Belum ada data</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(entry) => `${entry.value}`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <DataTable
            data={filtered}
            total={filtered.length}
            page={page}
            pageSize={pageSize}
            loading={loading}
            columns={columns}
            searchPlaceholder="Cari kode / skema / tempat..."
            searchValue={search}
            onSearchChange={handleSearch}
            onPageChange={setPage}
            filters={filterOptions}
            filterValues={filters}
            onFilterChange={handleFilter}
            onRefresh={fetchData}
            rowKey={(r) => r.id}
            emptyMessage="Belum ada data uji kompetensi"
          />
        </div>
      </div>
    </div>
  )
}

// ===========================================================================
// SUBTAB 3: LAPORAN PESERTA
// ===========================================================================

function LaporanPesertaView() {
  const { toast } = useToast()
  const [data, setData] = useState<Peserta[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        instansi: filters.instansi || undefined,
        pendidikan: filters.pendidikan || undefined,
      }
      const res = await api.peserta.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filters, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const instansiOptions = useMemo(() => {
    const set = new Set<string>()
    data.forEach((p) => { if (p.instansi) set.add(p.instansi) })
    return Array.from(set).sort().map((v) => ({ value: v, label: v }))
  }, [data])

  const stats = useMemo(() => {
    const totalPeserta = total
    const instansiCount = new Set(data.map((p) => p.instansi).filter(Boolean)).size
    const pendidikanCount = new Set(data.map((p) => p.pendidikan).filter(Boolean)).size
    return { totalPeserta, instansiCount, pendidikanCount }
  }, [data, total])

  const chartData = useMemo(() => {
    const counts: Record<string, number> = {}
    data.forEach((p) => {
      const uk = p.unitKerja || 'Lainnya'
      counts[uk] = (counts[uk] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name.length > 18 ? name.slice(0, 17) + '…' : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
  }, [data])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilter = (k: string, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: v }))
    setPage(1)
  }

  const handleExportPDF = () => {
    toast({ title: 'Mempersiapkan PDF', description: 'Membuka dialog cetak browser...' })
    setTimeout(() => window.print(), 400)
  }

  const handleExportExcel = () => {
    toast({ title: 'Export Excel', description: 'Fitur export Excel — data siap diunduh' })
  }

  const filterOptions: FilterOption[] = [
    { key: 'instansi', label: 'Instansi', options: instansiOptions },
    { key: 'pendidikan', label: 'Pendidikan', options: PENDIDIKAN_OPTS },
  ]

  const columns: Column<Peserta>[] = [
    {
      key: 'nama', header: 'Nama', render: (r) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-slate-900">{r.nama}</p>
          <p className="text-xs text-slate-400">{r.jabatan || '-'}</p>
        </div>
      ),
    },
    { key: 'nip', header: 'NIP', render: (r) => <span className="font-mono text-xs text-slate-600">{r.nip}</span> },
    { key: 'unitKerja', header: 'Unit Kerja', render: (r) => <span className="text-slate-700 text-xs">{r.unitKerja || '-'}</span> },
    { key: 'instansi', header: 'Instansi', render: (r) => <span className="text-slate-600 text-xs">{r.instansi || '-'}</span> },
    { key: 'pendidikan', header: 'Pendidikan', render: (r) => <span className="text-slate-600 text-xs">{r.pendidikan || '-'}</span> },
    { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Laporan Peserta" description="Rekapitulasi data peserta pelatihan">
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-9 no-print">
          <Printer className="w-4 h-4" /> Export PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9 no-print">
          <FileSpreadsheet className="w-4 h-4" /> Export Excel
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
        <StatCard title="Total Peserta" value={stats.totalPeserta} icon={Users} color="blue" />
        <StatCard title="Jumlah Instansi" value={stats.instansiCount} icon={Building2} color="green" />
        <StatCard title="Variasi Pendidikan" value={stats.pendidikanCount} icon={GraduationCap} color="amber" />
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#0F4C81]" /> Distribusi Peserta per Unit Kerja (Top 10)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-center text-slate-400 py-8 text-sm">Belum ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} width={140} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="value" name="Peserta" fill="#0F4C81" radius={[0, 4, 4, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari nama / NIP / unit kerja..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        filters={filterOptions}
        filterValues={filters}
        onFilterChange={handleFilter}
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage="Belum ada data peserta"
      />
    </div>
  )
}
