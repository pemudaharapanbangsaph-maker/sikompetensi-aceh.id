'use client'

import { useState, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Search, ChevronLeft, ChevronRight, Inbox, Plus, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T, index: number) => ReactNode
  className?: string
  width?: string
}

export interface FilterOption {
  key: string
  label: string
  options: { value: string; label: string }[]
}

interface DataTableProps<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  loading?: boolean
  columns: Column<T>[]
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (v: string) => void
  onPageChange?: (page: number) => void
  filters?: FilterOption[]
  filterValues?: Record<string, string>
  onFilterChange?: (key: string, value: string) => void
  onAdd?: () => void
  addLabel?: string
  onRefresh?: () => void
  actions?: (row: T) => ReactNode
  rowKey: (row: T) => string
  emptyMessage?: string
  toolbar?: ReactNode
}

export function DataTable<T>({
  data, total, page, pageSize, loading, columns,
  searchPlaceholder = 'Cari...', searchValue, onSearchChange,
  onPageChange, filters = [], filterValues = {}, onFilterChange,
  onAdd, addLabel = 'Tambah', onRefresh, actions, rowKey,
  emptyMessage = 'Tidak ada data', toolbar,
}: DataTableProps<T>) {
  const totalPages = Math.ceil(total / pageSize) || 1
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-2 sm:items-center">
            {onSearchChange && (
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchValue || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9 h-9"
                />
              </div>
            )}
            {filters.map((f) => (
              <Select
                key={f.key}
                value={filterValues[f.key] || 'all'}
                onValueChange={(v) => onFilterChange?.(f.key, v === 'all' ? '' : v)}
              >
                <SelectTrigger className="h-9 w-full sm:w-40">
                  <SelectValue placeholder={f.label} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua {f.label}</SelectItem>
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {toolbar}
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="h-9">
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
            )}
            {onAdd && (
              <Button size="sm" onClick={onAdd} className="h-9 bg-[#0F4C81] hover:bg-[#0a3a63]">
                <Plus className="w-4 h-4" />
                {addLabel}
              </Button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-200 hover:bg-slate-50">
                  {columns.map((c) => (
                    <TableHead key={c.key} className={cn('text-xs font-semibold text-slate-600 uppercase tracking-wide', c.className)} style={{ width: c.width }}>
                      {c.header}
                    </TableHead>
                  ))}
                  {actions && <TableHead className="text-xs font-semibold text-slate-600 uppercase tracking-wide text-right w-[100px]">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {columns.map((c) => (
                        <TableCell key={c.key}>
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </TableCell>
                      ))}
                      {actions && <TableCell><div className="h-4 bg-slate-100 rounded animate-pulse ml-auto w-16" /></TableCell>}
                    </TableRow>
                  ))
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-12 text-slate-400">
                      <Inbox className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row, rowIndex) => (
                    <TableRow key={rowKey(row)} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                      {columns.map((c) => (
                        <TableCell key={c.key} className={cn('text-sm text-slate-700', c.className)}>
                          {c.render ? c.render(row, rowIndex) : (row as Record<string, unknown>)[c.key] as ReactNode}
                        </TableCell>
                      ))}
                      {actions && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">{actions(row)}</div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <p className="text-slate-500 text-xs">
            Menampilkan <span className="font-medium text-slate-700">{start}-{end}</span> dari <span className="font-medium text-slate-700">{total}</span> data
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => onPageChange?.(page - 1)} disabled={page <= 1 || loading} className="h-8">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
                let p = i + 1
                if (totalPages > 5) {
                  if (page > 3) p = page - 2 + i
                  if (page > totalPages - 2) p = totalPages - 4 + i
                }
                if (p < 1 || p > totalPages) return null
                return (
                  <Button
                    key={p}
                    variant={p === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => onPageChange?.(p)}
                    disabled={loading}
                    className={cn('h-8 w-8 p-0', p === page && 'bg-[#0F4C81] hover:bg-[#0a3a63]')}
                  >
                    {p}
                  </Button>
                )
              })}
            </div>
            <Button variant="outline" size="sm" onClick={() => onPageChange?.(page + 1)} disabled={page >= totalPages || loading} className="h-8">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Animated number counter hook
function useAnimatedNumber(target: number, duration = 800): number {
  const [current, setCurrent] = useState(0)
  const startTime = useRef<number | null>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target) || target === 0) {
      return
    }
    startTime.current = null
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp
      const progress = Math.min((timestamp - startTime.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setCurrent(Math.round(eased * target))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return current
}

// Stat card component
export function StatCard({
  title, value, icon: Icon, color = 'blue', subtitle, trend,
}: {
  title: string
  value: string | number
  icon: React.ComponentType<{ className?: string }>
  color?: 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'slate'
  subtitle?: string
  trend?: { value: string; up: boolean }
}) {
  const colors: Record<string, { bg: string; text: string; ring: string; hover: string; shadow: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100', hover: 'hover:shadow-blue-200/40', shadow: 'shadow-blue-100/60' },
    green: { bg: 'bg-green-50', text: 'text-[#15803D]', ring: 'ring-green-100', hover: 'hover:shadow-[#86EFAC]/40', shadow: 'shadow-[#86EFAC]/60' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100', hover: 'hover:shadow-amber-200/40', shadow: 'shadow-amber-100/60' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-100', hover: 'hover:shadow-purple-200/40', shadow: 'shadow-purple-100/60' },
    red: { bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100', hover: 'hover:shadow-red-200/40', shadow: 'shadow-red-100/60' },
    slate: { bg: 'bg-slate-100', text: 'text-slate-600', ring: 'ring-slate-200', hover: 'hover:shadow-slate-300/40', shadow: 'shadow-slate-200/60' },
  }
  const c = colors[color]
  const numericValue = typeof value === 'number' ? value : parseInt(String(value), 10)
  const isNumeric = typeof value === 'number' || (!isNaN(numericValue) && String(value) === String(numericValue))
  const animatedValue = useAnimatedNumber(isNumeric ? numericValue : 0, 800)
  const displayValue = isNumeric ? animatedValue : value

  return (
    <Card className={cn(
      'border-slate-100 shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg',
      c.hover
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
            <p className="text-2xl lg:text-3xl font-bold text-slate-900 mt-1 tabular-nums">{displayValue}</p>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            {trend && (
              <p className={cn('text-xs font-medium mt-1 flex items-center gap-1', trend.up ? 'text-[#15803D]' : 'text-red-600')}>
                {trend.up ? '↑' : '↓'} {trend.value}
              </p>
            )}
          </div>
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center ring-4 transition-transform duration-200 hover:scale-110', c.bg, c.text, c.ring)}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Page header component
export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        {description && <p className="text-sm text-slate-500 mt-0.5">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  )
}
