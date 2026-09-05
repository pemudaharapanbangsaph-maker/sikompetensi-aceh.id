import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, auditLog } from "@/lib/auth";
import { parseListParams, buildWhere } from "@/lib/api-helpers";
import {
  getUploadDir,
  storedRelativePath,
} from "@/lib/storage";
import * as fs from "fs/promises";
import * as path from "path";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_SORT = [
  "namaPeserta",
  "nomorSertifikat",
  "jenis",
  "tanggalTerbit",
  "createdAt",
] as const;

const ALLOWED_EXT = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
];

const MAX_SIZE = 10 * 1024 * 1024;

function isAllowedSort(value: unknown): value is (typeof ALLOWED_SORT)[number] {
  return (
    typeof value === "string" &&
    (ALLOWED_SORT as readonly string[]).includes(value)
  );
}

function getStringValue(
  formData: FormData,
  key: string
): string | null {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
    },
  });
}

export async function GET(req: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const params = parseListParams(
      new URL(req.url).searchParams
    );

    const {
      page,
      pageSize,
      search,
      sortBy,
      sortOrder,
      jenis,
      ...rest
    } = params;

    const filters: Record<
      string,
      string | number | undefined
    > = {};

    if (jenis) {
      filters.jenis = jenis as string;
    }

    for (const [key, value] of Object.entries(rest)) {
      if (
        value !== undefined &&
        value !== "" &&
        key !== "page" &&
        key !== "pageSize" &&
        key !== "search" &&
        key !== "sortBy" &&
        key !== "sortOrder"
      ) {
        filters[key] = value as string;
      }
    }

    const currentPage = Math.max(1, Number(page) || 1);
    const currentPageSize = Math.min(
      100,
      Math.max(1, Number(pageSize) || 20)
    );

    const where = buildWhere(
      String(search || ""),
      [
        "namaPeserta",
        "nomorSertifikat",
        "namaKegiatan",
      ],
      filters
    );

    const safeSortBy = isAllowedSort(sortBy)
      ? sortBy
      : "createdAt";

    const safeSortOrder =
      sortOrder === "asc" ? "asc" : "desc";

    const [data, total] = await Promise.all([
      db.sertifikat.findMany({
        where,
        skip: (currentPage - 1) * currentPageSize,
        take: currentPageSize,
        orderBy: {
          [safeSortBy]: safeSortOrder,
        },
        include: {
          angkatan: {
            select: {
              id: true,
              namaAngkatan: true,
              pelatihanId: true,
              pelatihan: {
                select: {
                  id: true,
                  nama: true,
                  kode: true,
                },
              },
            },
          },
          peserta: {
            select: {
              id: true,
              nama: true,
              nip: true,
            },
          },
          ujiKompetensi: {
            select: {
              id: true,
              kode: true,
              skemaSertifikasi: true,
            },
          },
        },
      }),
      db.sertifikat.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages: Math.ceil(total / currentPageSize),
    });
  } catch (error) {
    console.error(
      "[sertifikat] Gagal memuat data:",
      error
    );

    return NextResponse.json(
      { error: "Gagal memuat data sertifikat" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let createdFilePath: string | null = null;

  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const uploadedValue = formData.get("file");

    if (!(uploadedValue instanceof File)) {
      return NextResponse.json(
        {
          error:
            "File sertifikat wajib diupload menggunakan field file",
        },
        { status: 400 }
      );
    }

    if (uploadedValue.size <= 0) {
      return NextResponse.json(
        { error: "File sertifikat kosong" },
        { status: 400 }
      );
    }

    if (uploadedValue.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "Ukuran file maksimal 10MB" },
        { status: 400 }
      );
    }

    const jenis =
      getStringValue(formData, "jenis") || "PELATIHAN";

    if (
      jenis !== "PELATIHAN" &&
      jenis !== "UJI_KOMPETENSI"
    ) {
      return NextResponse.json(
        {
          error:
            "Jenis harus PELATIHAN atau UJI_KOMPETENSI",
        },
        { status: 400 }
      );
    }

    const originalName = path.basename(
      uploadedValue.name || ""
    );

    const extension = path
      .extname(originalName)
      .toLowerCase();

    if (!ALLOWED_EXT.includes(extension)) {
      return NextResponse.json(
        {
          error: `Format file harus: ${ALLOWED_EXT.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const uploadDir = await getUploadDir("sertifikat");
    const uniqueName = `${crypto.randomUUID()}${extension}`;

    createdFilePath = path.join(
      uploadDir,
      uniqueName
    );

    const bytes = Buffer.from(
      await uploadedValue.arrayBuffer()
    );

    await fs.writeFile(createdFilePath, bytes);

    const storedPath = storedRelativePath(
      "sertifikat",
      uniqueName
    );

    const tanggalTerbitValue = getStringValue(
      formData,
      "tanggalTerbit"
    );

    const item = await db.sertifikat.create({
      data: {
        jenis,
        angkatanId: getStringValue(
          formData,
          "angkatanId"
        ),
        ujiKompetensiId: getStringValue(
          formData,
          "ujiKompetensiId"
        ),
        pesertaId: getStringValue(
          formData,
          "pesertaId"
        ),
        nomorSertifikat: getStringValue(
          formData,
          "nomorSertifikat"
        ),
        namaPeserta: getStringValue(
          formData,
          "namaPeserta"
        ),
        namaKegiatan: getStringValue(
          formData,
          "namaKegiatan"
        ),
        file: storedPath,
        ukuranFile: `${(
          uploadedValue.size / 1024
        ).toFixed(1)} KB`,
        tanggalTerbit: tanggalTerbitValue
          ? new Date(tanggalTerbitValue)
          : null,
        catatan: getStringValue(
          formData,
          "catatan"
        ),
      },
      include: {
        angkatan: {
          select: {
            id: true,
            namaAngkatan: true,
            pelatihanId: true,
            pelatihan: {
              select: {
                id: true,
                nama: true,
                kode: true,
              },
            },
          },
        },
        peserta: {
          select: {
            id: true,
            nama: true,
            nip: true,
          },
        },
        ujiKompetensi: {
          select: {
            id: true,
            kode: true,
            skemaSertifikasi: true,
          },
        },
      },
    });

    await auditLog(
      session,
      "CREATE",
      "SERTIFIKAT",
      `Tambah sertifikat: ${
        item.nomorSertifikat ||
        item.namaPeserta ||
        item.id
      }`,
      req
    );

    return NextResponse.json(item, {
      status: 201,
    });
  } catch (error) {
    if (createdFilePath) {
      try {
        await fs.unlink(createdFilePath);
      } catch {
        // Abaikan jika file gagal dihapus.
      }
    }

    console.error(
      "[sertifikat] Gagal membuat sertifikat:",
      error
    );

    return NextResponse.json(
      { error: "Gagal menambah sertifikat" },
      { status: 500 }
    );
  }
}
