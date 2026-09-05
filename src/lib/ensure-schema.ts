import "server-only";

/**
 * Pemeriksaan schema database yang aman untuk runtime Node.js.
 *
 * PENTING:
 * - Jangan import file ini dari src/middleware.ts.
 * - Prisma hanya boleh dipanggil dari route Node.js,
 *   server action, atau instrumentation server.
 * - Semua query menggunakan nama tabel dan kolom tetap.
 * - Jika database tidak tersedia, aplikasi tidak dihentikan.
 */

type DatabaseModule = typeof import("./db");

let dbModulePromise: Promise<DatabaseModule> | null =
  null;

async function getDatabase(): Promise<DatabaseModule> {
  if (!dbModulePromise) {
    dbModulePromise = import("./db").catch(
      (error) => {
        dbModulePromise = null;
        throw error;
      }
    );
  }

  return dbModulePromise;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function isDuplicateError(error: unknown): boolean {
  const message = getErrorMessage(
    error
  ).toLowerCase();

  return (
    message.includes("duplicate") ||
    message.includes("already exists")
  );
}

function isMissingTableError(error: unknown): boolean {
  const message = getErrorMessage(
    error
  ).toLowerCase();

  return (
    message.includes("doesn't exist") ||
    message.includes("does not exist") ||
    message.includes("unknown table") ||
    message.includes("table") &&
      message.includes("not found")
  );
}

// ---------------------------------------------------------------------------
// Kolom email pada tabel PendaftaranPortal
// ---------------------------------------------------------------------------

let emailColumnDone = false;
let emailColumnInflight: Promise<void> | null =
  null;

async function runEnsurePendaftaranEmailColumn(): Promise<void> {
  try {
    const { db } = await getDatabase();

    const columns =
      (await db.$queryRawUnsafe(
        "SHOW COLUMNS FROM `PendaftaranPortal` LIKE 'email'"
      )) as unknown[];

    if (
      Array.isArray(columns) &&
      columns.length === 0
    ) {
      try {
        await db.$executeRawUnsafe(
          "ALTER TABLE `PendaftaranPortal` ADD COLUMN `email` VARCHAR(191) NULL"
        );

        console.log(
          "[ensure-schema] Kolom email pada PendaftaranPortal berhasil ditambahkan"
        );
      } catch (error) {
        if (!isDuplicateError(error)) {
          throw error;
        }
      }
    }

    emailColumnDone = true;
  } catch (error) {
    /*
     * Jika tabel belum ada atau database sementara
     * tidak tersedia, jangan menghentikan aplikasi.
     */
    console.error(
      "[ensure-schema] Gagal memastikan kolom email PendaftaranPortal:",
      getErrorMessage(error)
    );
  }
}

export function ensurePendaftaranEmailColumn(): Promise<void> {
  if (emailColumnDone) {
    return Promise.resolve();
  }

  if (!emailColumnInflight) {
    emailColumnInflight =
      runEnsurePendaftaranEmailColumn().finally(
        () => {
          emailColumnInflight = null;
        }
      );
  }

  return emailColumnInflight;
}

// ---------------------------------------------------------------------------
// Tabel BackupHistory
// ---------------------------------------------------------------------------

let backupHistoryDone = false;
let backupHistoryInflight: Promise<void> | null =
  null;

const BACKUP_HISTORY_COLUMNS: Record<
  string,
  string
> = {
  id: "`id` VARCHAR(30) NOT NULL",
  namaFile:
    "`namaFile` VARCHAR(255) NOT NULL",
  ukuran:
    "`ukuran` VARCHAR(50) NOT NULL",
  tipe:
    "`tipe` VARCHAR(20) NOT NULL DEFAULT 'MANUAL'",
  status:
    "`status` VARCHAR(20) NOT NULL DEFAULT 'BERHASIL'",
  dibuatOleh:
    "`dibuatOleh` VARCHAR(30) NULL",
  catatan:
    "`catatan` TEXT NULL",
  createdAt:
    "`createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)",
};

async function runEnsureBackupHistoryTable(): Promise<void> {
  try {
    const { db } = await getDatabase();

    const tables =
      (await db.$queryRawUnsafe(
        "SHOW TABLES LIKE 'BackupHistory'"
      )) as unknown[];

    if (
      !Array.isArray(tables) ||
      tables.length === 0
    ) {
      const columnDefinitions = Object.values(
        BACKUP_HISTORY_COLUMNS
      ).join(", ");

      await db.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`BackupHistory\` (
          ${columnDefinitions},
          PRIMARY KEY (\`id\`)
        )
        ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
      `);

      console.log(
        "[ensure-schema] Tabel BackupHistory berhasil dibuat"
      );
    }

    const existingColumns =
      (await db.$queryRawUnsafe(
        "SHOW COLUMNS FROM `BackupHistory`"
      )) as Array<{
        Field?: string;
      }>;

    const existingColumnNames = new Set(
      (
        Array.isArray(existingColumns)
          ? existingColumns
          : []
      )
        .map((column) =>
          String(column?.Field ?? "")
        )
        .filter(Boolean)
    );

    for (const [
      columnName,
      definition,
    ] of Object.entries(
      BACKUP_HISTORY_COLUMNS
    )) {
      if (
        existingColumnNames.has(columnName)
      ) {
        continue;
      }

      try {
        await db.$executeRawUnsafe(
          `ALTER TABLE \`BackupHistory\` ADD COLUMN ${definition}`
        );

        console.log(
          `[ensure-schema] Kolom ${columnName} pada BackupHistory berhasil ditambahkan`
        );
      } catch (error) {
        /*
         * Jika proses lain sudah menambahkan
         * kolom yang sama, anggap berhasil.
         */
        if (!isDuplicateError(error)) {
          throw error;
        }
      }
    }

    backupHistoryDone = true;
  } catch (error) {
    console.error(
      "[ensure-schema] Gagal memastikan tabel BackupHistory:",
      getErrorMessage(error)
    );
  }
}

export function ensureBackupHistoryTable(): Promise<void> {
  if (backupHistoryDone) {
    return Promise.resolve();
  }

  if (!backupHistoryInflight) {
    backupHistoryInflight =
      runEnsureBackupHistoryTable().finally(
        () => {
          backupHistoryInflight = null;
        }
      );
  }

  return backupHistoryInflight;
}
