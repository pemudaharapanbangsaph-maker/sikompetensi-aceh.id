import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from './db'
import crypto from 'crypto'

const SESSION_COOKIE = 'bpsdm_session'
const SESSION_DURATION = 30 * 60 * 1000 // 30 minutes
const ENCRYPTION_KEY = process.env.SESSION_SECRET || 'sikompetensi-aceh-secret-key-2024-v1'

// Derive a 32-byte key from the secret
function getKey(): Buffer {
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
}

export interface SessionUser {
  id: string
  username: string
  nama: string
  email: string
  role: 'SUPER_ADMIN' | 'ADMIN_BIDANG' | 'OPERATOR'
  status: string
}

export interface SessionData {
  user: SessionUser
  expires: number
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Encrypt session data to store in cookie
function encryptSession(data: SessionData): string {
  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const jsonStr = JSON.stringify(data)
  const encrypted = Buffer.concat([cipher.update(jsonStr, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Format: iv:authTag:encrypted (all base64)
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

// Decrypt session data from cookie
function decryptSession(token: string): SessionData | null {
  try {
    const key = getKey()
    const parts = token.split(':')
    if (parts.length !== 3) return null
    const iv = Buffer.from(parts[0], 'base64')
    const authTag = Buffer.from(parts[1], 'base64')
    const encrypted = Buffer.from(parts[2], 'base64')
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
    const data = JSON.parse(decrypted.toString('utf8')) as SessionData
    return data
  } catch {
    return null
  }
}

export async function createSession(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  const sessionData: SessionData = {
    user: {
      id: user.id,
      username: user.username,
      nama: user.nama,
      email: user.email,
      role: user.role as SessionUser['role'],
      status: user.status,
    },
    expires: Date.now() + SESSION_DURATION,
  }

  await db.user.update({
    where: { id: userId },
    data: { lastLogin: new Date(), loginAttempts: 0, lockedUntil: null },
  })

  return encryptSession(sessionData)
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = decryptSession(token)
  if (!session) return null

  if (Date.now() > session.expires) {
    return null
  }

  return session
}

export async function destroySession(): Promise<void> {
  // For encrypted cookies, the session is destroyed by deleting the cookie
  // No server-side state to clean up
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const SESSION_MAX_AGE = SESSION_DURATION / 1000

// Role-based access control
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN_BIDANG: [
    'dashboard:view',
    'analisis:view', 'analisis:create', 'analisis:update', 'analisis:delete',
    'pelatihan:view', 'pelatihan:create', 'pelatihan:update', 'pelatihan:delete',
    'uji_kompetensi:view', 'uji_kompetensi:create', 'uji_kompetensi:update', 'uji_kompetensi:delete',
    'peserta:view', 'peserta:create', 'peserta:update', 'peserta:delete',
    'pendaftaran:view', 'pendaftaran:update', 'pendaftaran:delete',
    'monitoring:view', 'monitoring:create', 'monitoring:update',
    'laporan:view', 'laporan:export',
    'backup:view', 'backup:create', 'backup:restore',
    'settings:view', 'settings:update',
  ],
  OPERATOR: [
    'dashboard:view',
    'analisis:view', 'analisis:create', 'analisis:update',
    'pelatihan:view', 'pelatihan:create', 'pelatihan:update',
    'uji_kompetensi:view', 'uji_kompetensi:create', 'uji_kompetensi:update',
    'peserta:view', 'peserta:create', 'peserta:update',
    'pendaftaran:view', 'pendaftaran:update',
    'monitoring:view', 'monitoring:create',
    'laporan:view',
  ],
}

export function hasPermission(role: string, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || []
  return perms.includes('*') || perms.includes(permission)
}

export async function requireAuth(permission?: string): Promise<SessionData> {
  const session = await getSession()
  if (!session) {
    throw new Error('UNAUTHORIZED')
  }
  if (permission && !hasPermission(session.user.role, permission)) {
    throw new Error('FORBIDDEN')
  }
  return session
}

export async function auditLog(session: SessionData | null, aksi: string, modul: string, deskripsi: string, req?: Request) {
  try {
    await db.auditLog.create({
      data: {
        userId: session?.user.id,
        username: session?.user.username || 'SYSTEM',
        aksi,
        modul,
        deskripsi,
        ip: req?.headers.get('x-forwarded-for') || req?.headers.get('x-real-ip') || '127.0.0.1',
        userAgent: req?.headers.get('user-agent'),
      },
    })
  } catch (e) {
    console.error('Audit log error:', e)
  }
}
