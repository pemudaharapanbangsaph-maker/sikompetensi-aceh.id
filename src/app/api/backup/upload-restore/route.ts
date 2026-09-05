import { NextResponse } from "next/server";
import {
  getSession,
  auditLog,
  hasPermission,
} from "@/lib/auth";
import { execFileSync } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_SIZE = 100 * 1024 * 1024;

function parseDbUrl(): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  const rawUrl = String(process.env.DATABASE_URL || "").trim();

  if (!rawUrl) {
    throw new Error("DATABASE_URL belum dikonfigurasi");
  }

  let parsed: URL;

  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("DATABASE_URL tidak valid");
  }

  if (parsed.protocol !== "mysql:") {
    throw new Error(
      "DATABASE_URL harus menggunakan mysql://"
    );
  }

  const database = decodeURIComponent(
    parsed.pathname.replace(/^\/+/, "")
  );

  if (!parsed.hostname || !database) {
    throw new Error(
      "Host atau nama database tidak ditemukan"
    );
  }

  return {
    host: parsed.hostname,
    port: parsed.port || "3306",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}

function restoreDatabase(sqlBuffer: Buffer): void {
  const dbConfig = parseDbUrl();

  const environment = {
    ...process.env,
    MYSQL_PWD: dbConfig.password,
  };

  execFileSync(
    "mysql",
    [
      "--host",
      dbConfig.host,
      "--port",
      dbConfig.port,
      "--user",
      dbConfig.user,
      "--default-character-set=utf8mb4",
      "--binary-mode=1",
      dbConfig.database,
    ],
    {
      input: sqlBuffer,
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
      env: environment,
    }
  );
}

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

    restoreDatabase(sqlBuffer);

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
