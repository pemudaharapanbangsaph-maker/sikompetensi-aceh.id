import nodemailer from 'nodemailer'
import { db } from './db'

// SMTP config keys stored in Pengaturan table
const SMTP_KEYS = [
  'smtp_host',
  'smtp_port',
  'smtp_user',
  'smtp_pass',
  'smtp_from',
  'smtp_from_name',
  'smtp_secure',
] as const

type SmtpConfig = {
  host: string
  port: number
  user: string
  pass: string
  from: string
  fromName: string
  secure: boolean
}

/**
 * Read SMTP config from Pengaturan table.
 * Falls back to env vars if Pengaturan records don't exist yet.
 */
async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const rows = await db.pengaturan.findMany({
    where: { key: { in: [...SMTP_KEYS] } },
  })

  const map: Record<string, string> = {}
  for (const r of rows) {
    map[r.key] = r.value
  }

  const host = map.smtp_host || process.env.SMTP_HOST || ''
  const port = parseInt(map.smtp_port || process.env.SMTP_PORT || '587', 10)
  const user = map.smtp_user || process.env.SMTP_USER || ''
  const pass = map.smtp_pass || process.env.SMTP_PASS || ''
  const from = map.smtp_from || process.env.SMTP_FROM || ''
  const fromName = map.smtp_from_name || process.env.SMTP_FROM_NAME || 'SIKOMPETENSI BPSDM Aceh'
  const secure = (map.smtp_secure || process.env.SMTP_SECURE || 'false') === 'true'

  if (!host || !user || !pass || !from) {
    return null
  }

  return { host, port, user, pass, from, fromName, secure }
}

/**
 * Build a styled HTML email body from plain text content.
 */
function buildHtmlEmail(subjek: string, isi: string, jenis: string | null): string {
  const jenisLabel: Record<string, string> = {
    INFO: '📋 Informasi',
    PENGINGAT: '⏰ Pengingat',
    UNDANGAN: '📨 Undangan',
  }
  const jenisBadge = jenis && jenisLabel[jenis]
    ? `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:8px 16px;margin-bottom:20px;display:inline-block;font-size:13px;color:#0369a1;font-weight:600;">${jenisLabel[jenis]}</div>`
    : ''

  // Convert plain text line breaks to <br> and escape HTML
  const safeContent = isi
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0F4C81 0%,#0a3a63 100%);padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">SIKOMPETENSI</h1>
                    <p style="margin:4px 0 0 0;color:rgba(255,255,255,0.8);font-size:12px;">BPSDM Aceh — Sistem Informasi Kompetensi Teknis</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${jenisBadge}
              <h2 style="margin:0 0 16px 0;color:#0f172a;font-size:20px;font-weight:700;">${subjek}</h2>
              <div style="color:#334155;font-size:14px;line-height:1.7;margin-bottom:24px;">
                ${safeContent}
              </div>
              <div style="border-top:1px solid #e2e8f0;padding-top:16px;margin-top:8px;">
                <p style="margin:0;color:#94a3b8;font-size:11px;">Email ini dikirim otomatis oleh Sistem Informasi Kompetensi Teknis BPSDM Aceh.</p>
                <p style="margin:4px 0 0 0;color:#94a3b8;font-size:11px;">Mohon untuk tidak membalas email ini secara langsung.</p>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#64748b;font-size:11px;text-align:center;">&copy; ${new Date().getFullYear()} BPSDM Aceh — Badan Pengembangan Sumber Daya Manusia Aceh</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

/**
 * Send an email via SMTP.
 * Returns { success: true, messageId: string } on success,
 * or throws an Error with details on failure.
 */
export async function sendEmail(to: string, subjek: string, isi: string, jenis?: string | null): Promise<{ success: boolean; messageId: string }> {
  const config = await getSmtpConfig()
  if (!config) {
    throw new Error('SMTP belum dikonfigurasi. Silakan atur Pengaturan SMTP terlebih dahulu di menu Settings.')
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000,
  })

  const html = buildHtmlEmail(subjek, isi, jenis || null)

  const info = await transporter.sendMail({
    from: `"${config.fromName}" <${config.from}>`,
    to,
    subject: subjek,
    html,
  })

  return { success: true, messageId: info.messageId || '' }
}

/**
 * Verify SMTP connection without sending an email.
 * Returns true if connection is successful, throws otherwise.
 */
export async function testSmtpConnection(): Promise<{ success: boolean; message: string }> {
  const config = await getSmtpConfig()
  if (!config) {
    throw new Error('SMTP belum dikonfigurasi')
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
  })

  await transporter.verify()
  return { success: true, message: `Koneksi berhasil ke ${config.host}:${config.port} sebagai ${config.user}` }
}

/**
 * Get current SMTP config (for display in settings, password masked).
 */
export async function getSmtpConfigForDisplay(): Promise<Record<string, string>> {
  const rows = await db.pengaturan.findMany({
    where: { key: { in: [...SMTP_KEYS] } },
  })
  const map: Record<string, string> = {}
  for (const r of rows) {
    if (r.key === 'smtp_pass') {
      // Mask password
      map[r.key] = r.value ? '••••••••' : ''
    } else {
      map[r.key] = r.value
    }
  }
  return map
}

/**
 * Save SMTP config to Pengaturan table.
 */
export async function saveSmtpConfig(data: Record<string, string>): Promise<void> {
  const allowedKeys = new Set([...SMTP_KEYS])
  const entries = Object.entries(data).filter(([k]) => allowedKeys.has(k))

  await Promise.all(
    entries.map(([key, value]) =>
      db.pengaturan.upsert({
        where: { key },
        update: { value, kategori: 'SMTP' },
        create: { key, value, kategori: 'SMTP' },
      })
    )
  )
}

/**
 * Check if SMTP is configured (at least host, user, pass, from are set).
 */
export async function isSmtpConfigured(): Promise<boolean> {
  const config = await getSmtpConfig()
  return config !== null
}
