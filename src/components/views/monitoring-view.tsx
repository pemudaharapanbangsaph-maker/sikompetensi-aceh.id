'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { api } from '@/lib/api'
import type { Evaluasi, Peserta, Angkatan } from '@/lib/types'
import { useNavStore } from '@/store/auth-store'
import { DataTable, StatCard, PageHeader, type Column, type FilterOption } from '@/components/shared/data-table'
import { formatDateTime } from '@/components/shared/ui-helpers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Save, X, Trash2, ClipboardCheck, TrendingUp, Award, ArrowDown, ArrowUp, BarChart3 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// ===========================================================================
// CONSTANTS
// ===========================================================================

const JENIS_EVALUASI_LABEL: Record<string, string> = {
  PRE_TEST: 'Pre-Test',
  POST_TEST: 'Post-Test',
  KUESIONER: 'Kuesioner',
}

const ASPEK_OPTIONS = [
  { value: 'PENYELENGGARAAN', label: 'Penyelenggaraan' },
  { value: 'MATERI', label: 'Materi' },
  { value: 'PEMBICARA', label: 'Pembicara' },
  { value: 'SARANA', label: 'Sarana' },
]

const ASPEK_LABEL: Record<string, string> = {
  PENYELENGGARAAN: 'Penyelenggaraan',
  MATERI: 'Materi',
  PEMBICARA: 'Pembicara',
  SARANA: 'Sarana',
}

// ===========================================================================
// ROOT
// ===========================================================================

export function MonitoringView() {
  const { activeView } = useNavStore()

  if (activeView === 'monitoring-posttest') return <EvaluasiDataTable jenisEvaluasi="POST_TEST" />
  if (activeView === 'monitoring-kuesioner') return <EvaluasiDataTable jenisEvaluasi="KUESIONER" showAspek />
  if (activeView === 'monitoring-rekap') return <MonitoringRekapView />
  return <EvaluasiDataTable jenisEvaluasi="PRE_TEST" />
}

// ===========================================================================
// SUBTAB 1-3: DATA TABLE PER JENIS EVALUASI
// ===========================================================================

interface DataTableProps {
  jenisEvaluasi: 'PRE_TEST' | 'POST_TEST' | 'KUESIONER'
  showAspek?: boolean
}

function EvaluasiDataTable({ jenisEvaluasi, showAspek }: DataTableProps) {
  const { toast } = useToast()

  const [data, setData] = useState<Evaluasi[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [pesertaList, setPesertaList] = useState<Peserta[]>([])
  const [angkatanList, setAngkatanList] = useState<Angkatan[]>([])

  // dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Partial<Evaluasi>>(defaultForm(jenisEvaluasi))
  const [saving, setSaving] = useState(false)

  // delete state
  const [deleteTarget, setDeleteTarget] = useState<Evaluasi | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = {
        page, pageSize, search,
        jenisEvaluasi,
        angkatanId: filters.angkatanId || undefined,
      }
      const res = await api.evaluasi.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, filters, jenisEvaluasi, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [p, a] = await Promise.all([api.peserta.listAll(), api.angkatan.listAll()])
        if (!cancelled) {
          setPesertaList(p)
          setAngkatanList(a)
        }
      } catch {
        /* ignore */
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const handleFilter = (k: string, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: v }))
    setPage(1)
  }

  const openCreate = () => {
    setForm(defaultForm(jenisEvaluasi))
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.pesertaId || !form.angkatanId) {
      toast({ title: 'Validasi', description: 'Peserta dan Angkatan wajib dipilih', variant: 'destructive' })
      return
    }
    if (form.nilai === undefined || form.nilai === null || Number(form.nilai) < 0 || Number(form.nilai) > 100) {
      toast({ title: 'Validasi', description: 'Nilai harus antara 0 - 100', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      await api.evaluasi.create({
        jenisEvaluasi,
        pesertaId: form.pesertaId,
        angkatanId: form.angkatanId,
        nilai: Number(form.nilai),
        aspek: showAspek ? form.aspek || 'PENYELENGGARAAN' : null,
        catatan: form.catatan || null,
      })
      toast({ title: 'Berhasil', description: `Nilai ${JENIS_EVALUASI_LABEL[jenisEvaluasi]} berhasil disimpan` })
      setDialogOpen(false)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.evaluasi.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Data evaluasi dihapus' })
      setDeleteTarget(null)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  // ===== StatCards computation =====
  const stats = useMemo(() => {
    if (data.length === 0) return { avg: 0, count: 0, max: 0, min: 0 }
    const nilai = data.map((d) => Number(d.nilai) || 0)
    const sum = nilai.reduce((s, n) => s + n, 0)
    return {
      avg: Math.round((sum / nilai.length) * 100) / 100,
      count: total,
      max: Math.max(...nilai),
      min: Math.min(...nilai),
    }
  }, [data, total])

  const filterOptions: FilterOption[] = [
    {
      key: 'angkatanId',
      label: 'Angkatan',
      options: angkatanList.map((a) => ({ value: a.id, label: a.namaAngkatan })),
    },
  ]

  const columns: Column<Evaluasi>[] = [
    {
      key: 'peserta', header: 'Peserta', render: (r) => (
        <div className="min-w-[180px]">
          <p className="font-medium text-slate-900">{r.peserta?.nama || '-'}</p>
          <p className="text-xs text-slate-400">{r.peserta?.nip || ''}</p>
        </div>
      ),
    },
    {
      key: 'angkatan', header: 'Angkatan', render: (r) => (
        <div className="min-w-[160px]">
          <p className="text-slate-700 line-clamp-1">{r.angkatan?.namaAngkatan || '-'}</p>
          <p className="text-xs text-slate-400 line-clamp-1">{r.angkatan?.pelatihan?.nama || ''}</p>
        </div>
      ),
    },
    ...(showAspek ? [{
      key: 'aspek', header: 'Aspek',
      render: (r: Evaluasi) => <span className="text-slate-600 text-xs">{r.aspek ? ASPEK_LABEL[r.aspek] || r.aspek : '-'}</span>,
    }] : []),
    {
      key: 'nilai', header: 'Nilai', render: (r) => {
        const v = Number(r.nilai) || 0
        const color = v >= 80 ? 'text-green-700' : v >= 60 ? 'text-amber-700' : 'text-red-700'
        return <span className={`font-bold ${color}`}>{v}</span>
      },
    },
    { key: 'catatan', header: 'Catatan', render: (r) => <span className="text-slate-500 text-xs line-clamp-1 max-w-[200px] inline-block">{r.catatan || '-'}</span> },
    { key: 'createdAt', header: 'Diinput', render: (r) => <span className="text-xs text-slate-500">{formatDateTime(r.createdAt)}</span> },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Monitoring & Evaluasi ${JENIS_EVALUASI_LABEL[jenisEvaluasi]}`}
        description={`Kelola data nilai ${JENIS_EVALUASI_LABEL[jenisEvaluasi].toLowerCase()} peserta pelatihan`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title={`Rata-rata ${JENIS_EVALUASI_LABEL[jenisEvaluasi]}`} value={stats.avg} icon={TrendingUp} color="blue" />
        <StatCard title="Jumlah Evaluasi" value={stats.count} icon={ClipboardCheck} color="slate" />
        <StatCard title="Nilai Tertinggi" value={stats.max} icon={Award} color="green" />
        <StatCard title="Nilai Terendah" value={stats.min} icon={ArrowDown} color="amber" />
      </div>

      <DataTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        loading={loading}
        columns={columns}
        searchPlaceholder="Cari catatan / aspek..."
        searchValue={search}
        onSearchChange={handleSearch}
        onPageChange={setPage}
        filters={filterOptions}
        filterValues={filters}
        onFilterChange={handleFilter}
        onAdd={openCreate}
        addLabel="Input Nilai"
        onRefresh={fetchData}
        rowKey={(r) => r.id}
        emptyMessage={`Belum ada data nilai ${JENIS_EVALUASI_LABEL[jenisEvaluasi]}`}
        actions={(row) => (
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-red-600" onClick={() => setDeleteTarget(row)} title="Hapus">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      />

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Input Nilai {JENIS_EVALUASI_LABEL[jenisEvaluasi]}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Peserta <span className="text-red-500">*</span></Label>
              <Select value={form.pesertaId || 'none'} onValueChange={(v) => setForm({ ...form, pesertaId: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih peserta" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">— Pilih peserta —</SelectItem>
                  {pesertaList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.nama} {p.nip ? `(${p.nip})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Angkatan <span className="text-red-500">*</span></Label>
              <Select value={form.angkatanId || 'none'} onValueChange={(v) => setForm({ ...form, angkatanId: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Pilih angkatan" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">— Pilih angkatan —</SelectItem>
                  {angkatanList.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.namaAngkatan} {a.pelatihan ? `- ${a.pelatihan.nama}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showAspek && (
              <div className="space-y-1.5">
                <Label>Aspek yang Dinilai <span className="text-red-500">*</span></Label>
                <Select value={form.aspek || 'PENYELENGGARAAN'} onValueChange={(v) => setForm({ ...form, aspek: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ASPEK_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Nilai (0 - 100) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.nilai ?? ''}
                onChange={(e) => setForm({ ...form, nilai: parseInt(e.target.value, 10) || 0 })}
                placeholder="Contoh: 85"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Catatan</Label>
              <Textarea rows={3} value={form.catatan || ''} onChange={(e) => setForm({ ...form, catatan: e.target.value })} placeholder="Catatan tambahan (opsional)..." />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={saving}><X className="w-4 h-4" /> Batal</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63]">
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Yakin ingin menghapus data evaluasi <span className="font-semibold">{deleteTarget?.peserta?.nama || 'ini'}</span>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleting ? 'Menghapus...' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function defaultForm(jenisEvaluasi: string): Partial<Evaluasi> {
  return {
    jenisEvaluasi,
    pesertaId: null,
    angkatanId: null,
    aspek: jenisEvaluasi === 'KUESIONER' ? 'PENYELENGGARAAN' : null,
    nilai: 0,
    catatan: '',
  }
}

// ===========================================================================
// SUBTAB 4: REKAP
// ===========================================================================

interface RekapRow {
  id: string
  namaAngkatan: string
  pelatihan: string | null
  avgPreTest: number
  avgPostTest: number
  avgKuesioner: number
  improvement: number
  jumlahPreTest: number
  jumlahPostTest: number
  jumlahKuesioner: number
}

function MonitoringRekapView() {
  const { toast } = useToast()
  const [rows, setRows] = useState<RekapRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const r = await api.evaluasi.rekap()
        if (!cancelled) setRows(r as RekapRow[])
      } catch (e) {
        if (!cancelled) toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [toast])

  const stats = useMemo(() => {
    if (rows.length === 0) return { avgPre: 0, avgPost: 0, improvement: 0, avgKues: 0 }
    const totalPre = rows.reduce((s, r) => s + r.avgPreTest, 0)
    const totalPost = rows.reduce((s, r) => s + r.avgPostTest, 0)
    const totalKues = rows.reduce((s, r) => s + r.avgKuesioner, 0)
    const avgPre = Math.round((totalPre / rows.length) * 100) / 100
    const avgPost = Math.round((totalPost / rows.length) * 100) / 100
    const improvement = avgPre > 0 ? Math.round(((avgPost - avgPre) / avgPre) * 1000) / 10 : 0
    return {
      avgPre,
      avgPost,
      improvement,
      avgKues: Math.round((totalKues / rows.length) * 100) / 100,
    }
  }, [rows])

  const chartData = useMemo(
    () => rows.map((r) => ({
      name: r.namaAngkatan.length > 15 ? r.namaAngkatan.slice(0, 14) + '…' : r.namaAngkatan,
      'Pre-Test': r.avgPreTest,
      'Post-Test': r.avgPostTest,
    })),
    [rows]
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rekap Monitoring & Evaluasi"
        description="Rekapitulasi nilai pre-test, post-test, dan kuesioner per angkatan"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard title="Rata-rata Pre-Test" value={stats.avgPre} icon={TrendingUp} color="amber" />
        <StatCard title="Rata-rata Post-Test" value={stats.avgPost} icon={TrendingUp} color="blue" />
        <StatCard
          title="Peningkatan"
          value={`${stats.improvement}%`}
          icon={stats.improvement >= 0 ? ArrowUp : ArrowDown}
          color={stats.improvement >= 0 ? 'green' : 'red'}
        />
        <StatCard title="Rata-rata Kuesioner" value={stats.avgKues} icon={ClipboardCheck} color="purple" />
      </div>

      {loading ? (
        <Card className="border-slate-200 shadow-sm animate-pulse"><CardContent className="p-5 h-72 bg-slate-100 rounded-xl" /></Card>
      ) : rows.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-400">Belum ada data evaluasi untuk direkap</CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#0F4C81]" /> Perbandingan Pre-Test vs Post-Test per Angkatan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} cursor={{ fill: '#f8fafc' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Pre-Test" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Post-Test" fill="#0F4C81" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-[#0F4C81]" /> Tabel Rekap per Angkatan
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-y border-slate-200">
                    <tr>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Angkatan</th>
                      <th className="text-left text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Pelatihan</th>
                      <th className="text-right text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Avg Pre-Test</th>
                      <th className="text-right text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Avg Post-Test</th>
                      <th className="text-right text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Peningkatan</th>
                      <th className="text-right text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Avg Kuesioner</th>
                      <th className="text-right text-xs font-semibold text-slate-600 uppercase px-4 py-2.5">Jumlah Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-medium text-slate-900">{r.namaAngkatan}</td>
                        <td className="px-4 py-2.5 text-slate-600 text-xs">{r.pelatihan || '-'}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-amber-700">{r.avgPreTest || '-'}</td>
                        <td className="px-4 py-2.5 text-right font-medium text-[#0F4C81]">{r.avgPostTest || '-'}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`inline-flex items-center gap-0.5 font-semibold ${r.improvement >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                            {r.improvement >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                            {r.improvement}%
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-700">{r.avgKuesioner || '-'}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-slate-500">
                          {r.jumlahPreTest + r.jumlahPostTest + r.jumlahKuesioner}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
