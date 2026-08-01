import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession, hasPermission } from '@/lib/auth'

// GET: rekap per angkatan — avg pre-test, avg post-test, avg kuesioner, improvement
export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!hasPermission(session.user.role, 'monitoring:view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const angkatanList = await db.angkatan.findMany({
      include: { pelatihan: true },
      orderBy: { createdAt: 'desc' },
    })

    const result = await Promise.all(
      angkatanList.map(async (a) => {
        const [preAgg, postAgg, kuesAgg] = await Promise.all([
          db.evaluasi.aggregate({
            _avg: { nilai: true },
            _count: { _all: true },
            where: { angkatanId: a.id, jenisEvaluasi: 'PRE_TEST' },
          }),
          db.evaluasi.aggregate({
            _avg: { nilai: true },
            _count: { _all: true },
            where: { angkatanId: a.id, jenisEvaluasi: 'POST_TEST' },
          }),
          db.evaluasi.aggregate({
            _avg: { nilai: true },
            _count: { _all: true },
            where: { angkatanId: a.id, jenisEvaluasi: 'KUESIONER' },
          }),
        ])
        const avgPre = preAgg._avg.nilai ?? 0
        const avgPost = postAgg._avg.nilai ?? 0
        const avgKues = kuesAgg._avg.nilai ?? 0
        const improvement = avgPre > 0 ? Math.round(((avgPost - avgPre) / avgPre) * 1000) / 10 : 0
        return {
          id: a.id,
          namaAngkatan: a.namaAngkatan,
          pelatihan: a.pelatihan?.nama || null,
          avgPreTest: Math.round(avgPre * 100) / 100,
          avgPostTest: Math.round(avgPost * 100) / 100,
          avgKuesioner: Math.round(avgKues * 100) / 100,
          improvement,
          jumlahPreTest: preAgg._count._all,
          jumlahPostTest: postAgg._count._all,
          jumlahKuesioner: kuesAgg._count._all,
        }
      })
    )

    return NextResponse.json(result)
  } catch (e) {
    console.error('evaluasi rekap error:', e)
    return NextResponse.json({ error: 'Gagal memuat rekap evaluasi' }, { status: 500 })
  }
}
