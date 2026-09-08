import { NextResponse } from "next/server";
import {
  getSession,
  auditLog,
  hasPermission,
} from "@/lib/auth";
import { restoreDatabaseFromBuffer } from "@/lib/db-dump";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!hasPermission(session.user.role, "backup:create")) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const uploadedFile = formData.get("file");

    if (!(uploadedFile instanceof File)) {
      return NextResponse.json(
        { error: "File backup tidak ditemukan" },
        { status: 400 }
      );
    }

    const originalName = uploadedFile.name || "backup.sql";
    const safeName = originalName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 150);

    if (!safeName.toLowerCase().endsWith(".sql")) {
      return NextResponse.json(
        {
          error:
            "Format file harus .sql dari database MySQL",
        },
        { status: 400 }
      );
    }

    if (uploadedFile.size <= 0) {
      return NextResponse.json(
        { error: "File backup kosong" },
        { status: 400 }
      );
    }

    if (uploadedFile.size > MAX_UPLOAD_SIZE) {
      return NextResponse.json(
        { error: "Ukuran file maksimal 100MB" },
        { status: 400 }
      );
    }

    const arrayBuffer = await uploadedFile.arrayBuffer();
    const sqlBuffer = Buffer.from(arrayBuffer);

    if (sqlBuffer.length === 0) {
      return NextResponse.json(
        { error: "Isi file backup kosong" },
        { status: 400 }
      );
    }

    restoreDatabaseFromBuffer(sqlBuffer);

    await auditLog(
      session,
      "RESTORE",
      "BACKUP",
      `Restore database dari upload: ${safeName} (${(
        uploadedFile.size /
        1024 /
        1024
      ).toFixed(1)} MB)`,
      req
    );

    return NextResponse.json({
      success: true,
      filesRestored: false,
      message:
        "Database berhasil direstore dari file SQL.",
    });
  } catch (error) {
    console.error(
      "[upload-restore] Restore database gagal:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Restore gagal. Pastikan file SQL valid dan koneksi database tersedia.",
      },
      { status: 500 }
    );
  }
}
