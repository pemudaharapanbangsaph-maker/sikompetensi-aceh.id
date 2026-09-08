import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getSession,
  auditLog,
  hasPermission,
} from "@/lib/auth";
import {
  getWriteRoot,
  resolveStoredFile,
  resolveStoredFileDurable,
} from "@/lib/storage";
import { listAllUploadFilePaths } from "@/lib/backup-repo";
import { createDatabaseDump } from "@/lib/db-dump";
import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";

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

function isBackupFileExists(
  namaFile: string
): boolean {
  const backupDir = path.resolve(getBackupDir());
  const safeName = path.basename(namaFile);
  const filePath = path.resolve(
    backupDir,
    safeName
  );

  const backupPrefix = `${backupDir}${path.sep}`;

  return (
    filePath.startsWith(backupPrefix) &&
    fs.existsSync(filePath)
  );
}

function getFilesBackupPath(
  namaFile: string
): string {
  const backupDir = path.resolve(getBackupDir());
  const baseName = path.basename(
    namaFile,
    path.extname(namaFile)
  );

  return path.resolve(
    backupDir,
    `${baseName}.files`
  );
}

function isFilesBackupExists(
  namaFile: string
): boolean {
  return fs.existsSync(
    getFilesBackupPath(namaFile)
  );
}

async function copyDirectory(
  sourceDir: string,
  targetDir: string
): Promise<number> {
  if (!fs.existsSync(sourceDir)) {
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

    if (entry.isDirectory()) {
      copiedCount += await copyDirectory(
        sourcePath,
        targetPath
      );

      continue;
    }

    if (entry.isFile()) {
      await fsp.copyFile(
        sourcePath,
        targetPath
      );

      copiedCount++;
    }
  }

  return copiedCount;
}

function normalizeStoredPath(
  storedPath: string
): string {
  return String(storedPath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

function getSafeBackupTarget(
  targetDir: string,
  relativePath: string
): string {
  const cleanPath = normalizeStoredPath(
    relativePath
  );

  if (
    !cleanPath ||
    cleanPath.includes("..") ||
    path.isAbsolute(cleanPath)
  ) {
    throw new Error(
      `Path file backup tidak valid: ${relativePath}`
    );
  }

  const destination = path.resolve(
    targetDir,
    cleanPath
  );

  const targetPrefix = `${path.resolve(
    targetDir
  )}${path.sep}`;

  if (!destination.startsWith(targetPrefix)) {
    throw new Error(
      `Path file backup berada di luar direktori: ${relativePath}`
    );
  }

  return destination;
}

async function backupUploadedFiles(
  backupDir: string,
  namaFile: string
): Promise<{
  path: string;
  copiedCount: number;
} | null> {
  const backupName = path.basename(
    namaFile,
    path.extname(namaFile)
  );

  const targetDir = path.join(
    backupDir,
    `${backupName}.files`
  );

  await fsp.mkdir(targetDir, {
    recursive: true,
  });

  let copiedCount = 0;

  /*
   * Sumber pertama:
   * seluruh file yang sudah berada di UPLOAD_DIR.
   *
   * Contoh sumber:
   * /home/u359423429/uploads-sikompetensi/uploads/
   *
   * Hasil backup:
   * /home/u359423429/uploads-sikompetensi/backups/
   * backup_x.files/uploads/
   */
  const persistentUploadsDir = path.join(
    getWriteRoot(),
    "uploads"
  );

  copiedCount += await copyDirectory(
    persistentUploadsDir,
    path.join(targetDir, "uploads")
  );

  /*
   * Sumber kedua:
   * path file yang tercatat di database.
   *
   * Ini digunakan untuk mencari file lama yang mungkin
   * masih berada di folder deployment sebelumnya.
   */
  let storedPaths: string[] = [];

  try {
    storedPaths =
      await listAllUploadFilePaths();
  } catch (error) {
    console.warn(
      "[backup] Gagal membaca path file dari database:",
      error
    );
  }

  for (const storedPath of storedPaths) {
    const normalizedStoredPath =
      normalizeStoredPath(storedPath);

    if (!normalizedStoredPath) {
      continue;
    }

    let resolved =
      await resolveStoredFileDurable(
        normalizedStoredPath
      );

    if (!resolved.path) {
      resolved = resolveStoredFile(
        normalizedStoredPath
      );
    }

    if (
      !resolved.path ||
      !fs.existsSync(resolved.path)
    ) {
      console.warn(
        `[backup] File tidak ditemukan: ${normalizedStoredPath}`
      );

      continue;
    }

    const destination = getSafeBackupTarget(
      targetDir,
      normalizedStoredPath
    );

    await fsp.mkdir(
      path.dirname(destination),
      {
        recursive: true,
      }
    );

    /*
     * Jika file sudah disalin saat menyalin seluruh
     * folder uploads, jangan menyalinnya dua kali.
     */
    if (!fs.existsSync(destination)) {
      await fsp.copyFile(
        resolved.path,
        destination
      );

      copiedCount++;
    }
  }

  if (copiedCount === 0) {
    await fsp.rm(targetDir, {
      recursive: true,
      force: true,
    });

    return null;
  }

  console.log(
    `[backup] ${copiedCount} file upload berhasil disalin`
  );

  return {
    path: targetDir,
    copiedCount,
  };
}

export async function GET() {
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
        "backup:view"
      )
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const data =
      await db.backupHistory.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });

    const enriched = data.map((backup) => ({
      ...backup,
      fileExists: isBackupFileExists(
        backup.namaFile
      ),
      filesBackupExists:
        isFilesBackupExists(
          backup.namaFile
        ),
    }));

    return NextResponse.json(enriched);
  } catch (error) {
    console.error(
      "[backup] Gagal memuat daftar backup:",
      error
    );

    return NextResponse.json(
      {
        error: "Gagal memuat data backup",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let backupPath: string | null = null;

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

    const backupDir =
      await ensureBackupDir();

    const now = new Date();
    const pad = (value: number) =>
      String(value).padStart(2, "0");

    const stamp =
      [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
      ].join("") +
      "_" +
      [
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds()),
      ].join("");

    const namaFile =
      `backup_${stamp}.sql`;

    backupPath = path.join(
      backupDir,
      path.basename(namaFile)
    );

    createDatabaseDump(backupPath);

    if (!fs.existsSync(backupPath)) {
      throw new Error(
        "File backup database tidak berhasil dibuat"
      );
    }

    const stats =
      await fsp.stat(backupPath);

    const ukuran =
      formatFileSize(stats.size);

    const filesBackup =
      await backupUploadedFiles(
        backupDir,
        namaFile
      );

    const catatan = filesBackup
      ? `Backup database dan ${filesBackup.copiedCount} file upload berhasil dibuat`
      : "Backup database berhasil dibuat; file upload tidak ditemukan";

    const item =
      await db.backupHistory.create({
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

    return NextResponse.json({
      ...item,
      fileExists: true,
      filesBackupExists: Boolean(
        filesBackup
      ),
      filesCopied:
        filesBackup?.copiedCount || 0,
    });
  } catch (error) {
    console.error(
      "[backup] Gagal membuat backup:",
      error
    );

    if (
      backupPath &&
      fs.existsSync(backupPath)
    ) {
      try {
        await fsp.unlink(backupPath);
      } catch {
        // Abaikan jika file gagal dihapus.
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal membuat backup",
      },
      { status: 500 }
    );
  }
}
