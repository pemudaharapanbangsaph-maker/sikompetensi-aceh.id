import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from './db'
import crypto from 'crypto'

const SESSION_COOKIE = 'bpsdm_session'
const SESSION_DURATION = 30 * 60 * 1000 // 30 minutes

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
  csrfToken: string
}

// ===== Encrypted Cookie Session (survives hot-reload) =====
const ALGO = 'aes-256-gcm'
const IV_LEN = 12
const AUTH_TAG_LEN = 16

function getSecret(): Buffer {
  const envSecret = process.env.SESSION_SECRET
  const raw = (envSecret && envSecret.length >= 8) ? envSecret : 'bpsdm-aceh-dev-session-key'
  return crypto.createHash('sha256').update(raw).digest()
}

function encrypt(data: string): string {
  const secret = getSecret()
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, secret, iv)
  let encrypted = cipher.update(data, 'utf-8')
  encrypted = Buffer.concat([encrypted, cipher.final()])
  const authTag = cipher.getAuthTag()
  // Format: base64(iv + authTag + ciphertext)
  return Buffer.concat([iv, authTag, encrypted]).toString('base64url')
}

function decrypt(token: string): string | null {
  try {
    const secret = getSecret()
    const buf = Buffer.from(token, 'base64url')
    const iv = buf.subarray(0, IV_LEN)
    const authTag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN)
    const ciphertext = buf.subarray(IV_LEN + AUTH_TAG_LEN)
    const decipher = crypto.createDecipheriv(ALGO, secret, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(ciphertext)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString('utf-8')
  } catch {
    return null
  }
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

export function generateCsrfToken(): string {
  return crypto.randomBytes(16).toString('hex')
}

export async function createSession(userId: string): Promise<string> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new Error('User not found')

  const csrfToken = generateCsrfToken()
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
    csrfToken,
  }

  await db.user.update({
    where: { id: userId },
    data: { lastLogin: new Date(), loginAttempts: 0, lockedUntil: null },
  })

  // Encrypt and return — session lives entirely in the cookie
  return encrypt(JSON.stringify(sessionData))
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null

  const json = decrypt(token)
  if (!json) return null

  try {
    const session: SessionData = JSON.parse(json)
    if (Date.now() > session.expires) return null
    return session
  } catch {
    return null
  }
}

export async function destroySession(): Promise<void> {
  // No-op: the logout route already deletes the cookie.
  // Nothing stored server-side.
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
