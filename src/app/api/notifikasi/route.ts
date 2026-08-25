import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, auditLog } from '@/lib/auth'
import { parseListParams, buildWhere } from '@/lib/api-helpers'
import { sendEmail } from '@/lib/email'

const ALLOWED_SORT = ['subjek', 'penerima', 'status', 'jenis', 'createdAt']

export async function GET(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const params = parseListParams(new URL(req.url).searchParams)
    const { page, pageSize, search, sortBy, sortOrder, status, jenis, ...rest } = params
    const filters: Record<string, string | number | undefined> = {}
    if (status) filters.status = status as string
    if (jenis) filters.jenis = jenis as string
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== '' && !['page', 'pageSize', 'search', 'sortBy', 'sortOrder'].includes(k)) {
        filters[k] = v as string
      }
    }

    const where = buildWhere(search as string, ['subjek', 'penerima', 'isi'], filters)
    const safeSortBy = (sortBy && ALLOWED_SORT.includes(sortBy as string)) ? sortBy as string : 'createdAt'

    const [data, total] = await Promise.all([
      db.notifikasiEmail.findMany({
        where,
        skip: ((page as number) - 1) * (pageSize as number),
        take: pageSize as number,
        orderBy: { [safeSortBy]: (sortOrder as 'asc' | 'desc') || 'desc' },
      }),
      db.notifikasiEmail.count({ where }),
    ])

    return NextResponse.json({
      data,
      total,
      page: page as number,
      pageSize: pageSize as number,
      totalPages: Math.ceil(total / (pageSize as number)),
    })
  } catch (e) {
    console.error('notifikasi list error:', e)
    return NextResponse.json({ error: 'Gagal memuat data notifikasi' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { action } = body

    if (action === 'send') {
      const { id, penerima } = body
      if (!id) return NextResponse.json({ error: 'ID notifikasi diperlukan' }, { status: 400 })

      const existing = await db.notifikasiEmail.findUnique({ where: { id } })
      if (!existing) return NextResponse.json({ error: 'Notifikasi tidak ditemukan' }, { status: 404 })

      // Actually send the email via SMTP
      try {
        const recipientEmail = penerima || existing.penerima
        await sendEmail(recipientEmail, existing.subjek, existing.isi, existing.jenis)

        const item = await db.notifikasiEmail.update({
          where: { id },
          data: {
            status: 'TERKIRIM',
            sentAt: new Date(),
            penerima: recipientEmail,
            errorMessage: null,
          },
        })
        await auditLog(session, 'UPDATE', 'NOTIFIKASI', `Kirim notifikasi email: ${item.subjek} → ${recipientEmail}`, req)
        return NextResponse.json(item)
      } catch (emailErr) {
        // Mark as GAGAL with error message
        const errorMsg = (emailErr as Error).message || 'Gagal mengirim email'
        const item = await db.notifikasiEmail.update({
          where: { id },
          data: {
            status: 'GAGAL',
            errorMessage: errorMsg,
          },
        })
        await auditLog(session, 'UPDATE', 'NOTIFIKASI', `Gagal kirim notifikasi: ${item.subjek} — ${errorMsg}`, req)
        return NextResponse.json({ error: `Gagal mengirim email: ${errorMsg}` }, { status: 400 })
      }
    }

    // Default: buat draf baru
    const { subjek, isi, penerima, jenis, referensiId, referensiTipe } = body
    if (!subjek) return NextResponse.json({ error: 'Subjek wajib diisi' }, { status: 400 })
    if (!isi) return NextResponse.json({ error: 'Isi email wajib diisi' }, { status: 400 })
    if (!penerima) return NextResponse.json({ error: 'Penerima wajib diisi' }, { status: 400 })

    if (jenis && !['INFO', 'PENGINGAT', 'UNDANGAN'].includes(jenis)) {
      return NextResponse.json({ error: 'Jenis harus INFO, PENGINGAT, atau UNDANGAN' }, { status: 400 })
    }

    const item = await db.notifikasiEmail.create({
      data: {
        subjek,
        isi,
        penerima,
        status: 'DRAF',
        jenis: jenis || null,
        referensiId: referensiId || null,
        referensiTipe: referensiTipe || null,
      },
    })
    await auditLog(session, 'CREATE', 'NOTIFIKASI', `Buat draf notifikasi: ${item.subjek}`, req)
    return NextResponse.json(item)
  } catch (e) {
    console.error('notifikasi create error:', e)
    return NextResponse.json({ error: 'Gagal membuat notifikasi' }, { status: 500 })
  }
}
