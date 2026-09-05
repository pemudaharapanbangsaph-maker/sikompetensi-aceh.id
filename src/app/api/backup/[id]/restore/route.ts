import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getSession,
  auditLog,
  hasPermission,
} from "@/lib/auth";
import { getWriteRoot } from "@/lib/storage";
import { existsSync } from "fs";
import * as fsp from "fs/promises";
import path from "path";
import { execFileSync } from "child_process";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBackupDir(): string {
  const configuredBackupDir = String(
    process.env.BACKUP_DIR || ""
  ).trim();

  return configuredBackupDir
    ? path.resolve(configuredBackupDir)
    : path.join(getWriteRoot(), "backups");
}

function getSafeFileName(fileName: string): string {
  const safeName = path.basename(String(fileName || ""));

  if (
    !safeName ||
    safeName === "." ||
    safeName === ".." ||
    safeName.includes("\0")
  ) {
    throw new Error("Nama file backup tidak valid");
  }

  return safeName;
}

function getBackupPath(fileName: string): string {
  const backupDir = path.resolve(getBackupDir());
  const safeName = getSafeFileName(fileName);
  const backupPath = path.resolve(backupDir, safeName);
  const backupPrefix = `${backupDir}${path.sep}`;

  if (!backupPath.startsWith(backupPrefix)) {
    throw new Error("Path backup tidak valid");
  }

  return backupPath;
}

function getFilesBackupPath(fileName: string): string {
  const backupDir = path.resolve(getBackupDir());
  const safeName = getSafeFileName(fileName);
  const baseName = path.basename(
    safeName,
    path.extname(safeName)
  );

  const filesPath = path.resolve(
    backupDir,
    `${baseName}.files`
  );

  const backupPrefix = `${backupDir}${path.sep}`;

  if (!filesPath.startsWith(backupPrefix)) {
    throw new Error("Path file backup tidak valid");
  }

  return filesPath;
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

async function copyDirectory(
  sourceDir: string,
  targetDir: string
): Promise<void> {
  if (!existsSync(sourceDir)) {
    return;
  }

  await fsp.mkdir(targetDir, {
    recursive: true,
  });

  const entries = await fsp.readdir(sourceDir, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile()) {
      await fsp.copyFile(sourcePath, targetPath);
    }
  }
}

function restoreDatabase(
  backupPath: string
): void {
  const dbConfig = parseDbUrl();

  const sqlContent = require("fs").readFileSync(
    backupPath,
    "utf8"
  );

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
      input: sqlContent,
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
      env: environment,
    }
  );
}

async function restoreUploadedFiles(
  fileBackupPath: string
): Promise<boolean> {
  if (!existsSync(fileBackupPath)) {
    return false;
  }

  const targetRoot = getWriteRoot();

  // Backup dibuat dari UPLOAD_DIR dan berisi folder uploads/.
  // Menyalin ke targetRoot akan menghasilkan:
  // <UPLOAD_DIR>/uploads/...
  await copyDirectory(fileBackupPath, targetRoot);

  return true;
}

export async function POST(
  req: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
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

    const { id } = await params;

    const item = await db.backupHistory.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Backup tidak ditemukan" },
        { status: 404 }
      );
    }

    const backupPath = getBackupPath(item.namaFile);

    if (!existsSync(backupPath)) {
      return NextResponse.json(
        {
          error:
            "File backup database tidak ditemukan di server",
        },
        { status: 404 }
      );
    }

    // Restore database terlebih dahulu.
    restoreDatabase(backupPath);

    // Setelah database berhasil, restore file upload dan sertifikat.
    const fileBackupPath = getFilesBackupPath(
      item.namaFile
    );

    const filesRestored = await restoreUploadedFiles(
      fileBackupPath
    );

    await auditLog(
      session,
      "RESTORE",
      "BACKUP",
      `Restore database${filesRestored ? " dan file upload" : ""} dari: ${item.namaFile}`,
      req
    );

    return NextResponse.json({
      success: true,
      filesRestored,
      message: filesRestored
        ? "Database dan file upload berhasil direstore."
        : "Database berhasil direstore. File upload tidak ditemukan pada backup tersebut.",
    });
  } catch (error) {
    console.error(
      "[backup-restore] Gagal melakukan restore:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Restore gagal. Pastikan file backup, DATABASE_URL, dan program MySQL tersedia.",
      },
      { status: 500 }
    );
  }
}
