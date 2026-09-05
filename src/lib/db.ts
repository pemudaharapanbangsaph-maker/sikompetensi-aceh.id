import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

/**
 * Menambahkan batas koneksi Prisma untuk MySQL.
 */
export function augmentMysqlUrl(url: string): string {
  const value = String(url || "").trim();

  if (!value.toLowerCase().startsWith("mysql://")) {
    return value;
  }

  if (/connection_limit=/i.test(value)) {
    return value;
  }

  return `${value}${value.includes("?") ? "&" : "?"}connection_limit=5`;
}

function getDatabaseUrl(): string {
  return String(process.env.DATABASE_URL || "").trim();
}

function clientOptions(): Prisma.PrismaClientOptions {
  const databaseUrl = getDatabaseUrl();

  const options: Prisma.PrismaClientOptions = {
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  };

  if (databaseUrl) {
    options.datasources = {
      db: {
        url: augmentMysqlUrl(databaseUrl),
      },
    };
  }

  return options;
}

function createClient(): PrismaClient {
  return new PrismaClient(clientOptions());
}

/**
 * Gunakan satu instance Prisma di development maupun production.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

let current: PrismaClient =
  globalForPrisma.prisma ?? createClient();

/**
 * Proxy ini menjaga agar seluruh aplikasi tetap menggunakan
 * instance Prisma terbaru jika recreatePrismaClient() dipanggil.
 */
export const db = new Proxy(current, {
  get(_target, property) {
    const value = Reflect.get(current, property, current);

    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(current)
      : value;
  },

  has(_target, property) {
    return Reflect.has(current, property);
  },

  set(_target, property, value) {
    Reflect.set(current, property, value, current);
    return true;
  },
}) as PrismaClient;

globalForPrisma.prisma = current;

/**
 * Memeriksa apakah Prisma Client memiliki model tertentu.
 */
export function prismaModelExists(name: string): boolean {
  try {
    return Boolean(
      (current as unknown as Record<string, unknown>)[name]
    );
  } catch {
    return false;
  }
}

/**
 * Membuat ulang instance Prisma tanpa mengakses require-cache,
 * createRequire, path, atau storage.
 */
export function recreatePrismaClient(): boolean {
  try {
    const previous = current;
    const fresh = createClient();

    current = fresh;
    globalForPrisma.prisma = fresh;

    // Menutup koneksi lama secara best-effort.
    void previous.$disconnect().catch(() => undefined);

    console.log("[db] PrismaClient berhasil dibuat ulang");

    return true;
  } catch (error) {
    console.error(
      "[db] Gagal membuat ulang PrismaClient:",
      error instanceof Error ? error.message : String(error)
    );

    return false;
  }
}
