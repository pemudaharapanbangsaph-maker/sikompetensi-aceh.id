import type {
  User, Peserta, Pelatihan, Angkatan, AnalisisKebutuhan,
  UjiKompetensi, Asesor, Nilai, Kehadiran, Evaluasi,
  AuditLog, BackupHistory, DashboardStats, PaginatedResponse
} from './types'

const BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const err = await res.json()
      msg = err.error || err.message || msg
    } catch {}
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  // ===== Auth =====
  login: (username: string, password: string, remember?: boolean) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password, remember }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<{ user: User }>('/auth/me'),

  // ===== Dashboard =====
  dashboard: () => request<DashboardStats>('/dashboard'),

  // ===== Generic CRUD factory =====
  crud<T>(resource: string) {
    return {
      list: (params?: Record<string, string | number | undefined>) => {
        const qs = params ? '?' + new URLSearchParams(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== '').reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>)
        ).toString() : ''
        return request<PaginatedResponse<T>>(`/${resource}${qs}`)
      },
      listAll: (params?: Record<string, string | number | undefined>) => {
        const qs = params ? '?' + new URLSearchParams(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== '').reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>)
        ).toString() : ''
        return request<T[]>(`/${resource}/all${qs}`)
      },
      get: (id: string) => request<T>(`/${resource}/${id}`),
      create: (data: Partial<T>) => request<T>(`/${resource}`, { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: Partial<T>) => request<T>(`/${resource}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      remove: (id: string) => request<void>(`/${resource}/${id}`, { method: 'DELETE' }),
    }
  },

  peserta: {
    list: (params?: Record<string, string | number | undefined>) =>
      request<PaginatedResponse<Peserta>>('/peserta?' + (params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>)).toString() : '')),
    listAll: () => request<Peserta[]>('/peserta/all'),
    get: (id: string) => request<Peserta>(`/peserta/${id}`),
    create: (data: Partial<Peserta>) => request<Peserta>('/peserta', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Peserta>) => request<Peserta>(`/peserta/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/peserta/${id}`, { method: 'DELETE' }),
    riwayat: (id: string) => request<{ angkatan: (Angkatan & { pelatihan?: Pelatihan | null })[]; nilai: (Nilai & { ujiKompetensi?: UjiKompetensi | null })[] }>(`/peserta/${id}/riwayat`),
  },

  pelatihan: {
    list: (params?: Record<string, string | number | undefined>) =>
      request<PaginatedResponse<Pelatihan>>('/pelatihan?' + (params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>)).toString() : '')),
    listAll: () => request<Pelatihan[]>('/pelatihan/all'),
    get: (id: string) => request<Pelatihan>(`/pelatihan/${id}`),
    create: (data: Partial<Pelatihan>) => request<Pelatihan>('/pelatihan', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Pelatihan>) => request<Pelatihan>(`/pelatihan/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/pelatihan/${id}`, { method: 'DELETE' }),
  },

  angkatan: {
    list: (params?: Record<string, string | number | undefined>) =>
      request<PaginatedResponse<Angkatan>>('/angkatan?' + (params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>)).toString() : '')),
    listAll: () => request<Angkatan[]>('/angkatan/all'),
    get: (id: string) => request<Angkatan & { peserta?: PesertaAngkatanView[] }>(`/angkatan/${id}`),
    create: (data: Partial<Angkatan>) => request<Angkatan>('/angkatan', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Angkatan>) => request<Angkatan>(`/angkatan/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/angkatan/${id}`, { method: 'DELETE' }),
    addPeserta: (id: string, pesertaIds: string[]) => request<void>(`/angkatan/${id}/peserta`, { method: 'POST', body: JSON.stringify({ pesertaIds }) }),
    removePeserta: (id: string, pesertaId: string) => request<void>(`/angkatan/${id}/peserta/${pesertaId}`, { method: 'DELETE' }),
    kehadiran: (id: string) => request<Kehadiran[]>(`/angkatan/${id}/kehadiran`),
    setKehadiran: (id: string, data: { pesertaId: string; tanggal: string; statusKehadiran: string; keterangan?: string }) =>
      request<Kehadiran>(`/angkatan/${id}/kehadiran`, { method: 'POST', body: JSON.stringify(data) }),
  },

  analisis: {
    list: (params?: Record<string, string | number | undefined>) =>
      request<PaginatedResponse<AnalisisKebutuhan>>('/analisis?' + (params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>)).toString() : '')),
    listAll: () => request<AnalisisKebutuhan[]>('/analisis/all'),
    get: (id: string) => request<AnalisisKebutuhan>(`/analisis/${id}`),
    create: (data: Partial<AnalisisKebutuhan>) => request<AnalisisKebutuhan>('/analisis', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<AnalisisKebutuhan>) => request<AnalisisKebutuhan>(`/analisis/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/analisis/${id}`, { method: 'DELETE' }),
    rekap: () => request<any[]>('/analisis/rekap'),
  },

  ujiKompetensi: {
    list: (params?: Record<string, string | number | undefined>) =>
      request<PaginatedResponse<UjiKompetensi>>('/uji-kompetensi?' + (params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>)).toString() : '')),
    listAll: () => request<UjiKompetensi[]>('/uji-kompetensi/all'),
    get: (id: string) => request<UjiKompetensi & { nilai?: Nilai[] }>(`/uji-kompetensi/${id}`),
    create: (data: Partial<UjiKompetensi>) => request<UjiKompetensi>('/uji-kompetensi', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<UjiKompetensi>) => request<UjiKompetensi>(`/uji-kompetensi/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/uji-kompetensi/${id}`, { method: 'DELETE' }),
    setNilai: (id: string, data: Partial<Nilai> & { pesertaId: string }) =>
      request<Nilai>(`/uji-kompetensi/${id}/nilai`, { method: 'POST', body: JSON.stringify(data) }),
    rekapNilai: () => request<any[]>('/uji-kompetensi/rekap'),
  },

  asesor: {
    list: (params?: Record<string, string | number | undefined>) =>
      request<PaginatedResponse<Asesor>>('/asesor?' + (params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>)).toString() : '')),
    listAll: () => request<Asesor[]>('/asesor/all'),
    get: (id: string) => request<Asesor>(`/asesor/${id}`),
    create: (data: Partial<Asesor>) => request<Asesor>('/asesor', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Asesor>) => request<Asesor>(`/asesor/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/asesor/${id}`, { method: 'DELETE' }),
  },

  evaluasi: {
    list: (params?: Record<string, string | number | undefined>) =>
      request<PaginatedResponse<Evaluasi>>('/evaluasi?' + (params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>)).toString() : '')),
    create: (data: Partial<Evaluasi>) => request<Evaluasi>('/evaluasi', { method: 'POST', body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/evaluasi/${id}`, { method: 'DELETE' }),
    rekap: () => request<any[]>('/evaluasi/rekap'),
  },

  users: {
    list: (params?: Record<string, string | number | undefined>) =>
      request<PaginatedResponse<User>>('/users?' + (params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>)).toString() : '')),
    get: (id: string) => request<User>(`/users/${id}`),
    create: (data: Partial<User> & { password: string }) => request<User>('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<User> & { password?: string }) => request<User>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<void>(`/users/${id}`, { method: 'DELETE' }),
  },

  auditLog: {
    list: (params?: Record<string, string | number | undefined>) =>
      request<PaginatedResponse<AuditLog>>('/audit-log?' + (params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').reduce((acc, [k, v]) => ({ ...acc, [k]: String(v) }), {} as Record<string, string>)).toString() : '')),
  },

  backup: {
    list: () => request<BackupHistory[]>('/backup'),
    create: () => request<BackupHistory>('/backup', { method: 'POST' }),
    remove: (id: string) => request<void>(`/backup/${id}`, { method: 'DELETE' }),
  },

  settings: {
    get: () => request<Record<string, string>>('/settings'),
    update: (data: Record<string, string>) => request<void>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
}

export interface PesertaAngkatanView {
  id: string
  angkatanId: string
  pesertaId: string
  peserta?: Peserta
  status: string
  nilaiAkhir?: number | null
}
