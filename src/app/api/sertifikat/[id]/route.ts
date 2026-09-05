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

    await db.sertifikat.delete({
      where: {
        id,
      },
    });

    await auditLog(
      session,
      "DELETE",
      "SERTIFIKAT",
      `Menghapus sertifikat: ${id}`,
      req
    );

    return NextResponse.json({
      success: true,
      message:
        "Sertifikat berhasil dihapus",
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
