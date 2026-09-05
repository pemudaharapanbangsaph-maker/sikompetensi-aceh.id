// src/instrumentation.ts

export async function register() {
  // Jalankan hanya pada runtime Node.js.
  // Jangan jalankan pada Edge Runtime atau saat proses browser.
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  try {
    // Import hanya saat aplikasi berjalan di server.
    const schema = await import("./lib/ensure-schema");
    const backupRepo = await import("./lib/backup-repo");
    const db = await import("./lib/db");

    if (typeof schema.ensurePendaftaranEmailColumn === "function") {
      await schema.ensurePendaftaranEmailColumn();
    }

    if (typeof schema.ensureBackupHistoryTable === "function") {
      await schema.ensureBackupHistoryTable();
    }

    if (typeof backupRepo.ensureBackupTableMysql === "function") {
      await backupRepo.ensureBackupTableMysql();
    }

    if (typeof db.recreatePrismaClient === "function") {
      await db.recreatePrismaClient();
    }

    console.log("[instrumentation] Server initialization completed");
  } catch (error) {
    console.error("[instrumentation] Server initialization failed:", error);

    // Jangan menghentikan proses build/startup hanya karena
    // pemeriksaan database gagal.
  }
}
