import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getSession,
  auditLog,
  hasPermission,
} from "@/lib/auth";
import { getWriteRoot } from "@/lib/storage";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
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
  const prefix = `${backupDir}${path.sep}`;

  if (!backupPath.startsWith(prefix)) {
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

  const prefix = `${backupDir}${path.sep}`;

  if (!filesPath.startsWith(prefix)) {
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
  const rawUrl = String(
    process.env.DATABASE_URL || ""
  ).trim();

  if (!rawUrl) {
    throw new Error(
      "DATABASE_URL belum dikonfigurasi"
    );
  }

  const parsed = new URL(rawUrl);

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

function restoreDatabase(
  backupPath: string
): void {
  const config = parseDbUrl();
  const sqlContent = fs.readFileSync(
    backupPath,
    "utf8"
  );

  const environment = {
    ...process.env,
    MYSQL_PWD: config.password,
  };

  execFileSync(
    "mysql",
    [
      "--host",
      config.host,
      "--port",
      config.port,
      "--user",
      config.user,
      "--default-character-set=utf8mb4",
      "--binary-mode=1",
      config.database,
    ],
    {
      input: sqlContent,
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
      env: environment,
    }
  );
}

function isInside(
  parent: string,
  child: string
): boolean {
  const parentPath = path.resolve(parent);
  const childPath = path.resolve(child);
  const prefix = `${parentPath}${path.sep}`;

  return (
    childPath === parentPath ||
    childPath.startsWith(prefix)
  );
}

async function copyDirectory(
  sourceDir: string,
  targetDir: string
): Promise<number> {
  if (!fs.existsSync(sourceDir)) {
    return 0;
  }

  const stat = await fsp.stat(sourceDir);

  if (!stat.isDirectory()) {
    return 0;
  }

  await fsp.mkdir(targetDir, {
    recursive: true,
  });

  const entries = await fsp.readdir(
    sourceDir,
    {
      withFileTypes: true,
    }
  );

  let copiedCount = 0;

  for (const entry of entries) {
    const sourcePath = path.join(
      sourceDir,
      entry.name
    );

    const targetPath = path.join(
      targetDir,
      entry.name
    );

    if (!isInside(sourceDir, sourcePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      copiedCount += await copyDirectory(
        sourcePath,
        targetPath
      );
      continue;
    }

    if (entry.isFile()) {
      await fsp.mkdir(
        path.dirname(targetPath),
        {
          recursive: true,
        }
      );

      await fsp.copyFile(
        sourcePath,
        targetPath
      );

      copiedCount++;
    }
  }

  return copiedCount;
}

async function restoreUploadedFiles(
  fileBackupPath: string
): Promise<{
  restored: boolean;
  copiedCount: number;
  targetRoot: string;
}> {
  const targetRoot = getWriteRoot();

  if (!fs.existsSync(fileBackupPath)) {
    return {
      restored: false,
      copiedCount: 0,
      targetRoot,
    };
  }

  const entries = await fsp.readdir(
    fileBackupPath,
    {
      withFileTypes: true,
    }
  );

  if (entries.length === 0) {
    return {
      restored: false,
      copiedCount: 0,
      targetRoot,
    };
  }

  let copiedCount = 0;

  /*
   * Format baru:
   *
   * backup_x.files/uploads/sertifikat/file.pdf
   *
   * Hasil:
   *
   * UPLOAD_DIR/uploads/sertifikat/file.pdf
   */
  const uploadsDirectory = path.join(
    fileBackupPath,
    "uploads"
  );

  if (fs.existsSync(uploadsDirectory)) {
    copiedCount += await copyDirectory(
      uploadsDirectory,
      path.join(targetRoot, "uploads")
    );
  }

  /*
   * Format lama:
   *
   * backup_x.files/sertifikat/file.pdf
   *
   * Hasil:
   *
   * UPLOAD_DIR/uploads/sertifikat/file.pdf
   */
  const sertifikatDirectory = path.join(
    fileBackupPath,
    "sertifikat"
  );

  if (fs.existsSync(sertifikatDirectory)) {
    copiedCount += await copyDirectory(
      sertifikatDirectory,
      path.join(
        targetRoot,
        "uploads",
        "sertifikat"
      )
    );
  }

  /*
   * Jika format backup langsung berisi file/folder lain,
   * salin sebagai fallback ke UPLOAD_DIR.
   */
  if (
    !fs.existsSync(uploadsDirectory) &&
    !fs.existsSync(sertifikatDirectory)
  ) {
    copiedCount += await copyDirectory(
      fileBackupPath,
      path.join(targetRoot, "uploads")
    );
  }

  return {
    restored: copiedCount > 0,
    copiedCount,
    targetRoot,
  };
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

    if (
      !hasPermission(
        session.user.role,
        "backup:create"
      )
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const item =
      await db.backupHistory.findUnique({
        where: { id },
      });

    if (!item) {
      return NextResponse.json(
        { error: "Backup tidak ditemukan" },
        { status: 404 }
      );
    }

    const backupPath = getBackupPath(
      item.namaFile
    );

    if (!fs.existsSync(backupPath)) {
      return NextResponse.json(
        {
          error:
            "File backup database tidak ditemukan di server",
        },
        { status: 404 }
      );
    }

    restoreDatabase(backupPath);

    const fileBackupPath =
      getFilesBackupPath(item.namaFile);

    const filesResult =
      await restoreUploadedFiles(
        fileBackupPath
      );

    if (!filesResult.restored) {
      await auditLog(
        session,
        "RESTORE",
        "BACKUP",
        `Restore database tanpa file upload: ${item.namaFile}`,
        req
      );

      return NextResponse.json({
        success: true,
        filesRestored: false,
        filesCopied: 0,
        message:
          "Database berhasil direstore, tetapi file upload tidak ditemukan atau folder backup file kosong.",
      });
    }

    await auditLog(
      session,
      "RESTORE",
      "BACKUP",
      `Restore database dan ${filesResult.copiedCount} file upload dari: ${item.namaFile}`,
      req
    );

    return NextResponse.json({
      success: true,
      filesRestored: true,
      filesCopied: filesResult.copiedCount,
      message: `Database dan ${filesResult.copiedCount} file upload berhasil direstore.`,
    });
  } catch (error) {
    console.error(
      "[backup-restore] Gagal melakukan restore:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Restore gagal dilakukan",
      },
      { status: 500 }
    );
  }
}
