import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";

export interface ResolvedFile {
  path: string | null;
  tried: string[];
}

function getConfiguredUploadDir(): string | null {
  const value = String(
    process.env.UPLOAD_DIR || ""
  ).trim();

  return value
    ? path.resolve(value)
    : null;
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isDirectory(
  directoryPath: string
): boolean {
  try {
    return fs
      .statSync(directoryPath)
      .isDirectory();
  } catch {
    return false;
  }
}

/**
 * Menormalkan path yang tersimpan di database.
 *
 * Contoh path yang didukung:
 * - uploads/sertifikat/file.pdf
 * - sertifikat/file.pdf
 * - home/u359423429/uploads-sikompetensi/uploads/sertifikat/file.pdf
 * - /home/u359423429/uploads-sikompetensi/uploads/sertifikat/file.pdf
 */
function normalizeStoredPath(
  value: string
): string {
  let normalized = String(value || "")
    .trim()
    .replace(/\\/g, "/");

  if (!normalized) {
    return "";
  }

  /*
   * Sebagian path lama tersimpan tanpa slash:
   *
   * home/u359423429/...
   *
   * Ubah menjadi:
   *
   * /home/u359423429/...
   */
  if (
    /^(home|usr|var|tmp|opt)\//.test(
      normalized
    )
  ) {
    normalized = `/${normalized}`;
  }

  /*
   * Path absolut dipertahankan dengan slash awal.
   */
  if (normalized.startsWith("/")) {
    return normalized.replace(
      /\/{2,}/g,
      "/"
    );
  }

  /*
   * Path relatif tidak boleh memiliki slash awal.
   */
  return normalized
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");
}

/**
 * Normalisasi path relatif untuk folder upload.
 */
function normalizeRelativePath(
  value: string
): string {
  return normalizeStoredPath(value).replace(
    /^\/+/,
    ""
  );
}

function getServerDir(): string | null {
  try {
    const entry = process.argv?.[1];

    if (!entry) {
      return null;
    }

    const directory = path.dirname(
      path.isAbsolute(entry)
        ? entry
        : path.resolve(entry)
    );

    return isDirectory(directory)
      ? directory
      : null;
  } catch {
    return null;
  }
}

/**
 * Root utama untuk mencari file.
 */
export function getStorageRoots(): string[] {
  const roots = [
    getConfiguredUploadDir(),
    getServerDir(),
    process.cwd(),
  ].filter(
    (value): value is string =>
      Boolean(value)
  );

  return unique(roots);
}

/**
 * Mencari folder deployment Hostinger versi lama.
 */
function versionSiblingRoots(): string[] {
  const result: string[] = [];
  const anchors = [
    getServerDir(),
    process.cwd(),
  ];

  for (const anchor of anchors) {
    if (!anchor) {
      continue;
    }

    const normalized = anchor.replace(
      /\\/g,
      "/"
    );

    const match = normalized.match(
      /^(.*\/hbuilds\/versions\/)([^/]+)(?:\/nodejs)?\/?$/
    );

    if (!match) {
      continue;
    }

    const versionsRoot = match[1];
    const currentVersion = match[2];

    let entries: string[];

    try {
      entries = fs.readdirSync(
        versionsRoot
      );
    } catch {
      continue;
    }

    const candidates: Array<{
      directory: string;
      modified: number;
    }> = [];

    for (const entry of entries) {
      if (
        !entry ||
        entry === currentVersion
      ) {
        continue;
      }

      const nodeDirectory = path.join(
        versionsRoot,
        entry,
        "nodejs"
      );

      const plainDirectory = path.join(
        versionsRoot,
        entry
      );

      let directory: string | null =
        null;

      if (isDirectory(nodeDirectory)) {
        directory = nodeDirectory;
      } else if (
        isDirectory(plainDirectory)
      ) {
        directory = plainDirectory;
      }

      if (!directory) {
        continue;
      }

      let modified = 0;

      try {
        modified =
          fs.statSync(directory).mtimeMs;
      } catch {
        // Abaikan jika waktu folder tidak dapat dibaca.
      }

      candidates.push({
        directory,
        modified,
      });
    }

    candidates.sort(
      (a, b) =>
        b.modified - a.modified
    );

    for (const candidate of candidates.slice(
      0,
      30
    )) {
      result.push(candidate.directory);
    }
  }

  return unique(result);
}

/**
 * Membuat variasi path relatif.
 *
 * Jika database menyimpan:
 * - sertifikat/file.pdf
 *
 * aplikasi juga mencoba:
 * - uploads/sertifikat/file.pdf
 */
function getRelativePathVariants(
  value: string
): string[] {
  const normalized = normalizeStoredPath(
    value
  );

  if (
    !normalized ||
    path.isAbsolute(normalized)
  ) {
    return [];
  }

  const relative = normalizeRelativePath(
    normalized
  );

  if (!relative) {
    return [];
  }

  const variants = [relative];

  if (!relative.startsWith("uploads/")) {
    variants.push(`uploads/${relative}`);
  }

  if (
    relative.startsWith("uploads/")
  ) {
    const withoutUploads =
      relative.slice("uploads/".length);

    if (withoutUploads) {
      variants.push(withoutUploads);
    }
  }

  return unique(variants);
}

/**
 * Membuat variasi target path untuk storage persistent.
 */
function getPersistentTargetRelativePath(
  storedPath: string,
  moduleDir: string | undefined,
  fileName: string
): string {
  const normalized = normalizeStoredPath(
    storedPath
  );

  /*
   * Jika path dari database sudah relatif,
   * pertahankan struktur foldernya.
   */
  if (
    normalized &&
    !path.isAbsolute(normalized)
  ) {
    const relative =
      normalizeRelativePath(normalized);

    if (relative.startsWith("uploads/")) {
      return relative;
    }

    return path.posix.join(
      "uploads",
      relative
    );
  }

  /*
   * Jika path lama absolut atau tidak valid,
   * simpan berdasarkan moduleDir.
   */
  const cleanModuleDir =
    normalizeRelativePath(
      moduleDir || "general"
    );

  const safeFileName = path.basename(
    fileName
  );

  return path.posix.join(
    "uploads",
    cleanModuleDir,
    safeFileName
  );
}

/**
 * Mencari file berdasarkan path yang tersimpan
 * di database.
 */
export function resolveStoredFile(
  storedPath: string,
  moduleDir?: string
): ResolvedFile {
  const tried: string[] = [];
  const normalized = normalizeStoredPath(
    storedPath
  );

  if (!normalized) {
    return {
      path: null,
      tried,
    };
  }

  /*
   * 1. Path absolut.
   *
   * Contoh:
   * /home/u359423429/...
   */
  if (path.isAbsolute(normalized)) {
    tried.push(normalized);

    if (isFile(normalized)) {
      return {
        path: normalized,
        tried: unique(tried),
      };
    }
  }

  const relativePaths =
    getRelativePathVariants(normalized);

  const primaryRoots =
    getStorageRoots();

  /*
   * 2. Cari di root utama.
   */
  for (const root of primaryRoots) {
    for (const relativePath of relativePaths) {
      const candidate = path.join(
        root,
        relativePath
      );

      tried.push(candidate);

      if (isFile(candidate)) {
        return {
          path: candidate,
          tried: unique(tried),
        };
      }
    }
  }

  /*
   * 3. Cari di folder deployment versi lama.
   */
  const oldVersionRoots =
    versionSiblingRoots();

  for (const root of oldVersionRoots) {
    for (const relativePath of relativePaths) {
      const candidate = path.join(
        root,
        relativePath
      );

      tried.push(candidate);

      if (isFile(candidate)) {
        return {
          path: candidate,
          tried: unique(tried),
        };
      }
    }
  }

  /*
   * 4. Format lama:
   *
   * <root>/<moduleDir>/<filename>
   *
   * atau:
   *
   * <root>/uploads/<moduleDir>/<filename>
   */
  if (moduleDir) {
    const cleanModuleDir =
      normalizeRelativePath(
        moduleDir
      );

    const fileName = path.basename(
      normalized
    );

    const moduleCandidates = [
      path.posix.join(
        cleanModuleDir,
        fileName
      ),
      path.posix.join(
        "uploads",
        cleanModuleDir,
        fileName
      ),
    ];

    for (const root of [
      ...primaryRoots,
      ...oldVersionRoots,
    ]) {
      for (const relativePath of unique(
        moduleCandidates
      )) {
        const candidate = path.join(
          root,
          relativePath
        );

        tried.push(candidate);

        if (isFile(candidate)) {
          return {
            path: candidate,
            tried: unique(tried),
          };
        }
      }
    }
  }

  return {
    path: null,
    tried: unique(tried),
  };
}

/**
 * Memindahkan file lama ke UPLOAD_DIR
 * jika ditemukan.
 */
export async function resolveStoredFileDurable(
  storedPath: string,
  moduleDir?: string
): Promise<ResolvedFile> {
  const result = resolveStoredFile(
    storedPath,
    moduleDir
  );

  const uploadDir =
    getConfiguredUploadDir();

  if (!result.path || !uploadDir) {
    return result;
  }

  const persistentRoot =
    path.resolve(uploadDir);

  const persistentPrefix =
    `${persistentRoot}${path.sep}`;

  const currentPath = path.resolve(
    result.path
  );

  /*
   * File sudah berada di storage persistent.
   */
  if (
    currentPath === persistentRoot ||
    currentPath.startsWith(persistentPrefix)
  ) {
    return result;
  }

  try {
    const targetRelativePath =
      getPersistentTargetRelativePath(
        storedPath,
        moduleDir,
        path.basename(result.path)
      );

    const target = path.resolve(
      uploadDir,
      targetRelativePath
    );

    const targetPrefix =
      `${persistentRoot}${path.sep}`;

    /*
     * Perlindungan path traversal.
     */
    if (
      target !== persistentRoot &&
      !target.startsWith(targetPrefix)
    ) {
      throw new Error(
        "Target file berada di luar UPLOAD_DIR"
      );
    }

    if (!isFile(target)) {
      await fsp.mkdir(
        path.dirname(target),
        {
          recursive: true,
        }
      );

      await fsp.copyFile(
        result.path,
        target
      );

      console.log(
        `[storage] File lama dimigrasikan ke storage persisten: ${target}`
      );
    }

    return {
      path: target,
      tried: unique([
        ...result.tried,
        target,
      ]),
    };
  } catch (error) {
    console.warn(
      "[storage] Migrasi file ke UPLOAD_DIR gagal:",
      error instanceof Error
        ? error.message
        : String(error)
    );

    /*
     * Jika migrasi gagal, file lama tetap
     * digunakan agar proses backup tidak langsung gagal.
     */
    return result;
  }
}

/**
 * Root untuk menyimpan file baru.
 *
 * Tidak menggunakan process.cwd()
 * sebagai fallback.
 */
export function getWriteRoot(): string {
  const uploadDir =
    getConfiguredUploadDir();

  if (!uploadDir) {
    throw new Error(
      "UPLOAD_DIR belum terbaca. Upload dibatalkan agar file tidak tersimpan di folder deployment."
    );
  }

  return uploadDir;
}

/**
 * Membuat folder upload persisten.
 *
 * Contoh:
 *
 * UPLOAD_DIR=/home/u359423429/uploads-sikompetensi
 * moduleDir=sertifikat
 *
 * Hasil:
 *
 * /home/u359423429/uploads-sikompetensi/uploads/sertifikat
 */
export async function getUploadDir(
  moduleDir: string
): Promise<string> {
  const cleanModuleDir =
    normalizeRelativePath(moduleDir);

  if (
    !cleanModuleDir ||
    cleanModuleDir.includes("..") ||
    path.isAbsolute(cleanModuleDir) ||
    cleanModuleDir.includes(":")
  ) {
    throw new Error(
      "Nama folder upload tidak valid"
    );
  }

  const root = getWriteRoot();

  const directory = path.resolve(
    root,
    "uploads",
    cleanModuleDir
  );

  const rootResolved =
    path.resolve(root);

  const rootPrefix =
    `${rootResolved}${path.sep}`;

  if (
    directory !== rootResolved &&
    !directory.startsWith(rootPrefix)
  ) {
    throw new Error(
      "Folder upload berada di luar UPLOAD_DIR"
    );
  }

  await fsp.mkdir(directory, {
    recursive: true,
  });

  return directory;
}

/**
 * Format path relatif yang disimpan
 * ke database.
 *
 * Hasil:
 * uploads/sertifikat/file.pdf
 */
export function storedRelativePath(
  moduleDir: string,
  fileName: string
): string {
  const cleanModuleDir =
    normalizeRelativePath(moduleDir);

  const cleanFileName =
    path.basename(fileName);

  if (!cleanModuleDir) {
    return `uploads/${cleanFileName}`;
  }

  return `uploads/${cleanModuleDir}/${cleanFileName}`;
}

/**
 * Menghapus file upload dari lokasi
 * yang ditemukan.
 */
export async function safeUnlinkStored(
  storedPath: string,
  moduleDir?: string
): Promise<void> {
  try {
    const result = resolveStoredFile(
      storedPath,
      moduleDir
    );

    if (result.path) {
      await fsp.unlink(result.path);
    }
  } catch {
    /*
     * Penghapusan bersifat best effort.
     */
  }
}
