'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/data-table'
import { FileText, FileSpreadsheet, Loader2, Users, CalendarDays, MapPin } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

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
  nama: string
  nip: string
  instansi: string
}

export function DaftarHadirView() {
  const { toast } = useToast()
  const [angkatanOptions, setAngkatanOptions] = useState<AngkatanOption[]>([])
  const [selectedAngkatan, setSelectedAngkatan] = useState<string>('')
  const [selectedAngkatanData, setSelectedAngkatanData] = useState<AngkatanOption | null>(null)
  const [pesertaList, setPesertaList] = useState<PesertaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingExport, setLoadingExport] = useState<'pdf' | 'xls' | null>(null)

  // Fetch angkatan options
  useEffect(() => {
    async function fetchOptions() {
      try {
        const res = await fetch('/api/daftar-hadir/angkatan-options')
        if (res.ok) {
          const data = await res.json()
          setAngkatanOptions(data)
        }
      } catch {
        // silent
      }
    }
    fetchOptions()
  }, [])

  // Fetch peserta when angkatan changes
  const fetchPeserta = useCallback(async (angkatanId: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/daftar-hadir/peserta?angkatanId=${angkatanId}`)
      if (res.ok) {
        const data = await res.json()
        setPesertaList(data)
      } else {
        setPesertaList([])
      }
    } catch {
      setPesertaList([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (selectedAngkatan) {
      fetchPeserta(selectedAngkatan)
      const found = angkatanOptions.find((a) => a.id === selectedAngkatan)
      setSelectedAngkatanData(found || null)
    } else {
      setPesertaList([])
      setSelectedAngkatanData(null)
    }
  }, [selectedAngkatan, fetchPeserta, angkatanOptions])

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
        ? `daftar-hadir-${selectedAngkatanData?.namaPelatihan || 'peserta'}.pdf`
        : `daftar-hadir-${selectedAngkatanData?.namaPelatihan || 'peserta'}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast({ title: 'Berhasil', description: `Daftar hadir berhasil diexport ke ${format.toUpperCase()}` })
    } catch {
      toast({ title: 'Gagal', description: `Gagal export daftar hadir ke ${format.toUpperCase()}`, variant: 'destructive' })
    }
    setLoadingExport(null)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daftar Hadir Peserta"
        description="Cetak daftar hadir peserta per kegiatan pelatihan"
      />

      {/* Filter Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FilterIcon className="w-4 h-4" />
            Pilih Angkatan Pelatihan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
            <div className="flex-1 w-full sm:max-w-md">
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Angkatan</label>
              <Select value={selectedAngkatan} onValueChange={setSelectedAngkatan}>
                <SelectTrigger>
                  <SelectValue placeholder="-- Pilih Angkatan --" />
                </SelectTrigger>
                <SelectContent>
                  {angkatanOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleExport('pdf')}
                disabled={!selectedAngkatan || loadingExport !== null}
                className="bg-[#195737] hover:bg-[#0F4227] text-white gap-2"
              >
                {loadingExport === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Export PDF
              </Button>
              <Button
                onClick={() => handleExport('xls')}
                disabled={!selectedAngkatan || loadingExport !== null}
                variant="outline"
                className="gap-2 border-[#195737] text-[#195737] hover:bg-[#195737]/10"
              >
                {loadingExport === 'xls' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                Export Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card - when angkatan is selected */}
      {selectedAngkatanData && (
        <Card className="border-l-4 border-l-[#195737]">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <InfoItem icon={<FileText className="w-4 h-4" />} label="Pelatihan" value={selectedAngkatanData.namaPelatihan} />
              <InfoItem icon={<CalendarDays className="w-4 h-4" />} label="Periode" value={`${selectedAngkatanData.tanggalMulai} s.d ${selectedAngkatanData.tanggalSelesai}`} />
              <InfoItem icon={<MapPin className="w-4 h-4" />} label="Lokasi" value={selectedAngkatanData.lokasi || '-'} />
              <InfoItem icon={<Users className="w-4 h-4" />} label="Peserta" value={`${selectedAngkatanData.jumlahPeserta} orang`} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Peserta Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" />
            Daftar Peserta
            {selectedAngkatanData && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {pesertaList.length} peserta
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedAngkatan ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Pilih angkatan untuk melihat daftar peserta</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[#0F4C81]" />
            </div>
          ) : pesertaList.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Tidak ada peserta terdaftar pada angkatan ini</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="w-12 text-center">No</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>NIP</TableHead>
                    <TableHead>Instansi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pesertaList.map((p) => (
                    <TableRow key={p.nip}>
                      <TableCell className="text-center font-medium">{p.no}</TableCell>
                      <TableCell className="font-medium">{p.nama}</TableCell>
                      <TableCell className="text-slate-600 font-mono text-sm">{p.nip}</TableCell>
                      <TableCell className="text-slate-600">{p.instansi}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

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
