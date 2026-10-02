import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getSession,
  auditLog,
  hasPermission,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  req: Request,
  { params }: RouteContext
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "ID sertifikat wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    const sertifikat =
      await db.sertifikat.findUnique({
        where: {
          id,
        },
        include: {
          angkatan: {
            include: {
              pelatihan: true,
            },
          },
          peserta: true,
          ujiKompetensi: true,
        },
      });

    if (!sertifikat) {
      return NextResponse.json(
        {
          error: "Sertifikat tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(sertifikat);
  } catch (error) {
    console.error(
      "[sertifikat/[id]] Gagal memuat sertifikat:",
      error
    );

    return NextResponse.json(
      {
        error: "Gagal memuat data sertifikat",
      },
      {
        status: 500,
      }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: RouteContext
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    if (
      !hasPermission(
        session.user.role,
        "sertifikat:delete"
      )
    ) {
      return NextResponse.json(
        {
          error: "Forbidden",
        },
        {
          status: 403,
        }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "ID sertifikat wajib diisi",
        },
        {
          status: 400,
        }
      );
    }

    const existing =
      await db.sertifikat.findUnique({
        where: {
          id,
        },
      });

    if (!existing) {
      return NextResponse.json(
        {
          error: "Sertifikat tidak ditemukan",
        },
        {
          status: 404,
        }
      );
    }

    // Soft delete: tandai deleted=true alih-alih hapus fisik
    await db.sertifikat.update({
      where: {
        id,
      },
      data: {
        deleted: true,
        deletedAt: new Date(),
      },
    });

    await auditLog(
      session,
      "DELETE",
      "SERTIFIKAT",
      `Mengarsipkan sertifikat: ${
        existing.nomorSertifikat ||
        existing.namaPeserta ||
        existing.id
      }`,
      req
    );

    return NextResponse.json({
      success: true,
      message:
        "Sertifikat berhasil diarsipkan",
    });
  } catch (error) {
    console.error(
      "[sertifikat/[id]] Gagal menghapus sertifikat:",
      error
    );

    return NextResponse.json(
      {
        error: "Gagal menghapus sertifikat",
      },
      {
        status: 500,
      }
    );
  }
}

// === PUT: Edit data sertifikat (nomorSertifikat, tanggalTerbit, catatan, dll) ===
// Dipakai untuk update nomor sertifikat setelah upload, atau edit field lain.
// File PDF tidak bisa diganti via PUT ini — gunakan upload ulang di menu Upload.
export async function PUT(
  req: Request,
  { params }: RouteContext
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (
      !hasPermission(
        session.user.role,
        "sertifikat:update"
      )
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "ID sertifikat wajib diisi" },
        { status: 400 }
      );
    }

    const existing = await db.sertifikat.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Sertifikat tidak ditemukan" },
        { status: 404 }
      );
    }

    const body = await req.json();

    // Ambil hanya field yang diizinkan untuk di-edit (whitelist)
    // Alasan keamanan: cegah mass-assignment ke field sensitif (file, id, dll)
    const data: Record<string, unknown> = {};

    if (body.nomorSertifikat !== undefined) {
      data.nomorSertifikat = String(body.nomorSertifikat).trim() || null;
    }
    if (body.namaPeserta !== undefined) {
      data.namaPeserta = String(body.namaPeserta).trim() || null;
    }
    if (body.namaKegiatan !== undefined) {
      data.namaKegiatan = String(body.namaKegiatan).trim() || null;
    }
    if (body.tanggalTerbit !== undefined) {
      // Parse ISO string ke Date, atau null kalau kosong
      if (body.tanggalTerbit) {
        const d = new Date(body.tanggalTerbit);
        if (!isNaN(d.getTime())) {
          data.tanggalTerbit = d;
        }
      } else {
        data.tanggalTerbit = null;
      }
    }
    if (body.catatan !== undefined) {
      data.catatan = String(body.catatan).trim() || null;
    }

    const updated = await db.sertifikat.update({
      where: { id },
      data: data as any,
      include: {
        angkatan: {
          select: {
            id: true,
            namaAngkatan: true,
            pelatihanId: true,
            pelatihan: {
              select: { id: true, nama: true, kode: true },
            },
          },
        },
        peserta: {
          select: { id: true, nama: true, nip: true },
        },
        ujiKompetensi: {
          select: { id: true, kode: true, skemaSertifikasi: true },
        },
      },
    });

    await auditLog(
      session,
      "UPDATE",
      "SERTIFIKAT",
      `Edit sertifikat: ${
        updated.nomorSertifikat ||
        updated.namaPeserta ||
        updated.id
      }`,
      req
    );

    return NextResponse.json(updated);
  } catch (error) {
    console.error(
      "[sertifikat/[id]] Gagal mengedit sertifikat:",
      error
    );

    return NextResponse.json(
      { error: "Gagal mengedit sertifikat" },
      { status: 500 }
    );
  }
}
