import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getSession,
  auditLog,
  hasPermission,
} from "@/lib/auth";
import { getWriteRoot } from "@/lib/storage";
import {
  existsSync,
  createReadStream,
  statSync,
} from "fs";
import * as fsp from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getBackupDir(): string {
  const configuredBackupDir = String(
    process.env.BACKUP_DIR || ""
  ).trim();

  const backupDir = configuredBackupDir
    ? path.resolve(configuredBackupDir)
    : path.join(getWriteRoot(), "backups");

  return backupDir;
}

function getSafeBackupFileName(fileName: string): string {
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

function getBackupFilePath(fileName: string): string {
  const backupDir = path.resolve(getBackupDir());
  const safeName = getSafeBackupFileName(fileName);
  const filePath = path.resolve(backupDir, safeName);

  const backupPrefix = `${backupDir}${path.sep}`;

  if (!filePath.startsWith(backupPrefix)) {
    throw new Error("Path backup tidak valid");
  }

  return filePath;
}

function getFilesBackupPath(fileName: string): string {
  const backupDir = path.resolve(getBackupDir());
  const safeName = getSafeBackupFileName(fileName);
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

function getDownloadName(fileName: string): string {
  return getSafeBackupFileName(fileName).replace(
    /["\\\r\n]/g,
    "_"
  );
}

// GET = Download file backup database (.sql)
export async function GET(
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

    if (!hasPermission(session.user.role, "backup:view")) {
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

    const filePath = getBackupFilePath(item.namaFile);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: "File backup tidak ditemukan di server" },
        { status: 404 }
      );
    }

    const stats = statSync(filePath);
    const stream = createReadStream(filePath);
    const downloadName = getDownloadName(item.namaFile);

    return new NextResponse(
      stream as unknown as BodyInit,
      {
        headers: {
          "Content-Type": "application/sql; charset=utf-8",
          "Content-Disposition": `attachment; filename="${downloadName}"`,
          "Content-Length": String(stats.size),
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "[backup] Gagal mengunduh backup:",
      error
    );

    return NextResponse.json(
      { error: "Gagal mengunduh backup" },
      { status: 500 }
    );
  }
}

// DELETE = Hapus backup database dan file upload pendamping
export async function DELETE(
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

    const filePath = getBackupFilePath(item.namaFile);
    const filesBackupPath = getFilesBackupPath(item.namaFile);

    if (existsSync(filePath)) {
      await fsp.unlink(filePath);
    }

    if (existsSync(filesBackupPath)) {
      await fsp.rm(filesBackupPath, {
        recursive: true,
        force: true,
      });
    }

    await db.backupHistory.delete({
      where: { id },
    });

    await auditLog(
      session,
      "DELETE",
      "BACKUP",
      `Hapus backup database dan file upload: ${item.namaFile}`,
      req
    );

    return NextResponse.json({
      success: true,
      message:
        "Backup database dan file upload berhasil dihapus",
    });
  } catch (error) {
    console.error(
      "[backup] Gagal menghapus backup:",
      error
    );

    return NextResponse.json(
      { error: "Gagal menghapus backup" },
      { status: 500 }
    );
  }
}
