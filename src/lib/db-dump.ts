import "server-only";

/**
 * Database dump & restore — DUAL MODE.
 *
 * Mendeteksi protokol DATABASE_URL:
 *  - `mysql://`  → gunakan mysqldump / mysql CLI (PRODUKSI, path asli tidak diubah).
 *  - `file:`     → gunakan SQLite berbasis JS (sandbox/dev: salin file .db untuk
 *                  backup; untuk restore, timpa file .db dengan file backup).
 *
 * Fungsi ini sengaja dibungkus agar ketiga route backup (POST, [id]/restore,
 * upload-restore) cukup memanggil satu tempat dan path MySQL tidak tersentuh.
 */

import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { recreatePrismaClient } from "./db";

export type DatabaseProtocol = "mysql" | "sqlite";

interface MysqlConfig {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
}

export function detectProtocol(): DatabaseProtocol {
  const url = String(process.env.DATABASE_URL || "").trim();
  if (!url) throw new Error("DATABASE_URL belum dikonfigurasi");
  if (url.toLowerCase().startsWith("mysql://")) return "mysql";
  if (url.toLowerCase().startsWith("file:")) return "sqlite";
  // Fallback: anggap sqlite bila bukan mysql (mis. "file:..." tanpa protokol).
  return "sqlite";
}

function parseMysqlUrl(): MysqlConfig {
  const rawUrl = String(process.env.DATABASE_URL || "").trim();
  if (!rawUrl) throw new Error("DATABASE_URL belum dikonfigurasi");
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "mysql:") {
    throw new Error("DATABASE_URL harus menggunakan mysql://");
  }
  const database = decodeURIComponent(
    parsed.pathname.replace(/^\/+/, "")
  );
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

function parseSqlitePath(): string {
  // Format: file:/abs/path/db.sqlite  atau  file:./relative.db
  const rawUrl = String(process.env.DATABASE_URL || "").trim();
  if (!rawUrl) throw new Error("DATABASE_URL belum dikonfigurasi");
  const withoutPrefix = rawUrl.replace(/^file:/i, "");
  // Pisahkan query string jika ada (mis. ?connection_limit=...)
  const filePath = withoutPrefix.split("?")[0];
  if (!filePath) throw new Error("Path file SQLite tidak ditemukan");
  return path.isAbsolute(filePath)
    ? filePath
    : path.resolve(process.cwd(), filePath);
}

// ---------------------------------------------------------------------------
// DUMP (backup)
// ---------------------------------------------------------------------------

/**
 * Buat dump database ke `backupPath`.
 * - MySQL: jalankan mysqldump → file .sql
 * - SQLite: salin file .db ke `backupPath` (snapshot byte-for-byte)
 */
export function createDatabaseDump(backupPath: string): void {
  const protocol = detectProtocol();

  if (protocol === "mysql") {
    createMysqlDump(backupPath);
    return;
  }

  createSqliteDump(backupPath);
}

function createMysqlDump(backupPath: string): void {
  const config = parseMysqlUrl();

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
    // Fallback jika routines/triggers/events tidak diizinkan.
    try {
      execFileSync("mysqldump", commonArgs, {
        timeout: 120000,
        stdio: ["ignore", "pipe", "pipe"],
        env: environment,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`mysqldump gagal dijalankan: ${message}`);
    }
  }
}

function createSqliteDump(backupPath: string): void {
  const dbPath = parseSqlitePath();
  if (!fs.existsSync(dbPath)) {
    throw new Error(`File database SQLite tidak ditemukan: ${dbPath}`);
  }
  // Salin byte-for-byte (snapshot konsisten cukup untuk dev/sandbox).
  fs.copyFileSync(dbPath, backupPath);
}

// ---------------------------------------------------------------------------
// RESTORE
// ---------------------------------------------------------------------------

/**
 * Restore database dari `backupPath` (file .sql untuk MySQL / file .db untuk SQLite)
 * atau dari `sqlBuffer` (untuk upload-restore, hanya MySQL yang menggunakan buffer
 * SQL teks; SQLite menggunakan snapshot file).
 */
export function restoreDatabase(backupPath: string): void {
  const protocol = detectProtocol();

  if (protocol === "mysql") {
    const sqlContent = fs.readFileSync(backupPath, "utf8");
    restoreMysql(Buffer.from(sqlContent, "utf8"));
    return;
  }

  restoreSqliteFromFile(backupPath);
}

/**
 * Restore dari buffer SQL (hanya untuk MySQL — dipakai route upload-restore).
 * Bila protokol SQLite, lempar error yang jelas karena restore upload .sql
 * hanya berlaku untuk MySQL.
 */
export function restoreDatabaseFromBuffer(sqlBuffer: Buffer): void {
  const protocol = detectProtocol();

  if (protocol === "mysql") {
    restoreMysql(sqlBuffer);
    return;
  }

  throw new Error(
    "Restore dari file .sql hanya didukung pada database MySQL. " +
      "Untuk SQLite, gunakan tombol Restore pada riwayat backup (snapshot .db)."
  );
}

function restoreMysql(sqlBuffer: Buffer): void {
  const config = parseMysqlUrl();
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
      input: sqlBuffer,
      timeout: 120000,
      stdio: ["pipe", "pipe", "pipe"],
      env: environment,
    }
  );
}

function restoreSqliteFromFile(backupPath: string): void {
  const dbPath = parseSqlitePath();
  if (!fs.existsSync(backupPath)) {
    throw new Error(`File backup tidak ditemukan: ${backupPath}`);
  }
  // Pastikan folder tujuan ada.
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  // Timpa file .db dengan snapshot backup. Pada SQLite, menimpa file
  // yang sedang dibuka Prisma bisa membatalkan koneksi aktif — itu
  // diharapkan: klien Prisma akan dibuat ulang oleh recreatePrismaClient
  // sehingga query berikutnya membaca data hasil restore.
  fs.copyFileSync(backupPath, dbPath);

  // Buat ulang Prisma Client agar koneksi baru membaca file .db hasil restore.
  // Best-effort: jika gagal, data file sudah tetap tertimpa dengan benar.
  try {
    recreatePrismaClient();
  } catch (error) {
    console.warn(
      "[db-dump] recreatePrismaClient gagal setelah restore SQLite:",
      error instanceof Error ? error.message : String(error)
    );
  }
}
