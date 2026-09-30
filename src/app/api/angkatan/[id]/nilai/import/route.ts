import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission, auditLog } from '@/lib/auth'
import * as XLSX from 'xlsx'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'pelatihan:update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const angkatan = await db.angkatan.findUnique({
      where: { id },
      include: {
        pelatihan: true,
        peserta: { include: { peserta: true } },
      },
    })
    if (!angkatan) {
      return NextResponse.json({ error: 'Angkatan tidak ditemukan' }, { status: 404 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json(
        { error: 'File tidak ditemukan. Silakan upload file Excel (.xlsx)' },
        { status: 400 }
      )
    }

    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Format file harus .xlsx atau .xls' },
        { status: 400 }
      )
    }

    const buf = Buffer.from(await file.arrayBuffer())
    let wb: XLSX.WorkBook
    try {
      wb = XLSX.read(buf, { type: 'buffer' })
    } catch {
      return NextResponse.json(
        { error: 'File tidak dapat dibaca. Pastikan file Excel valid' },
        { status: 400 }
      )
    }

    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File kosong atau tidak valid' }, { status: 400 })
    }

    const headers = Object.keys(rows[0])
    const findCol = (names: string[]) =>
      headers.find((h) =>
        names.some((n) => h.toLowerCase().trim() === n.toLowerCase())
      )

    const nipCol = findCol(['NIP', 'Nip', 'nip'])
    const preCol = findCol(['Pre-Test', 'Pre Test', 'PreTest', 'PRE_TEST', 'pre-test', 'pre test'])
    const postCol = findCol(['Post-Test', 'Post Test', 'PostTest', 'POST_TEST', 'post-test', 'post test'])

    if (!nipCol) {
      return NextResponse.json(
        { error: 'Kolom "NIP" tidak ditemukan. Gunakan template yang disediakan.' },
        { status: 400 }
      )
    }

    const nipToPeserta = new Map<string, { pesertaId: string; nama: string }>()
    for (const pa of angkatan.peserta) {
      if (pa.peserta?.nip) {
        nipToPeserta.set(pa.peserta.nip, {
          pesertaId: pa.peserta.id,
          nama: pa.peserta.nama,
        })
      }
    }

    const parseNilai = (val: unknown): number | null => {
      if (val === null || val === undefined) return null
      if (typeof val === 'number') {
        if (isNaN(val)) return null
        return Math.max(0, Math.min(100, val))
      }
      const s = String(val).trim()
      if (!s) return null
      const n = parseFloat(s.replace(',', '.'))
      if (isNaN(n)) return null
      return Math.max(0, Math.min(100, n))
    }

    let imported = 0
    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2

      const nipRaw = String(row[nipCol] || '').trim()
      const preTestVal = preCol ? parseNilai(row[preCol]) : null
      const postTestVal = postCol ? parseNilai(row[postCol]) : null

      if (!nipRaw && preTestVal === null && postTestVal === null) {
        continue
      }

      if (!nipRaw) {
        errors.push(`Baris ${rowNum}: NIP kosong`)
        skipped++
        continue
      }

      const matched = nipToPeserta.get(nipRaw)
      if (!matched) {
        errors.push(`Baris ${rowNum}: NIP ${nipRaw} tidak terdaftar di angkatan ini`)
        skipped++
        continue
      }

      if (preTestVal === null && postTestVal === null) {
        skipped++
        continue
      }

      const existing = await db.evaluasi.findMany({
        where: {
          angkatanId: id,
          pesertaId: matched.pesertaId,
        },
        select: { id: true, jenisEvaluasi: true },
      })

      const hasOldData = existing.length > 0

      await db.$transaction(async (tx) => {
        if (preTestVal !== null) {
          await tx.evaluasi.deleteMany({
            where: {
              angkatanId: id,
              pesertaId: matched.pesertaId,
              jenisEvaluasi: 'PRE_TEST',
            },
          })
          await tx.evaluasi.create({
            data: {
              angkatanId: id,
              pesertaId: matched.pesertaId,
              jenisEvaluasi: 'PRE_TEST',
              aspek: 'Umum',
              nilai: preTestVal,
              catatan: 'Import dari Excel',
              diinputOleh: session.user.id,
            },
          })
        }

        if (postTestVal !== null) {
          await tx.evaluasi.deleteMany({
            where: {
              angkatanId: id,
              pesertaId: matched.pesertaId,
              jenisEvaluasi: 'POST_TEST',
            },
          })
          await tx.evaluasi.create({
            data: {
              angkatanId: id,
              pesertaId: matched.pesertaId,
              jenisEvaluasi: 'POST_TEST',
              aspek: 'Umum',
              nilai: postTestVal,
              catatan: 'Import dari Excel',
              diinputOleh: session.user.id,
            },
          })
        }
      })

      if (hasOldData) {
        updated++
      } else {
        imported++
      }
    }

    await auditLog(
      session,
      'IMPORT',
      'EVALUASI',
      `Import nilai ${imported} baru, ${updated} update, ${skipped} skip dari file: ${file.name} (angkatan: ${angkatan.namaAngkatan})`,
      req
    )

    return NextResponse.json({
      success: true,
      imported,
      updated,
      skipped,
      errors: errors.length > 0 ? errors.slice(0, 20) : undefined,
      message: `Import berhasil: ${imported} peserta baru, ${updated} diperbarui, ${skipped} di-skip${errors.length > 0 ? `, ${errors.length} error` : ''}`,
    })
  } catch (e) {
    console.error('nilai import error:', e)
    return NextResponse.json({ error: 'Gagal mengimpor nilai' }, { status: 500 })
  }
}
