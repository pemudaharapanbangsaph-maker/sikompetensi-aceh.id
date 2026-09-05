import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, auditLog, hasPermission } from "@/lib/auth";
import { getWriteRoot, resolveStoredFile, resolveStoredFileDurable } from "@/lib/storage";
import { listAllUploadFilePaths } from "@/lib/backup-repo";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import { execFileSync } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBackupDir(): string {
  const configuredBackupDir = String(process.env.BACKUP_DIR || "").trim();

  return configuredBackupDir
    ? path.resolve(configuredBackupDir)
    : path.join(getWriteRoot(), "backups");
}

async function ensureBackupDir(): Promise<string> {
  const backupDir = getBackupDir();

  await fsp.mkdir(backupDir, {
    recursive: true,
  });

  return backupDir;
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
}

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
    throw new Error("DATABASE_URL harus menggunakan mysql://");
  }

  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));

  if (!parsed.hostname || !database) {
    throw new Error("Host atau nama database tidak ditemukan");
  }

  return {
    host: parsed.hostname,
    port: parsed.port || "3306",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}

function isBackupFileExists(namaFile: string): boolean {
  const filePath = path.join(getBackupDir(), path.basename(namaFile));
  return fs.existsSync(filePath);
}

function createDatabaseDump(backupPath: string): void {
  const config = parseDbUrl();

  const commonArgs = [
    "--host",
    config.host,
    "--port",
    config.port,
    "--user",
    config.user,
    "--single-transaction",
    "--hex-blob",
    "--default-character-set=utf8mb4",
    "--result-file",
    backupPath,
    config.database,
  ];

  const environment = {
    ...process.env,
    MYSQL_PWD: config.password,
  };

  try {
    execFileSync(
      "mysqldump",
      [...commonArgs, "--routines", "--triggers", "--events"],
      {
        timeout: 120000,
        stdio: ["ignore", "pipe", "pipe"],
        env: environment,
      }
    );
  } catch {
    try {
      execFileSync("mysqldump", commonArgs, {
        timeout: 120000,
        stdio: ["ignore", "pipe", "pipe"],
        env: environment,
      });
    } catch (secondError) {
      const message =
        secondError instanceof Error ? secondError.message : String(secondError);

      throw new Error(`mysqldump gagal dijalankan: ${message}`);
    }
  }
}

function normalizeStoredPath(storedPath: string): string {
  return String(storedPath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

async function backupUploadedFiles(
  backupDir: string,
  namaFile: string
): Promise<string | null> {
  const backupName = path.basename(namaFile, path.extname(namaFile));
  const targetDir = path.join(backupDir, `${backupName}.files`);

  const storedPaths = await listAllUploadFilePaths();

  if (!storedPaths.length) {
    return null;
  }

  let copiedCount = 0;

  for (const storedPath of storedPaths) {
    const normalizedStoredPath = normalizeStoredPath(storedPath);

    if (!normalizedStoredPath) {
      continue;
    }

    let resolved = await resolveStoredFileDurable(normalizedStoredPath);

    if (!resolved.path) {
      resolved = resolveStoredFile(normalizedStoredPath);
    }

    if (!resolved.path || !fs.existsSync(resolved.path)) {
      console.warn(`[backup] File tidak ditemukan: ${normalizedStoredPath}`);
      continue;
    }

    const destination = path.resolve(targetDir, normalizedStoredPath);
    const targetPrefix = `${path.resolve(targetDir)}${path.sep}`;

    if (!destination.startsWith(targetPrefix)) {
      console.warn(`[backup] Path dilewati karena tidak valid: ${normalizedStoredPath}`);
      continue;
    }

    await fsp.mkdir(path.dirname(destination), {
      recursive: true,
    });

    await fsp.copyFile(resolved.path, destination);
    copiedCount++;
  }

  if (copiedCount === 0) {
    await fsp.rm(targetDir, {
      recursive: true,
      force: true,
    });

    return null;
  }

  console.log(`[backup] ${copiedCount} file upload berhasil disalin`);

  return targetDir;
}

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(session.user.role, "backup:view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await db.backupHistory.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    const enriched = data.map((backup) => ({
      ...backup,
      fileExists: isBackupFileExists(backup.namaFile),
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error("[backup] Gagal memuat daftar backup:", error);

    return NextResponse.json(
      { error: "Gagal memuat data backup" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let backupPath: string | null = null;

  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission(session.user.role, "backup:create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const backupDir = await ensureBackupDir();

    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");

    const stamp =
      [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
      ].join("") +
      "_" +
      [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("");

    const namaFile = `backup_${stamp}.sql`;

    backupPath = path.join(backupDir, path.basename(namaFile));

    createDatabaseDump(backupPath);

    if (!fs.existsSync(backupPath)) {
      throw new Error("File backup database tidak berhasil dibuat");
    }

    const stats = await fsp.stat(backupPath);
    const ukuran = formatFileSize(stats.size);

    const filesBackupPath = await backupUploadedFiles(backupDir, namaFile);

    const catatan = filesBackupPath
      ? "Backup database dan file upload berhasil dibuat"
      : "Backup database berhasil dibuat; folder file upload tidak ditemukan";

    const item = await db.backupHistory.create({
      data: {
        namaFile,
        ukuran,
        tipe: "MANUAL",
        status: "BERHASIL",
        dibuatOleh: session.user.id,
        catatan,
      },
    });

    await auditLog(
      session,
      "BACKUP",
      "BACKUP",
      `Backup database dan file upload: ${namaFile} (${ukuran})`,
      req
    );

    return NextResponse.json(item);
  } catch (error) {
    console.error("[backup] Gagal membuat backup:", error);

    if (backupPath && fs.existsSync(backupPath)) {
      try {
        await fsp.unlink(backupPath);
      } catch {
        // Abaikan jika file sementara gagal dihapus.
      }
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Gagal membuat backup",
      },
      { status: 500 }
    );
  }
}
