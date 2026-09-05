import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";

export interface ResolvedFile {
  path: string | null;
  tried: string[];
}

function getConfiguredUploadDir(): string | null {
  const value = String(process.env.UPLOAD_DIR || "").trim();

  return value ? path.resolve(value) : null;
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

function isDirectory(directoryPath: string): boolean {
  try {
    return fs.statSync(directoryPath).isDirectory();
  } catch {
    return false;
  }
}

function normalizeRelativePath(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

function getServerDir(): string | null {
  try {
    const entry = process.argv?.[1];

    if (!entry) {
      return null;
    }

    const directory = path.dirname(
      path.isAbsolute(entry) ? entry : path.resolve(entry)
    );

    return isDirectory(directory) ? directory : null;
  } catch {
    return null;
  }
}

/**
 * Root utama untuk mencari file lama.
 */
export function getStorageRoots(): string[] {
  const roots = [
    getConfiguredUploadDir(),
    getServerDir(),
    process.cwd(),
  ].filter((value): value is string => Boolean(value));

  return unique(roots);
}

/**
 * Mencari folder deployment Hostinger versi lama.
 */
function versionSiblingRoots(): string[] {
  const result: string[] = [];
  const anchors = [getServerDir(), process.cwd()];

  for (const anchor of anchors) {
    if (!anchor) {
      continue;
    }

    const normalized = anchor.replace(/\\/g, "/");

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
      entries = fs.readdirSync(versionsRoot);
    } catch {
      continue;
    }

    const candidates: Array<{
      directory: string;
      modified: number;
    }> = [];

    for (const entry of entries) {
      if (!entry || entry === currentVersion) {
        continue;
      }

      const nodeDirectory = path.join(versionsRoot, entry, "nodejs");
      const plainDirectory = path.join(versionsRoot, entry);

      let directory: string | null = null;

      if (isDirectory(nodeDirectory)) {
        directory = nodeDirectory;
      } else if (isDirectory(plainDirectory)) {
        directory = plainDirectory;
      }

      if (!directory) {
        continue;
      }

      let modified = 0;

      try {
        modified = fs.statSync(directory).mtimeMs;
      } catch {
        // Abaikan jika waktu folder tidak dapat dibaca.
      }

      candidates.push({
        directory,
        modified,
      });
    }

    candidates.sort((a, b) => b.modified - a.modified);

    for (const candidate of candidates.slice(0, 30)) {
      result.push(candidate.directory);
    }
  }

  return unique(result);
}

/**
 * Mencari file berdasarkan path yang tersimpan di database.
 */
export function resolveStoredFile(
  storedPath: string,
  moduleDir?: string
): ResolvedFile {
  const tried: string[] = [];
  const normalized = String(storedPath || "")
    .trim()
    .replace(/\\/g, "/");

  if (!normalized) {
    return {
      path: null,
      tried,
    };
  }

  // Dukungan untuk path absolut lama.
  if (path.isAbsolute(normalized)) {
    tried.push(normalized);

    if (isFile(normalized)) {
      return {
        path: normalized,
        tried: unique(tried),
      };
    }
  }

  const relativePath = normalizeRelativePath(normalized);

  if (!relativePath) {
    return {
      path: null,
      tried: unique(tried),
    };
  }

  const fileName = path.basename(relativePath);
  const primaryRoots = getStorageRoots();

  // Lokasi utama.
  for (const root of primaryRoots) {
    const candidate = path.join(root, relativePath);

    tried.push(candidate);

    if (isFile(candidate)) {
      return {
        path: candidate,
        tried: unique(tried),
      };
    }
  }

  // Folder deployment versi lama.
  const oldVersionRoots = versionSiblingRoots();

  for (const root of oldVersionRoots) {
    const candidate = path.join(root, relativePath);

    tried.push(candidate);

    if (isFile(candidate)) {
      return {
        path: candidate,
        tried: unique(tried),
      };
    }
  }

  // Format lama: <root>/<moduleDir>/<filename>.
  if (moduleDir) {
    const cleanModuleDir = normalizeRelativePath(moduleDir);

    for (const root of [...primaryRoots, ...oldVersionRoots]) {
      const candidate = path.join(
        root,
        cleanModuleDir,
        fileName
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

  return {
    path: null,
    tried: unique(tried),
  };
}

/**
 * Memindahkan file lama ke UPLOAD_DIR jika ditemukan.
 */
export async function resolveStoredFileDurable(
  storedPath: string,
  moduleDir?: string
): Promise<ResolvedFile> {
  const result = resolveStoredFile(storedPath, moduleDir);
  const uploadDir = getConfiguredUploadDir();

  if (!result.path || !uploadDir) {
    return result;
  }

  const persistentRoot = `${path.resolve(uploadDir)}${path.sep}`;
  const currentPath = path.resolve(result.path);

  // File sudah berada di storage persisten.
  if (
    currentPath === path.resolve(uploadDir) ||
    currentPath.startsWith(persistentRoot)
  ) {
    return result;
  }

  try {
    const normalized = normalizeRelativePath(storedPath);

    const targetRelativePath =
      normalized && !path.isAbsolute(normalized)
        ? normalized
        : path.join(
            normalizeRelativePath(moduleDir || "general"),
            path.basename(result.path)
          );

    const target = path.resolve(uploadDir, targetRelativePath);
    const storageRoot = path.resolve(uploadDir);
    const storagePrefix = `${storageRoot}${path.sep}`;

    // Perlindungan path traversal.
    if (
      target !== storageRoot &&
      !target.startsWith(storagePrefix)
    ) {
      throw new Error("Target file berada di luar UPLOAD_DIR");
    }

    if (!isFile(target)) {
      await fsp.mkdir(path.dirname(target), {
        recursive: true,
      });

      await fsp.copyFile(result.path, target);

      console.log(
        `[storage] File lama dimigrasikan ke storage persisten: ${target}`
      );
    }

    return {
      path: target,
      tried: unique([...result.tried, target]),
    };
  } catch (error) {
    console.warn(
      "[storage] Migrasi file ke UPLOAD_DIR gagal:",
      error instanceof Error ? error.message : String(error)
    );

    // Tetap gunakan file lama jika proses migrasi gagal.
    return result;
  }
}

/**
 * Root untuk menyimpan file baru.
 * Tidak memakai process.cwd() sebagai fallback.
 */
export function getWriteRoot(): string {
  const uploadDir = getConfiguredUploadDir();

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
 * UPLOAD_DIR=/home/u359423429/uploads-sikompetensi
 * moduleDir=sertifikat
 *
 * Hasil:
 * /home/u359423429/uploads-sikompetensi/uploads/sertifikat
 */
export async function getUploadDir(
  moduleDir: string
): Promise<string> {
  const cleanModuleDir = normalizeRelativePath(moduleDir);

  if (
    !cleanModuleDir ||
    cleanModuleDir.includes("..") ||
    path.isAbsolute(cleanModuleDir)
  ) {
    throw new Error("Nama folder upload tidak valid");
  }

  const root = getWriteRoot();
  const directory = path.resolve(
    root,
    "uploads",
    cleanModuleDir
  );

  const rootPrefix = `${path.resolve(root)}${path.sep}`;

  if (
    directory !== path.resolve(root) &&
    !directory.startsWith(rootPrefix)
  ) {
    throw new Error("Folder upload berada di luar UPLOAD_DIR");
  }

  await fsp.mkdir(directory, {
    recursive: true,
  });

  return directory;
}

/**
 * Format path relatif yang disimpan ke database.
 */
export function storedRelativePath(
  moduleDir: string,
  fileName: string
): string {
  const cleanModuleDir = normalizeRelativePath(moduleDir);
  const cleanFileName = path.basename(fileName);

  return `uploads/${cleanModuleDir}/${cleanFileName}`;
}

/**
 * Menghapus file upload dari lokasi yang ditemukan.
 */
export async function safeUnlinkStored(
  storedPath: string,
  moduleDir?: string
): Promise<void> {
  try {
    const result = resolveStoredFile(storedPath, moduleDir);

    if (result.path) {
      await fsp.unlink(result.path);
    }
  } catch {
    // Penghapusan bersifat best effort.
  }
}
