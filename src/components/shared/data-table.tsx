'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
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
  width?: string
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
    <Card className="border-slate-200 shadow-sm w-full overflow-hidden">
      <CardContent className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Toolbar */}
        <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3 lg:items-center lg:justify-between">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-1">
            {onSearchChange && (
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  value={searchValue || ''}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9 h-9 text-xs sm:text-sm bg-white"
                />
              </div>
            )}
            {filters.map((f) => (
              <Select
                key={f.key}
                value={filterValues[f.key] || 'all'}
                onValueChange={(v) => onFilterChange?.(f.key, v === 'all' ? '' : v)}
              >
                <SelectTrigger className={cn('h-9 w-full text-xs sm:text-sm bg-white', f.width || 'sm:w-40')}>
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
          <div className="flex items-center gap-2 justify-end">
            {toolbar}
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="h-9 px-3 text-xs sm:text-sm">
                <RefreshCw className={cn('w-3.5 h-3.5 sm:w-4 sm:h-4', loading && 'animate-spin')} />
                <span className="hidden sm:inline ml-1.5">Refresh</span>
              </Button>
            )}
            {onAdd && (
              <Button size="sm" onClick={onAdd} className="h-9 px-3 bg-[#0F4C81] hover:bg-[#0a3a63] text-xs sm:text-sm">
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1" />
                {addLabel}
              </Button>
            )}
          </div>
        </div>

        {/* Table Container with Horizontal Touch Scroll */}
        <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
          <div className="overflow-x-auto min-w-full">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="border-slate-200 hover:bg-slate-50">
                  {columns.map((c) => (
                    <TableHead key={c.key} className={cn('text-[11px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wide whitespace-nowrap py-3 px-3', c.className)} style={{ width: c.width }}>
                      {c.header}
                    </TableHead>
                  ))}
                  {actions && <TableHead className="text-[11px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wide text-right whitespace-nowrap py-3 px-3 min-w-[90px]">Aksi</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {columns.map((c) => (
                        <TableCell key={c.key} className="py-3 px-3">
                          <div className="h-4 bg-slate-100 rounded animate-pulse" />
                        </TableCell>
                      ))}
                      {actions && <TableCell className="py-3 px-3"><div className="h-4 bg-slate-100 rounded animate-pulse ml-auto w-12" /></TableCell>}
                    </TableRow>
                  ))
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + (actions ? 1 : 0)} className="text-center py-10 text-slate-400">
                      <Inbox className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs sm:text-sm">{emptyMessage}</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row, rowIndex) => (
                    <TableRow key={rowKey(row)} className="border-slate-100 hover:bg-slate-50/50 transition-colors">
                      {columns.map((c) => (
                        <TableCell key={c.key} className={cn('text-xs sm:text-sm text-slate-700 py-3 px-3', c.className)}>
                          {c.render ? c.render(row, rowIndex) : (row as Record<string, unknown>)[c.key] as ReactNode}
                        </TableCell>
                      ))}
                      {actions && (
                        <TableCell className="text-right py-3 px-3 whitespace-nowrap">
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs sm:text-sm pt-1">
          <p className="text-slate-500 text-[11px] sm:text-xs text-center sm:text-left order-2 sm:order-1">
            Menampilkan <span className="font-medium text-slate-700">{start}-{end}</span> dari <span className="font-medium text-slate-700">{total}</span> data
          </p>
          <div className="flex items-center gap-1 order-1 sm:order-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange?.(page - 1)} disabled={page <= 1 || loading} className="h-8 w-8 p-0">
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
                    className={cn('h-8 w-8 p-0 text-xs', p === page && 'bg-[#0F4C81] hover:bg-[#0a3a63]')}
                  >
                    {p}
                  </Button>
                )
              })}
            </div>
            <Button variant="outline" size="sm" onClick={() => onPageChange?.(page + 1)} disabled={page >= totalPages || loading} className="h-8 w-8 p-0">
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
    if (typeof target !== 'number' || isNaN(target) || target === 0) return
    startTime.current = null
    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp
      const progress = Math.min((timestamp - startTime.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(eased * target))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
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
  const colors: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
    green: { bg: 'bg-green-50', text: 'text-[#15803D]', ring: 'ring-green-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-100' },
    red: { bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-100' },
  }
  const c = colors[color] || colors.blue
  const numericVal = typeof value === 'number' ? value : parseInt(value.toString().replace(/\D/g, ''), 10)
  const animatedVal = useAnimatedNumber(isNaN(numericVal) ? 0 : numericVal)
  const displayVal = typeof value === 'number' ? animatedVal : value

  return (
    <Card className="border-slate-200 shadow-sm hover:shadow transition-all">
      <CardContent className="p-3.5 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500">{title}</p>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{displayVal}</p>
            {subtitle && <p className="text-[11px] text-slate-400">{subtitle}</p>}
          </div>
          <div className={cn('p-2.5 sm:p-3 rounded-xl flex-shrink-0', c.bg, c.text)}>
            <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
