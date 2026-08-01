'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function StatusBadge({ status, map }: { status: string; map?: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }> }) {
  const defaultMap: Record<string, { label: string; variant: string }> = {
    AKTIF: { label: 'Aktif', variant: 'success' },
    NONAKTIF: { label: 'Nonaktif', variant: 'secondary' },
    LULUS: { label: 'Lulus', variant: 'success' },
    TIDAK_LULUS: { label: 'Tidak Lulus', variant: 'destructive' },
    BELUM: { label: 'Belum', variant: 'secondary' },
    TERDAFTAR: { label: 'Terdaftar', variant: 'secondary' },
    DROP_OUT: { label: 'Drop Out', variant: 'destructive' },
    PERENCANAAN: { label: 'Perencanaan', variant: 'warning' },
    BERJALAN: { label: 'Berjalan', variant: 'info' },
    SELESAI: { label: 'Selesai', variant: 'success' },
    DIBATALKAN: { label: 'Dibatalkan', variant: 'destructive' },
    DIJADWALKAN: { label: 'Dijadwalkan', variant: 'warning' },
    BERLANGSUNG: { label: 'Berlangsung', variant: 'info' },
    DRAFT: { label: 'Draft', variant: 'secondary' },
    DISETUJUI: { label: 'Disetujui', variant: 'success' },
    DITOLAK: { label: 'Ditolak', variant: 'destructive' },
    BERHASIL: { label: 'Berhasil', variant: 'success' },
    GAGAL: { label: 'Gagal', variant: 'destructive' },
  }
  const useMap = map || defaultMap
  const item = useMap[status] || { label: status, variant: 'secondary' }
  const variantClass: Record<string, string> = {
    success: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100',
    warning: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100',
    info: 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100',
    destructive: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100',
    secondary: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100',
    default: '',
    outline: '',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', variantClass[item.variant] || variantClass.secondary)}>
      {item.label}
    </span>
  )
}

export function formatTanggal(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function formatTanggalSingkat(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function kategoriLabel(kategori: string): string {
  const map: Record<string, string> = {
    TEKNIS: 'Teknis',
    MANAJERIAL: 'Manajerial',
    FUNGSIONAL: 'Fungsional',
    SOSIAL_KULTURAL: 'Sosial Kultural',
  }
  return map[kategori] || kategori
}

export function metodeLabel(metode: string): string {
  const map: Record<string, string> = {
    TATAP_MUKA: 'Tatap Muka',
    DARING: 'Daring',
    BLENDED: 'Blended',
  }
  return map[metode] || metode
}

export function prioritasLabel(p: string): string {
  const map: Record<string, { label: string; class: string }> = {
    URGENT: { label: 'Urgent', class: 'bg-red-100 text-red-700 border-red-200' },
    TINGGI: { label: 'Tinggi', class: 'bg-orange-100 text-orange-700 border-orange-200' },
    NORMAL: { label: 'Normal', class: 'bg-blue-100 text-blue-700 border-blue-200' },
    RENDAH: { label: 'Rendah', class: 'bg-slate-100 text-slate-700 border-slate-200' },
  }
  const item = map[p] || { label: p, class: 'bg-slate-100 text-slate-700 border-slate-200' }
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${item.class}">${item.label}</span>`
}

export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN_BIDANG: 'Admin Bidang',
    OPERATOR: 'Operator',
  }
  return map[role] || role
}

export function roleBadgeClass(role: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN: 'bg-red-100 text-red-700 border-red-200',
    ADMIN_BIDANG: 'bg-blue-100 text-blue-700 border-blue-200',
    OPERATOR: 'bg-green-100 text-green-700 border-green-200',
  }
  return map[role] || 'bg-slate-100 text-slate-700 border-slate-200'
}
