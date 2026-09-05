import {
  createConnection,
  type Connection,
} from "mysql2/promise";

export interface BackupHistoryRow {
  id: string;
  namaFile: string;
  ukuran: string;
  tipe: string;
  status: string;
  dibuatOleh: string | null;
  catatan: string | null;
  createdAt: Date;
}

const BACKUP_HISTORY_COLUMNS: Record<string, string> = {
  id: "`id` VARCHAR(30) NOT NULL",
  namaFile: "`namaFile` VARCHAR(255) NOT NULL",
  ukuran: "`ukuran` VARCHAR(50) NOT NULL DEFAULT '0'",
  tipe: "`tipe` VARCHAR(20) NOT NULL DEFAULT 'MANUAL'",
  status: "`status` VARCHAR(20) NOT NULL DEFAULT 'BERHASIL'",
  dibuatOleh: "`dibuatOleh` VARCHAR(30) NULL",
  catatan: "`catatan` TEXT NULL",
  createdAt:
    "`createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)",
};

function getDatabaseConfig() {
  const databaseUrl = String(process.env.DATABASE_URL || "").trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL belum dikonfigurasi");
  }

  let parsed: URL;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL tidak valid");
  }

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
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}

async function withConnection<T>(
  callback: (connection: Connection) => Promise<T>
): Promise<T> {
  const config = getDatabaseConfig();

  const connection = await createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectTimeout: 15000,
    charset: "utf8mb4",
  });

  try {
    return await callback(connection);
  } finally {
    try {
      await connection.end();
    } catch {
      // Abaikan error saat menutup koneksi.
    }
  }
}

// ---------------------------------------------------------------------------
// BACKUP HISTORY TABLE
// ---------------------------------------------------------------------------

let tableEnsured = false;
let tableEnsurePromise: Promise<void> | null = null;

async function ensureBackupTableInternal(): Promise<void> {
  await withConnection(async (connection) => {
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'BackupHistory'"
    );

    if (!Array.isArray(tables) || tables.length === 0) {
      const columns = Object.values(BACKUP_HISTORY_COLUMNS).join(", ");

      await connection.query(`
        CREATE TABLE IF NOT EXISTS \`BackupHistory\` (
          ${columns},
          PRIMARY KEY (\`id\`)
        )
        ENGINE=InnoDB
        DEFAULT CHARSET=utf8mb4
      `);

      console.log(
        "[backup-repo] Tabel BackupHistory berhasil dibuat"
      );

      return;
    }

    const [columnRows] = await connection.query(
      "SHOW COLUMNS FROM `BackupHistory`"
    );

    const existingColumns = new Set(
      (Array.isArray(columnRows) ? columnRows : [])
        .map((row) => String((row as { Field?: string }).Field || ""))
        .filter(Boolean)
    );

    for (const [columnName, definition] of Object.entries(
      BACKUP_HISTORY_COLUMNS
    )) {
      if (existingColumns.has(columnName)) {
        continue;
      }

      try {
        await connection.query(
          `ALTER TABLE \`BackupHistory\` ADD COLUMN ${definition}`
        );

        console.log(
          `[backup-repo] Kolom ${columnName} berhasil ditambahkan`
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);

        if (
          !message.toLowerCase().includes("duplicate") &&
          !message.toLowerCase().includes("already exists")
        ) {
          throw error;
        }
      }
    }

    // Pastikan id menjadi primary key jika tabel lama belum memilikinya.
    const [indexRows] = await connection.query(
      "SHOW INDEX FROM `BackupHistory`"
    );

    const hasPrimaryKey = Array.isArray(indexRows)
      ? indexRows.some(
          (row) =>
            String(
              (row as { Key_name?: string }).Key_name || ""
            ).toUpperCase() === "PRIMARY"
        )
      : false;

    if (!hasPrimaryKey && existingColumns.has("id")) {
      try {
        await connection.query(
          "ALTER TABLE `BackupHistory` ADD PRIMARY KEY (`id`)"
        );
      } catch (error) {
        console.warn(
          "[backup-repo] Primary key tidak dapat ditambahkan:",
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  });

  tableEnsured = true;
}

export async function ensureBackupTableMysql(): Promise<void> {
  if (tableEnsured) {
    return;
  }

  if (!tableEnsurePromise) {
    tableEnsurePromise = ensureBackupTableInternal().finally(() => {
      tableEnsurePromise = null;
    });
  }

  await tableEnsurePromise;
}

function normalizeRow(
  row: Record<string, unknown>
): BackupHistoryRow {
  const rawDate = row.createdAt;

  return {
    id: String(row.id ?? ""),
    namaFile: String(row.namaFile ?? ""),
    ukuran: String(row.ukuran ?? "0"),
    tipe: String(row.tipe ?? "MANUAL"),
    status: String(row.status ?? "BERHASIL"),
    dibuatOleh:
      row.dibuatOleh == null ? null : String(row.dibuatOleh),
    catatan:
      row.catatan == null ? null : String(row.catatan),
    createdAt:
      rawDate instanceof Date
        ? rawDate
        : new Date(String(rawDate || Date.now())),
  };
}

function generateBackupId(): string {
  return (
    "c" +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

export async function listBackupHistory(): Promise<
  BackupHistoryRow[]
> {
  await ensureBackupTableMysql();

  return withConnection(async (connection) => {
    const [rows] = await connection.query(
      "SELECT * FROM `BackupHistory` ORDER BY `createdAt` DESC"
    );

    return (Array.isArray(rows) ? rows : []).map((row) =>
      normalizeRow(row as Record<string, unknown>)
    );
  });
}

export async function createBackupHistory(input: {
  namaFile: string;
  ukuran: string;
  tipe?: string;
  status?: string;
  dibuatOleh?: string | null;
  catatan?: string | null;
}): Promise<BackupHistoryRow> {
  await ensureBackupTableMysql();

  const row: BackupHistoryRow = {
    id: generateBackupId(),
    namaFile: input.namaFile,
    ukuran: input.ukuran || "0",
    tipe: input.tipe || "MANUAL",
    status: input.status || "BERHASIL",
    dibuatOleh: input.dibuatOleh ?? null,
    catatan: input.catatan ?? null,
    createdAt: new Date(),
  };

  await withConnection(async (connection) => {
    await connection.execute(
      `
        INSERT INTO \`BackupHistory\`
        (
          \`id\`,
          \`namaFile\`,
          \`ukuran\`,
          \`tipe\`,
          \`status\`,
          \`dibuatOleh\`,
          \`catatan\`,
          \`createdAt\`
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        row.id,
        row.namaFile,
        row.ukuran,
        row.tipe,
        row.status,
        row.dibuatOleh,
        row.catatan,
        row.createdAt,
      ]
    );
  });

  return row;
}

export async function getBackupHistoryById(
  id: string
): Promise<BackupHistoryRow | null> {
  await ensureBackupTableMysql();

  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "SELECT * FROM `BackupHistory` WHERE `id` = ? LIMIT 1",
      [id]
    );

    const list = Array.isArray(rows) ? rows : [];

    return list.length
      ? normalizeRow(list[0] as Record<string, unknown>)
      : null;
  });
}

export async function deleteBackupHistory(
  id: string
): Promise<void> {
  await ensureBackupTableMysql();

  await withConnection(async (connection) => {
    await connection.execute(
      "DELETE FROM `BackupHistory` WHERE `id` = ?",
      [id]
    );
  });
}

// ---------------------------------------------------------------------------
// FILE PATHS UNTUK BACKUP
// ---------------------------------------------------------------------------

async function listFilePaths(
  tableName: string,
  columnName: string
): Promise<string[]> {
  return withConnection(async (connection) => {
    try {
      const [rows] = await connection.query(
        `SELECT \`${columnName}\` FROM \`${tableName}\`
         WHERE \`${columnName}\` IS NOT NULL
         AND \`${columnName}\` <> ''`
      );

      return (Array.isArray(rows) ? rows : [])
        .map((row) =>
          String(
            (row as Record<string, unknown>)[columnName] || ""
          ).trim()
        )
        .filter(Boolean);
    } catch (error) {
      console.warn(
        `[backup-repo] Gagal membaca file dari tabel ${tableName}:`,
        error instanceof Error ? error.message : String(error)
      );

      return [];
    }
  });
}

export async function listSertifikatFilePaths(): Promise<string[]> {
  return listFilePaths("Sertifikat", "file");
}

export async function listSuratTugasFilePaths(): Promise<string[]> {
  return listFilePaths("SuratTugas", "file");
}

export async function listDokumenPendaftaranPaths(): Promise<string[]> {
  return listFilePaths("DokumenPendaftaran", "filePath");
}

/**
 * Semua path file yang tercatat di database.
 */
export async function listAllUploadFilePaths(): Promise<string[]> {
  const [sertifikat, suratTugas, dokumenPendaftaran] =
    await Promise.all([
      listSertifikatFilePaths(),
      listSuratTugasFilePaths(),
      listDokumenPendaftaranPaths(),
    ]);

  return Array.from(
    new Set([
      ...sertifikat,
      ...suratTugas,
      ...dokumenPendaftaran,
    ])
  );
}
