import { NextResponse } from 'next/server'
import { requireAuth, auditLog, getSession, hasPermission } from './auth'
import type { SessionData } from './auth'
import type { Prisma } from '@prisma/client'
import { db } from './db'

export interface ListParams {
  page?: number
  pageSize?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  [key: string]: string | number | undefined
}

export function parseListParams(searchParams: URLSearchParams): ListParams {
  const params: ListParams = {}
  for (const [key, value] of searchParams.entries()) {
    if (key === 'page' || key === 'pageSize') {
      params[key] = parseInt(value, 10) || (key === 'page' ? 1 : 10)
    } else {
      params[key] = value
    }
  }
  if (!params.page) params.page = 1
  if (!params.pageSize) params.pageSize = 10
  return params
}

export function buildWhere<T extends Record<string, unknown>>(
  search: string | undefined,
  searchFields: string[],
  filters: Record<string, string | number | undefined>
): T {
  const where: Record<string, unknown> = {}
  if (search && searchFields.length) {
    where.OR = searchFields.map((field) => ({
      [field]: { contains: search },
    }))
  }
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      where[key] = value
    }
  }
  return where as T
}

export async function handleAuthError(e: unknown) {
  const msg = e instanceof Error ? e.message : 'Unknown error'
  if (msg === 'UNAUTHORIZED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (msg === 'FORBIDDEN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  console.error('API Error:', e)
  return NextResponse.json({ error: msg }, { status: 500 })
}

export async function withAuth<T>(
  permission: string | undefined,
  handler: (session: SessionData) => Promise<T>
): Promise<T | Response> {
  try {
    const session = await requireAuth(permission)
    return await handler(session)
  } catch (e) {
    return handleAuthError(e)
  }
}

export { db, requireAuth, auditLog, getSession, hasPermission, NextResponse }
export type { SessionData, Prisma }
