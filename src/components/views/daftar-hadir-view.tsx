'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/data-table'
import { FileText, FileSpreadsheet, Loader2, Users, CalendarDays, MapPin, Save, RotateCcw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ============ TYPES ============
interface AngkatanOption {
  id: string
  label: string
  namaAngkatan: string
  namaPelatihan: string
  kategori: string
  tanggalMulai: string
  tanggalSelesai: string
  lokasi: string
  jumlahPeserta: number
}

interface PesertaRow {
  no: number
  pesertaId: string
  nama: string
  nip: string
  instansi: string
}

interface KehadiranRecord {
  pesertaId: string
  tanggal: string
  statusKehadiran: string
  keterangan: string | null
}

// Status options cycle: H -> S -> I -> A -> -
const STATUS_CYCLE = ['HADIR', 'SAKIT', 'IZIN', 'ALPA', ''] as const
const STATUS_SHORT: Record<string, string> = {
  HADIR: 'H',
  SAKIT: 'S',
  IZIN: 'I',
  ALPA: 'A',
}
const STATUS_COLORS: Record<string, string> = {
  HADIR: 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200',
  SAKIT: 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200',
  IZIN: 'bg-sky-100 text-sky-800 border-sky-300 hover:bg-sky-200',
  ALPA: 'bg-red-100 text-red-800 border-red-300 hover:bg-red-200',
}
const EMPTY_CELL = 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'

// ============ HELPERS ============
function generateDates(start: string, end: string): string[] {
  const out: string[] = []
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return out
  const cur = new Date(s)
  while (cur <= e) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function formatDateShort(dateStr: string): string {
  const dt = new Date(dateStr + 'T00:00:00')
  return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatDateHeader(dateStr: string): { day: string; date: string } {
  const dt = new Date(dateStr + 'T00:00:00')
  return {
    day: dt.toLocaleDateString('id-ID', { weekday: 'short' }),
    date: String(dt.getDate()),
  }
}

// ============ MAIN COMPONENT ============
export function DaftarHadirView() {
  const { toast } = useToast()
  const [angkatanOptions, setAngkatanOptions] = useState<AngkatanOption[]>([])
  const [selectedAngkatan, setSelectedAngkatan] = useState<string>('')
  const [selectedAngkatanData, setSelectedAngkatanData] = useState<AngkatanOption | null>(null)
  const [pesertaList, setPesertaList] = useState<PesertaRow[]>([])
  const [dates, setDates] = useState<string[]>([])
  const [kehadiranMap, setKehadiranMap] = useState<Record<string, string>>({}) // "pesertaId_tanggal" -> status
  const [loading, setLoading] = useState(false)
  const [loadingExport, setLoadingExport] = useState<'pdf' | 'xls' | null>(null)
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const matrixRef = useRef<HTMLDivElement>(null)

  // Fetch angkatan options
  useEffect(() => {
    async function fetchOptions() {
      try {
        const res = await fetch('/api/daftar-hadir/angkatan-options')
        if (res.ok) setAngkatanOptions(await res.json())
      } catch { /* silent */ }
    }
    fetchOptions()
  }, [])

  // Fetch peserta + existing kehadiran when angkatan changes
  const fetchMatrix = useCallback(async (angkatanId: string) => {
    setLoading(true)
    setHasChanges(false)
    try {
      const [pesertaRes, kehadiranRes] = await Promise.all([
        fetch(`/api/daftar-hadir/peserta?angkatanId=${angkatanId}`),
        fetch(`/api/angkatan/${angkatanId}/kehadiran`),
      ])
      
      const peserta = pesertaRes.ok ? await pesertaRes.json() : []
      setPesertaList(peserta)

      if (kehadiranRes.ok) {
        const kehadiranData: KehadiranRecord[] = await kehadiranRes.json()
        const map: Record<string, string> = {}
        for (const rec of kehadiranData) {
          const key = `${rec.pesertaId}_${rec.tanggal.toISOString().slice(0, 10)}`
          map[key] = rec.statusKehadiran
        }
        setKehadiranMap(map)
      } else {
        setKehadiranMap({})
      }

      // Generate date range
      const found = angkatanOptions.find((a) => a.id === angkatanId)
      if (found) {
        setSelectedAngkatanData(found)
        setDates(generateDates(found.tanggalMulai, found.tanggalSelesai))
      }
    } catch {
      setPesertaList([])
      setKehadiranMap({})
      setDates([])
    }
    setLoading(false)
  }, [angkatanOptions])

  useEffect(() => {
    if (selectedAngkatan) {
      fetchMatrix(selectedAngkatan)
    } else {
      setPesertaList([])
      setKehadiranMap({})
      setDates([])
      setSelectedAngkatanData(null)
    }
  }, [selectedAngkatan, fetchMatrix])

  // Cycle status on click
  function handleCellClick(pesertaId: string, tanggal: string) {
    setHasChanges(true)
    const key = `${pesertaId}_${tanggal}`
    setKehadiranMap((prev) => {
      const current = prev[key] || ''
      const idx = STATUS_CYCLE.indexOf(current as typeof STATUS_CYCLE[number])
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
 const nextMap = { ...prev }
      if (next) {
        nextMap[key] = next
      } else {
        delete nextMap[key]
      }
      return nextMap
    })
  }

  // Save matrix
  async function handleSave() {
    if (!selectedAngkatan) return
    setSaving(true)
    try {
      const items = Object.entries(kehadiranMap).map(([key, status]) => {
        const [pesertaId, tanggal] = key.split('_')
        return { pesertaId, tanggal, statusKehadiran: status }
      })

      const res = await fetch('/api/daftar-hadir/kehadiran/batch', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ angkatanId: selectedAngkatan, items }),
      })

      if (res.ok) {
        setHasChanges(false)
        const data = await res.json()
        toast({ title: 'Berhasil', description: `Kehadiran tersimpan (${data.count} data)` })
      } else {
        toast({ title: 'Gagal', description: 'Gagal menyimpan kehadiran', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Gagal', description: 'Gagal menyimpan kehadiran', variant: 'destructive' })
    }
    setSaving(false)
  }

  // Fill all as HADIR
  function handleFillAll() {
    setHasChanges(true)
    const newMap: Record<string, string> = {}
    for (const p of pesertaList) {
      for (const d of dates) {
        newMap[`${p.pesertaId}_${d}`] = 'HADIR'
      }
    }
    setKehadiranMap(newMap)
  }

  // Clear all
  function handleClearAll() {
    setHasChanges(true)
    setKehadiranMap({})
  }

  // Export handlers
  async function handleExport(format: 'pdf' | 'xls') {
    if (!selectedAngkatan) {
      toast({ title: 'Perhatian', description: 'Pilih angkatan terlebih dahulu', variant: 'destructive' })
      return
    }
    setLoadingExport(format)
    try {
      const res = await fetch(`/api/daftar-hadir/export/${format}?angkatanId=${selectedAngkatan}`)
      if (!res.ok) throw new Error('Export gagal')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = format === 'pdf'
        ? `rekap-kehadiran-${selectedAngkatanData?.namaPelatihan || 'peserta'}.pdf`
        : `rekap-kehadiran-${selectedAngkatanData?.namaPelatihan || 'peserta'}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'Berhasil', description: `Export ${format.toUpperCase()} berhasil` })
    } catch {
      toast({ title: 'Gagal', description: `Gagal export ${format.toUpperCase()}`, variant: 'destructive' })
    }
    setLoadingExport(null)
  }

  // Count stats
  function getStats() {
    let h = 0, s = 0, i = 0, a = 0, empty = 0
    for (const p of pesertaList) {
      for (const d of dates) {
        const st = kehadiranMap[`${p.pesertaId}_${d}`]
        if (st === 'HADIR') h++
        else if (st === 'SAKIT') s++
        else if (st === 'IZIN') i++
        else if (st === 'ALPA') a++
        else empty++
      }
    }
    return { h, s, i, a, empty, total: h + s + i + a }
  }

  const stats = pesertaList.length > 0 && dates.length > 0 ? getStats() : null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Kehadiran Peserta"
        description="Isi matrix kehadiran, lalu export ke PDF atau Excel"
      />

      {/* Filter Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FilterIcon className="w-4 h-4" />
            Pilih Angkatan Pelatihan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Angkatan</label>
            <Select value={selectedAngkatan} onValueChange={setSelectedAngkatan}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="-- Pilih Angkatan --" />
              </SelectTrigger>
              <SelectContent>
                {angkatanOptions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="line-clamp-1">{a.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info when selected */}
          {selectedAngkatanData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
              <InfoItem icon={<FileText className="w-4 h-4" />} label="Pelatihan" value={selectedAngkatanData.namaPelatihan} />
              <InfoItem icon={<CalendarDays className="w-4 h-4" />} label="Periode" value={`${selectedAngkatanData.tanggalMulai} s.d ${selectedAngkatanData.tanggalSelesai}`} />
              <InfoItem icon={<MapPin className="w-4 h-4" />} label="Lokasi" value={selectedAngkatanData.lokasi || '-'} />
              <InfoItem icon={<Users className="w-4 h-4" />} label="Peserta" value={`${selectedAngkatanData.jumlahPeserta} orang`} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Matrix Card */}
      {selectedAngkatan && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                Matrix Kehadiran
                {dates.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {dates.length} hari
                  </Badge>
                )}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleFillAll} disabled={saving || pesertaList.length === 0}>
                  <Users className="w-3.5 h-3.5 mr-1" /> Semua Hadir
                </Button>
                <Button size="sm" variant="outline" onClick={handleClearAll} disabled={saving || pesertaList.length === 0}>
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-[#0F4C81]" />
              </div>
            ) : pesertaList.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Tidak ada peserta pada angkatan ini</p>
              </div>
            ) : (
              <>
                {/* Legend */}
                <div className="flex flex-wrap gap-4 mb-4 text-xs">
                  <LegendItem code="H" label="Hadir" color="bg-emerald-500" />
                  <LegendItem code="S" label="Sakit" color="bg-amber-500" />
                  <LegendItem code="I" label="Izin" color="bg-sky-500" />
                  <LegendItem code="A" label="Alpa" color="bg-red-500" />
                  <span className="text-slate-400">Klik sel untuk mengubah status</span>
                </div>

                {/* Matrix Table */}
                <div ref={matrixRef} className="overflow-auto max-h-[500px] border border-slate-200 rounded-lg">
                  <table className="w-full border-collapse text-xs min-w-[600px]">
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#0F4C81] text-white">
                        <th className="px-2 py-2 text-center w-10 border-r border-white/20">No</th>
                        <th className="px-2 py-2 text-left min-w-[140px] border-r border-white/20">Nama Peserta</th>
                        <th className="px-2 py-2 text-left min-w-[100px] border-r border-white/20">NIP</th>
                        {dates.map((d) => {
                          const { day, date } = formatDateHeader(d)
                          return (
                            <th key={d} className="px-1 py-2 text-center min-w-[36px] border-r border-white/20 last:border-r-0">
                              <div className="font-normal text-[10px] opacity-80">{day}</div>
                              <div className="font-bold text-sm">{date}</div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {pesertaList.map((p, rowIdx) => (
                        <tr key={p.pesertaId} className={rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                          <td className="px-2 py-1.5 text-center text-slate-500 border-r border-slate-100 font-medium">
                            {p.no}
                          </td>
                          <td className="px-2 py-1.5 text-left border-r border-slate-100 font-medium text-slate-800">
                            <div className="line-clamp-1">{p.nama}</div>
                          </td>
                          <td className="px-2 py-1.5 text-left border-r border-slate-100 text-slate-500 font-mono">
                            {p.nip}
                          </td>
                          {dates.map((d) => {
                            const key = `${p.pesertaId}_${d}`
                            const status = kehadiranMap[key] || ''
                            const shortCode = STATUS_SHORT[status] || ''
                            const colorClass = status ? STATUS_COLORS[status] : EMPTY_CELL
                            return (
                              <td key={d} className="px-0.5 py-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleCellClick(p.pesertaId, d)}
                                  className={`w-full h-8 rounded text-xs font-bold border transition-colors ${colorClass}`}
                                  title={`${p.nama} — ${formatDateShort(d)}: ${status || 'Belum diisi'}`}
                                >
                                  {shortCode || '—'}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Stats Bar */}
                {stats && (
                  <div className="flex flex-wrap items-center gap-4 mt-4 text-xs text-slate-600">
                    <span className="font-medium">Ringkasan:</span>
                    <StatBadge label="Hadir" count={stats.h} color="bg-emerald-100 text-emerald-700" />
                    <StatBadge label="Sakit" count={stats.s} color="bg-amber-100 text-amber-700" />
                    <StatBadge label="Izin" count={stats.i} color="bg-sky-100 text-sky-700" />
                    <StatBadge label="Alpa" count={stats.a} color="bg-red-100 text-red-700" />
                    <StatBadge label="Belum" count={stats.empty} color="bg-slate-100 text-slate-500" />
                    {hasChanges && (
                      <span className="ml-auto text-amber-600 font-medium animate-pulse">
                        Ada perubahan belum disimpan
                      </span>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-slate-200">
                  <Button
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    className="bg-[#195737] hover:bg-[#0F4227] text-white gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {hasChanges ? 'Simpan Kehadiran' : 'Tersimpan'}
                  </Button>

                  <div className="flex-1" />

                  <Button
                    onClick={() => handleExport('pdf')}
                    disabled={loadingExport !== null}
                    className="bg-[#0F4C81] hover:bg-[#0a3a63] text-white gap-2"
                  >
                    {loadingExport === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    Export PDF
                  </Button>
                  <Button
                    onClick={() => handleExport('xls')}
                    disabled={loadingExport !== null}
                    variant="outline"
                    className="gap-2 border-[#0F4C81] text-[#0F4C81] hover:bg-[#0F4C81]/10"
                  >
                    {loadingExport === 'xls' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                    Export Excel
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============ SUB COMPONENTS ============
function FilterIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 text-[#195737]">{icon}</div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  )
}

function LegendItem({ code, label, color }: { code: string; label: string; color: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`w-3 h-3 rounded ${color}`} />
      <span>{code} = {label}</span>
    </span>
  )
}

function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  if (count === 0) return null
  return (
    <span className={`px-2 py-0.5 rounded-full font-medium ${color}`}>
      {label}: {count}
    </span>
  )
}
