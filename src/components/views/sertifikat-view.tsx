'use client'

import { useEffect, useState, useCallback } from 'react'
import { api, type PesertaAngkatanView } from '@/lib/api'
import type { Sertifikat, Angkatan } from '@/lib/types'
import { DataTable, PageHeader, type Column } from '@/components/shared/data-table'
import { formatTanggal, formatTanggalSingkat } from '@/components/shared/ui-helpers'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Download, Trash2, Plus, Save, X, FileText, Upload, Award, Eye, BookOpen, Users, CheckCircle2, Loader2 } from 'lucide-react'

export function SertifikatView() {
  return (
    <div className="space-y-4">
      <PageHeader title="Sertifikat Pelatihan" description="Kelola dan upload sertifikat pelatihan (PDF)" />
      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">Upload Manual</TabsTrigger>
          <TabsTrigger value="angkatan">Upload Per Angkatan</TabsTrigger>
        </TabsList>
        <TabsContent value="manual">
          <SertifikatDataTable jenis="PELATIHAN" />
        </TabsContent>
        <TabsContent value="angkatan">
          <SertifikatByAngkatan />
        </TabsContent>
      </Tabs>
    </div>
  )
}

interface FormState {
  namaPeserta: string
  namaKegiatan: string
  nomorSertifikat: string
  tanggalTerbit: string
  catatan: string
  file: File | null
}

const EMPTY_FORM: FormState = {
  namaPeserta: '',
  namaKegiatan: '',
  nomorSertifikat: '',
  tanggalTerbit: '',
  catatan: '',
  file: null,
}

function SertifikatDataTable({ jenis }: { jenis: string }) {
  const { toast } = useToast()
  const [data, setData] = useState<Sertifikat[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Sertifikat | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number | undefined> = { page, pageSize, search, jenis }
      const res = await api.sertifikat.list(params)
      setData(res.data)
      setTotal(res.total)
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, search, jenis, toast])

  useEffect(() => { fetchData() }, [fetchData])
  const handleSearch = (v: string) => { setSearch(v); setPage(1) }
  const openCreate = () => { setForm({ ...EMPTY_FORM }); setDialogOpen(true) }

  const handleSave = async () => {
    if (!form.namaPeserta || !form.namaKegiatan) { toast({ title: 'Validasi', description: 'Nama Peserta dan Nama Kegiatan wajib diisi', variant: 'destructive' }); return }
    if (!form.file) { toast({ title: 'Validasi', description: 'File sertifikat wajib diunggah', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('jenis', jenis)
      fd.append('namaPeserta', form.namaPeserta)
      fd.append('namaKegiatan', form.namaKegiatan)
      if (form.nomorSertifikat) fd.append('nomorSertifikat', form.nomorSertifikat)
      if (form.tanggalTerbit) fd.append('tanggalTerbit', form.tanggalTerbit)
      if (form.catatan) fd.append('catatan', form.catatan)
      fd.append('file', form.file)
      await api.sertifikat.create(fd)
      toast({ title: 'Berhasil', description: 'Sertifikat berhasil diunggah' })
      setDialogOpen(false)
      fetchData()
    } catch (e) {
      toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const handleDownload = (item: Sertifikat) => { api.sertifikat.downloadFile(item.id) }
  const handleView = (item: Sertifikat) => { api.sertifikat.viewFile(item.id) }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.sertifikat.remove(deleteTarget.id)
      toast({ title: 'Berhasil', description: 'Sertifikat dihapus' })
      setDeleteTarget(null)
      fetchData()
    } catch (e) { toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }) }
    finally { setDeleting(false) }
  }

  const columns: Column<Sertifikat>[] = [
    { key: 'namaPeserta', header: 'Nama Peserta', render: (r) => <div className="min-w-[180px]"><p className="font-medium text-slate-900 line-clamp-1">{r.namaPeserta || '-'}</p></div> },
    { key: 'namaKegiatan', header: 'Nama Kegiatan', render: (r) => <span className="text-sm text-slate-600 line-clamp-1">{r.namaKegiatan || '-'}</span> },
    { key: 'nomorSertifikat', header: 'No. Sertifikat', render: (r) => <span className="font-mono text-xs text-slate-600">{r.nomorSertifikat || '-'}</span> },
    { key: 'tanggalTerbit', header: 'Tanggal Terbit', render: (r) => <span className="text-xs text-slate-500">{formatTanggal(r.tanggalTerbit)}</span> },
    { key: 'ukuranFile', header: 'Ukuran File', render: (r) => <span className="text-xs text-slate-500 font-mono">{r.ukuranFile || '-'}</span> },
  ]

  return (
    <>
      <DataTable
        data={data} total={total} page={page} pageSize={pageSize} loading={loading} columns={columns}
        searchPlaceholder="Cari nama peserta / kegiatan..." searchValue={search} onSearchChange={handleSearch}
        onPageChange={setPage} onAdd={openCreate} addLabel="Upload Sertifikat" onRefresh={fetchData}
        rowKey={(r) => r.id} emptyMessage="Belum ada data sertifikat"
        actions={(row) => (
          <>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-[#0F4C81]" onClick={() => handleView(row)} title="Lihat"><Eye className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-[#0F4C81]" onClick={() => handleDownload(row)} title="Download"><Download className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-red-600" onClick={() => setDeleteTarget(row)} title="Hapus"><Trash2 className="w-4 h-4" /></Button>
          </>
        )}
      />
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Upload className="w-5 h-5 text-[#0F4C81]" /> Upload Sertifikat</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            <div className="sm:col-span-2 space-y-1.5"><Label>Jenis Sertifikat</Label><Input value={jenis === 'PELATIHAN' ? 'Pelatihan' : 'Uji Kompetensi'} disabled className="bg-slate-50" /></div>
            <div className="space-y-1.5"><Label>Nama Peserta <span className="text-red-500">*</span></Label><Input value={form.namaPeserta} onChange={(e) => setForm({ ...form, namaPeserta: e.target.value })} placeholder="Nama lengkap peserta" /></div>
            <div className="space-y-1.5"><Label>Nama Kegiatan <span className="text-red-500">*</span></Label><Input value={form.namaKegiatan} onChange={(e) => setForm({ ...form, namaKegiatan: e.target.value })} placeholder="Nama pelatihan" /></div>
            <div className="space-y-1.5"><Label>Nomor Sertifikat</Label><Input value={form.nomorSertifikat} onChange={(e) => setForm({ ...form, nomorSertifikat: e.target.value })} placeholder="Nomor sertifikat" /></div>
            <div className="space-y-1.5"><Label>Tanggal Terbit</Label><Input type="date" value={form.tanggalTerbit} onChange={(e) => setForm({ ...form, tanggalTerbit: e.target.value })} /></div>
            <div className="sm:col-span-2 space-y-1.5"><Label>Catatan</Label><Textarea value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} placeholder="Catatan tambahan (opsional)" rows={2} /></div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>File Sertifikat <span className="text-red-500">*</span></Label>
              <Input type="file" accept=".pdf,.jpg,.png" onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })} className="file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-[#0F4C81]/10 file:text-[#0F4C81] hover:file:bg-[#0F4C81]/20" />
              <p className="text-xs text-slate-400 mt-1">Format: PDF, JPG, PNG</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" disabled={saving}><X className="w-4 h-4" /> Batal</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving} className="bg-[#0F4C81] hover:bg-[#0a3a63]"><Save className="w-4 h-4" /> {saving ? 'Mengunggah...' : 'Upload'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle><AlertDialogDescription>Yakin ingin menghapus sertifikat <span className="font-semibold">{deleteTarget?.nomorSertifikat || deleteTarget?.namaPeserta}</span>? Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel><AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">{deleting ? 'Menghapus...' : 'Hapus'}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
function SertifikatByAngkatan() {
  const { toast } = useToast()
  const [angkatanList, setAngkatanList] = useState<Angkatan[]>([])
  const [selectedAngkatanId, setSelectedAngkatanId] = useState('')
  const [angkatanLoading, setAngkatanLoading] = useState(true)
  const [pesertaList, setPesertaList] = useState<PesertaAngkatanView[]>([])
  const [pesertaLoading, setPesertaLoading] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [sertifikatStatus, setSertifikatStatus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    api.angkatan.listAll().then(setAngkatanList).catch(() => toast({ title: 'Gagal', description: 'Gagal memuat daftar angkatan', variant: 'destructive' })).finally(() => setAngkatanLoading(false))
  }, [toast])

  useEffect(() => {
    if (!selectedAngkatanId) return
    setPesertaLoading(true)
    setSertifikatStatus({})
    api.angkatan.get(selectedAngkatanId).then((data) => { setPesertaList(data.peserta || []); checkSertifikatStatus(data.peserta || []) }).catch(() => toast({ title: 'Gagal', description: 'Gagal memuat peserta', variant: 'destructive' })).finally(() => setPesertaLoading(false))
  }, [selectedAngkatanId, toast])

  const checkSertifikatStatus = async (peserta: PesertaAngkatanView[]) => {
    const status: Record<string, boolean> = {}
    await Promise.all(peserta.map(async (p) => {
      try {
        const res = await fetch(`/api/sertifikat?search=${encodeURIComponent(p.peserta?.nama || '')}&pageSize=100`, { credentials: 'same-origin' })
        if (res.ok) {
          const data = await res.json()
          const existing = data.data?.find((s: Sertifikat) => s.pesertaId === p.pesertaId && s.angkatanId === selectedAngkatanId)
          status[p.pesertaId] = !!existing
        }
      } catch {}
    }))
    setSertifikatStatus(status)
  }

  const selectedAngkatan = angkatanList.find((a) => a.id === selectedAngkatanId) || null

  const handleUploadSertifikat = async (pesertaId: string, file: File) => {
    if (!selectedAngkatanId || !selectedAngkatan) return
    setUploadingId(pesertaId)
    try {
      const pa = pesertaList.find((p) => p.pesertaId === pesertaId)
      const pesertaName = pa?.peserta?.nama || ''
      const kegiatanName = selectedAngkatan.pelatihan?.nama || selectedAngkatan.namaAngkatan
      const fd = new FormData()
      fd.append('jenis', 'PELATIHAN')
      fd.append('angkatanId', selectedAngkatanId)
      fd.append('pesertaId', pesertaId)
      fd.append('namaPeserta', pesertaName)
      fd.append('namaKegiatan', kegiatanName)
      fd.append('file', file)
      await api.sertifikat.create(fd)
      toast({ title: 'Berhasil', description: `Sertifikat ${pesertaName} berhasil diupload` })
      setSertifikatStatus((prev) => ({ ...prev, [pesertaId]: true }))
    } catch (e) { toast({ title: 'Gagal', description: (e as Error).message, variant: 'destructive' }) }
    finally { setUploadingId(null) }
  }

  const handleDownloadSertifikat = async (pesertaId: string) => {
    try {
      const peserta = pesertaList.find(p => p.pesertaId === pesertaId)
      const res = await fetch(`/api/sertifikat?search=${encodeURIComponent(peserta?.peserta?.nama || '')}&pageSize=100`, { credentials: 'same-origin' })
      const data = await res.json()
      const sertif = data.data?.find((s: Sertifikat) => s.pesertaId === pesertaId && s.angkatanId === selectedAngkatanId)
      if (sertif) api.sertifikat.downloadFile(sertif.id)
      else toast({ title: 'Tidak ditemukan', description: 'Sertifikat belum diupload', variant: 'destructive' })
    } catch { toast({ title: 'Gagal', description: 'Gagal mencari sertifikat', variant: 'destructive' }) }
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="space-y-1.5">
            <Label>Pilih Pelatihan / Angkatan</Label>
            <Select value={selectedAngkatanId} onValueChange={setSelectedAngkatanId}>
              <SelectTrigger><SelectValue placeholder={angkatanLoading ? 'Memuat...' : 'Pilih pelatihan/angkatan...'} /></SelectTrigger>
              <SelectContent>
                {angkatanList.length === 0 ? (<SelectItem value="__none" disabled>Belum ada angkatan</SelectItem>) : (
                  angkatanList.map((a) => (<SelectItem key={a.id} value={a.id}>{a.pelatihan?.nama || 'Tanpa Pelatihan'} — {a.namaAngkatan}{a.status === 'SELESAI' ? ' (Selesai)' : a.status === 'BERJALAN' ? ' (Berjalan)' : ''}</SelectItem>))
                )}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!selectedAngkatanId ? (
        <Card className="border-slate-200 shadow-sm"><CardContent className="py-12 text-center text-slate-400"><BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-300" />Silakan pilih pelatihan/angkatan untuk melihat daftar peserta</CardContent></Card>
      ) : pesertaLoading ? (
        <Card className="border-slate-200 shadow-sm"><CardContent className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-[#0F4C81] mx-auto" /><p className="text-sm text-slate-400 mt-2">Memuat peserta...</p></CardContent></Card>
      ) : pesertaList.length === 0 ? (
        <Card className="border-slate-200 shadow-sm"><CardContent className="py-12 text-center text-slate-400"><Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />Belum ada peserta terdaftar di angkatan ini</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {selectedAngkatan && (
            <Card className="border-slate-200 shadow-sm"><CardContent className="p-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><div><p className="text-sm text-slate-500">Pelatihan Terpilih</p><p className="text-lg font-semibold text-slate-900">{selectedAngkatan.pelatihan?.nama || '-'}</p><p className="text-xs text-slate-400 font-mono">{selectedAngkatan.namaAngkatan} · {selectedAngkatan.pelatihan?.kode || '-'} · {formatTanggalSingkat(selectedAngkatan.tanggalMulai)} s/d {formatTanggalSingkat(selectedAngkatan.tanggalSelesai)}</p></div><Badge variant="outline" className="text-xs">{selectedAngkatan.status}</Badge></div></CardContent></Card>
          )}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2 border-b border-slate-100"><CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4 text-[#0F4C81]" /> Daftar Peserta<span className="text-xs font-normal text-slate-400 ml-2">— Upload sertifikat per peserta</span></CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                {pesertaList.map((pa, i) => {
                  const hasSertifikat = sertifikatStatus[pa.pesertaId]
                  const isUploading = uploadingId === pa.pesertaId
                  return (
                    <div key={pa.id} className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><span className="text-xs font-semibold text-slate-600">{i + 1}</span></div>
                        <div className="min-w-0"><p className="text-sm font-medium text-slate-900 truncate">{pa.peserta?.nama || '-'}</p><p className="text-xs text-slate-400 font-mono truncate">{pa.peserta?.nip || '-'}</p></div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hasSertifikat ? (
                          <>
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" /> Sudah ada</Badge>
                            <Button variant="outline" size="sm" onClick={() => handleDownloadSertifikat(pa.pesertaId)} className="h-8 w-8 p-0 text-[#0F4C81] border-[#0F4C81]/20 hover:bg-[#0F4C81]/5" title="Download"><Download className="w-3.5 h-3.5" /></Button>
                          </>
                        ) : (<Badge variant="outline" className="text-xs text-slate-400">Belum ada</Badge>)}
                        {isUploading ? (
                          <div className="flex items-center gap-1.5 text-xs text-[#0F4C81]"><Loader2 className="w-4 h-4 animate-spin" /><span className="hidden sm:inline">Uploading...</span></div>
                        ) : (
                          <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0F4C81] hover:bg-[#0a3a63] text-white text-xs font-medium transition-colors">
                            <Upload className="w-3.5 h-3.5" /><span className="hidden sm:inline">{hasSertifikat ? 'Ganti' : 'Upload'}</span>
                            <input type="file" accept=".pdf,.jpg,.png" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUploadSertifikat(pa.pesertaId, file); e.target.value = '' }} />
                          </label>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
