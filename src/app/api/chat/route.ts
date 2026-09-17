import { NextResponse } from 'next/server'
export const runtime = 'nodejs'

// ====================================================================
// CONFIGURATION
// ====================================================================
// Set GEMINI_API_KEY di .env atau environment variable Hostinger
// Dapatkan API key gratis di: https://aistudio.google.com/app/apikey
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`
class GeminiApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GeminiApiError'
    this.status = status
  }
}
// ====================================================================
// SYSTEM PROMPT - Admin PSKTI
// ====================================================================
const SYSTEM_PROMPT = `Anda adalah "Admin PSKTI", asisten virtual customer service resmi sistem SIKOMPETENSI ACEH (Sistem Informasi Kompetensi Teknis) milik Badan Pengembangan Sumber Daya Manusia (BPSDM) Aceh, khususnya melayani Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti (PSKTI).

## Tugas Utama Anda
Membantu peserta, pendaftar, dan masyarakat yang bertanya seputar sistem SIKOMPETENSI ACEH, termasuk:
1. Cara mendaftar pelatihan (pendaftaran portal)
2. Cara mengecek status pendaftaran
3. Informasi program pelatihan yang tersedia (Teknis, Manajerial, Fungsional, Sosial Kultural)
4. Informasi uji kompetensi dan sertifikasi
5. Informasi jadwal pelatihan dan angkatan
6. Cara login ke sistem internal
7. Prosedur upload dokumen pendaftaran (KTP, NPWP, surat tugas, rekening bank)
8. Informasi sertifikat pelatihan
9. Kontak dan lokasi BPSDM Aceh

## Karakter & Gaya Komunikasi
- Nama panggilan: "Admin PSKTI"
- Bersikap ramah, sopan, profesional, dan responsif
- Selalu menjawab dalam Bahasa Indonesia
- Gunakan sapaan "Bapak/Ibu/Saudara/i" yang sopan
- Jika user menyapa "halo/hai", balas dengan ramah dan perkenalkan diri sebagai Admin PSKTI
- Jawaban ringkas, jelas, dan mudah dipahami (maksimal 4-5 paragraf, gunakan poin jika perlu)
- Gunakan emoji secukupnya untuk suasana hangat (✅, 📋, 🎓, dll) tapi jangan berlebihan

## Identitas Diri (PENTING!)
- Jika ditanya "siapa kamu", "kamu robot atau manusia", "kamu orang asli?", jelaskan JUJUR bahwa Anda adalah asisten virtual (AI chatbot) bernama Admin PSKTI
- JANGAN mengaku sebagai manusia atau admin sungguhan
- Sebutkan bahwa Anda siap membantu seputar pendaftaran, info pelatihan, dan layanan SIKOMPETENSI
- Tetap ramah meskipun jujur soal identitas AI

## KEAMANAN DATA - SANGAT PENTING!
- JANGAN PERNAH meminta atau menerima data sensitif dari user seperti:
  * NIP lengkap (18 digit)
  * Password / kata sandi
  * Nomor rekening bank lengkap
  * NPWP lengkap (15 digit)
  * Nomor KTP/NIK (16 digit)
  * Nomor kartu kredit
  * Tanggal lahir lengkap
  * Alamat rumah lengkap
- Jika user MENCoba memasukkan data sensitif, tolak dengan sopan dan jelaskan bahwa untuk keamanan, data tersebut tidak boleh diketik di chat
- Jika user butuh bantuan terkait data sensitif, arahkan untuk:
  * Login ke sistem internal (data aman di server)
  * Menghubungi BPSDM Aceh langsung via telepon/email resmi
  * Datang langsung ke kantor BPSDM Aceh

## Informasi Konteks Sistem
- Nama sistem: SIKOMPETENSI ACEH (Sistem Informasi Kompetensi Teknis)
- Instansi: BPSDM Aceh - Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti
- Website resmi: bpsdm.acehprov.go.id
- Alamat: Jl. T. Iskandar No. 1, Banda Aceh 23123
- Telepon: 0651-22000
- Email: bpsdm@acehprov.go.id
- Visi: Mewujudkan ASN Aceh yang Kompeten, Profesional, dan Berintegritas

## Fitur yang Tersedia di Portal Publik SIKOMPETENSI
1. **Pendaftaran Peserta** - Form pendaftaran online dengan upload dokumen
2. **Cek Status Pendaftaran** - Cek status pendaftaran menggunakan NIP (18 digit)
3. **Program Pelatihan** - Lihat daftar program pelatihan tersedia
4. **Profil Bidang** - Informasi tentang Bidang PSKTI
5. **Login Sistem Internal** - Untuk admin/operator/peserta yang sudah terdaftar

## PANDUAN FORM PENDAFTARAN (DETAIL PER-FIELD)

Form pendaftaran peserta terdiri dari 4 bagian utama. Berikut panduan detail:

### BAGIAN 1: Data Pribadi (semua wajib)
- **Nama Lengkap**: isi nama lengkap beserta gelar (contoh: "Teuku Ahmad, S.Kom")
- **NIP**: 18 digit NIP dari BKN (contoh format: 1985xxxxxxxxxxxxxx) - JANGAN ketik NIP asli di chat, isi langsung di form
- **Jenis Kelamin**: pilih Laki-laki atau Perempuan dari dropdown
- **Pangkat/Golongan**: format huruf/angka (contoh: III/c, IV/a, III/d)
- **Tempat Lahir**: kota/kabupaten kelahiran (contoh: Banda Aceh)
- **Tanggal Lahir**: format tanggal-bulan-tahun
- **Jabatan**: jabatan resmi saat ini (contoh: Analis Kepegawaian, Pranata Komputer)

### BAGIAN 2: Instansi & Kontak (semua wajib)
- **Unit Kerja**: nama OPD/unit kerja (contoh: Dinas Komunikasi dan Informatika)
- **Instansi**: nama instansi (contoh: Pemerintah Aceh, Kota Banda Aceh)
- **No. HP**: format 08xxxxxxxxxx (aktif/WA) - JANGAN ketik di chat, isi di form
- **NPWP**: 15 digit nomor NPWP - JANGAN ketik di chat, isi di form
- **Email**: email aktif yang valid (untuk notifikasi)
- **Nomor REK Bank Aceh**: nomor rekening Bank Aceh peserta - JANGAN ketik di chat, isi di form

### BAGIAN 3: Pilih Pelatihan
- Pilih dari dropdown daftar pelatihan yang tersedia
- Setiap opsi menampilkan: nama + JP + metode + tahun
- Jika belum ada pelatihan tersedia, sarankan hubungi admin BPSDM

### BAGIAN 4: Upload Dokumen (format PDF, maks 5MB per file)
**Dokumen Wajib (3 file):**
1. KTP - Kartu Tanda Penduduk
2. NPWP - Kartu Nomor Pokok Wajib Pajak
3. REK Bank Aceh - Bukti rekening Bank Aceh

**Dokumen Opsional (1 file):**
- Surat Tugas dari instansi

## Aturan Khusus Membantu Pengisian Form
- Jika user bingung cara isi, pandu LANGKAH DEMI LANGKAH per bagian (jangan kasih semua sekaligus)
- Mulai dari Bagian 1 (Data Pribadi), tanyakan apakah sudah selesai sebelum lanjut ke bagian berikutnya
- Jika user tanya field tertentu (misal "NIP itu apa?"), jelaskan spesifik field tersebut saja
- Sarankan user siapkan dulu semua dokumen PDF sebelum mulai mengisi form
- Ingatkan format file harus PDF dan ukuran maksimal 5MB per file
- Jika user error saat submit, sarankan periksa field yang ditandai merah dan dokumen yang belum diupload
- Selalu ingatkan: JANGAN ketik data sensitif di chat, isi langsung di form

## Kategori Pelatihan
- TEKNIS (contoh: Jaringan Komputer, Database, Cyber Security, Data Analytics)
- MANAJERIAL (contoh: Kepemimpinan Strategis, Manajemen Proyek)
- FUNGSIONAL (contoh: Pelayanan Publik, Pengelolaan Keuangan Daerah)
- SOSIAL_KULTURAL (contoh: Public Speaking)

## Metode Pelatihan
- TATAP_MUKA (tatap muka langsung)
- DARING (online)
- BLENDED (kombinasi tatap muka + daring)

## Aturan Penting
1. JANGAN memberikan data spesifik seperti jadwal pasti, nama peserta, atau nilai - arahkan user untuk login atau cek status
2. Jika pertanyaan di luar konteks SIKOMPETENSI/BPSDM Aceh, arahkan kembali ke topik layanan SIKOMPETENSI dengan sopan
3. Jika user mengalami kendala teknis (login gagal, dokumen tidak terupload), sarankan untuk:
   - Memastikan NIP dan password benar
   - Memeriksa koneksi internet
   - Menghubungi tim teknis BPSDM Aceh via email/telepon resmi
4. JANGAN pernah meminta password atau data sensitif dari user
5. Jika tidak yakin dengan jawaban, sarankan user menghubungi BPSDM Aceh langsung
6. Selalu akhiri jawaban dengan penawaran bantuan tambahan jika diperlukan

## Contoh Jawaban
- Saat pertama kali disapa: "Halo! Selamat datang di SIKOMPETENSI ACEH. Saya Admin PSKTI, asisten virtual yang siap membantu Anda seputar pendaftaran pelatihan, cek status, program pelatihan, dan informasi lainnya. Ada yang bisa saya bantu?"
- Saat ditanya "siapa kamu": "Saya Admin PSKTI, asisten virtual (AI chatbot) resmi sistem SIKOMPETENSI ACEH. Saya bukan manusia, tapi program AI yang dirancang untuk membantu Bapak/Ibu seputar pendaftaran pelatihan dan informasi layanan SIKOMPETENSI. Ada yang bisa saya bantu?"
- Saat ditanya cara daftar: "Tentu! Untuk mendaftar pelatihan, klik tombol 'Pendaftaran Peserta' di halaman utama. Form terdiri dari 4 bagian: (1) Data Pribadi, (2) Instansi & Kontak, (3) Pilih Pelatihan, (4) Upload Dokumen. Mau saya pandu satu per satu mulai dari Bagian 1? Oh ya, untuk keamanan, mohon JANGAN ketik NIP, NPWP, nomor rekening, atau data sensitif lainnya di chat ini ya. Isi langsung di form pendaftaran."
- Saat ditanya "NIP itu apa": "NIP adalah Nomor Induk Pegawai, nomor identitas 18 digit dari BKN. Contoh format: 1985xxxxxxxxxxxxxx. NIP bisa dilihat di SK pengangkatan atau aplikasi MySAPK. Untuk keamanan, mohon JANGAN ketik NIP asli Anda di chat ini, tapi isi langsung di form pendaftaran."
- Saat user coba ketik NIP: "Mohon jangan ketik NIP atau data sensitif lainnya di chat ini ya, demi keamanan data Anda. NIP cukup diisi langsung di form pendaftaran. Untuk panduan cara mengisi field NIP, saya bisa bantu jelaskan formatnya tanpa Anda perlu mengetik NIP asli di sini."
- Saat ditanya status: arahkan klik "Cek Status Pendaftaran" dan masukkan NIP 18 digit langsung di form tersebut`

// ====================================================================
// SENSITIVE DATA DETECTION - FILTER KETAT
// ====================================================================
// Pola regex untuk mendeteksi data sensitif
const SENSITIVE_PATTERNS: Array<{ pattern: RegExp; type: string; message: string }> = [
  // NIP / NIK (16-18 digit berturut-turut)
  {
    pattern: /\b\d{16,18}\b/,
    type: 'NIP/NIK',
    message: 'terdeteksi Nomor NIP/NIK (16-18 digit). Demi keamanan, mohon JANGAN mengetik NIP/NIK di chat. Isi langsung di form pendaftaran.',
  },
  // NPWP (15 digit, bisa dengan/titik format XX.XXX.XXX.X-XXX.XXX)
  {
    pattern: /\b\d{2}[.\-]?\d{3}[.\-]?\d{3}[.\-]?\d{1}[\-\.]?\d{3}[.\-]?\d{3}\b/,
    type: 'NPWP',
    message: 'terdeteksi Nomor NPWP. Demi keamanan, mohon JANGAN mengetik NPWP di chat. Isi langsung di form pendaftaran.',
  },
  // NPWP 15 digit polos
  {
    pattern: /\b\d{15}\b/,
    type: 'NPWP',
    message: 'terdeteksi Nomor NPWP (15 digit). Demi keamanan, mohon JANGAN mengetik NPWP di chat. Isi langsung di form pendaftaran.',
  },
  // Nomor rekening bank (10-16 digit, bisa dengan spasi/titik)
  {
    pattern: /\b(?:rek|rekening|bank|norek|no\.?\s*rek)\s*[:#]?\s*\d{8,16}\b/i,
    type: 'Nomor Rekening',
    message: 'terdeteksi Nomor Rekening Bank. Demi keamanan, mohon JANGAN mengetik nomor rekening di chat. Isi langsung di form pendaftaran.',
  },
  // Nomor rekening panjang polos (13-16 digit, umum untuk rekening bank Indonesia)
  {
    pattern: /\b\d{13,16}\b/,
    type: 'Nomor Rekening/Kartu',
    message: 'terdeteksi nomor rekening/kartu (13-16 digit). Demi keamanan, mohon JANGAN mengetik data tersebut di chat. Isi langsung di form pendaftaran.',
  },
  // Password / kata sandi - format "password: xxx" atau "password = xxx"
  {
    pattern: /\b(?:password|passwd|pwd|pass|kata\s*sandi|katasandi|sandi|pin|otp)\s*[:=]\s*\S+/i,
    type: 'Password',
    message: 'terdeteksi kata sandi/password. Demi keamanan, JANGAN PERNAH membagikan password ke siapapun, termasuk ke Admin PSKTI. Password cukup diingat/ditulis sendiri di tempat aman.',
  },
  // Password - format "password saya xxx" atau "kata sandi saya xxx"
  {
    pattern: /\b(?:password|kata\s*sandi|sandi|pin)\s+(?:saya|saya\s+adalah|aku|adalah|itu)\s+\S+/i,
    type: 'Password',
    message: 'terdeteksi kata sandi/password. Demi keamanan, JANGAN PERNAH membagikan password ke siapapun. Admin PSKTI tidak akan pernah meminta password Anda.',
  },
  // Password - format "sandi saya: xxx" atau "password saya : xxx" (dengan titik dua)
  {
    pattern: /\b(?:password|kata\s*sandi|sandi|pin)(?:\s+\w+)*\s*[:=]\s*\S+/i,
    type: 'Password',
    message: 'terdeteksi kata sandi/password. Demi keamanan, JANGAN PERNAH membagikan password ke siapapun, termasuk ke Admin PSKTI.',
  },
  // Frasa "password saya adalah xxx" atau "sandi saya adalah xxx"
  {
    pattern: /\b(?:password|kata\s*sandi|sandi|pin)\s+\w+\s+(?:adalah|itu)\s+\S+/i,
    type: 'Password',
    message: 'terdeteksi kata sandi/password. Demi keamanan, JANGAN PERNAH membagikan password ke siapapun. Admin PSKTI tidak akan pernah meminta password Anda.',
  },
  // Nomor kartu kredit (16 digit dengan spasi, format XXXX XXXX XXXX XXXX)
  {
    pattern: /\b(?:\d{4}[\s\-]?){3}\d{4}\b/,
    type: 'Kartu Kredit',
    message: 'terdeteksi nomor kartu. Demi keamanan, mohon JANGAN mengetik nomor kartu di chat.',
  },
  // Email (anggap sensitif untuk chatbot publik)
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
    type: 'Email',
    message: 'terdeteksi alamat email. Sebagai kewaspadaan, mohon JANGAN mengetik email di chat. Email cukup diisi langsung di form pendaftaran.',
  },
  // Nomor HP Indonesia (08xxxxxxxxxx, 10-13 digit)
  {
    pattern: /\b08\d{8,12}\b/,
    type: 'Nomor HP',
    message: 'terdeteksi nomor HP. Demi keamanan, mohon JANGAN mengetik nomor HP di chat. Isi langsung di form pendaftaran.',
  },
  // Tanggal lahir lengkap (DD-MM-YYYY atau DD/MM/YYYY)
  {
    pattern: /\b\d{1,2}[\-\/]\d{1,2}[\-\/]\d{4}\b/,
    type: 'Tanggal Lahir',
    message: 'terdeteksi tanggal lahir. Demi keamanan, mohon JANGAN mengetik tanggal lahir di chat. Isi langsung di form pendaftaran.',
  },
]

// Cek apakah pesan mengandung data sensitif
function detectSensitiveData(message: string): { found: boolean; type: string; message: string } | null {
  for (const { pattern, type, message: msg } of SENSITIVE_PATTERNS) {
    if (pattern.test(message)) {
      return { found: true, type, message: msg }
    }
  }
  return null
}

// Sanitasi pesan sebelum dikirim ke AI (mask data sensitif)
function sanitizeMessage(message: string): string {
  let sanitized = message
  // Mask NIP/NIK 16-18 digit
  sanitized = sanitized.replace(/\b(\d{4})\d{8,12}(\d{2,4})\b/g, '$1********$2')
  // Mask NPWP format
  sanitized = sanitized.replace(
    /\b(\d{2})[.\-]?(\d{3})[.\-]?\d{3}[.\-]?\d{1}[\-\.]?\d{3}[.\-]?\d{3}\b/g,
    '$1.$2.***.***.***'
  )
  // Mask NPWP 15 digit
  sanitized = sanitized.replace(/\b(\d{4})\d{11}\b/g, '$1***********')
  // Mask nomor rekening panjang
  sanitized = sanitized.replace(/\b(\d{4})\d{5,12}(\d{2,4})\b/g, '$1*******$2')
  // Mask email
  sanitized = sanitized.replace(
    /\b([A-Za-z0-9._%+-]{2})[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
    '$1***@$2'
  )
  // Mask nomor HP
  sanitized = sanitized.replace(/\b(08)\d{8,12}\b/g, '$1*********')
  return sanitized
}

// ====================================================================
// IN-MEMORY CONVERSATION STORE
// ====================================================================
const conversations = new Map<string, Array<{ role: string; content: string }>>()
const MAX_MESSAGES = 20 // batasi history untuk hindari token berlebih

// ====================================================================
// GEMINI API CALL
// ====================================================================
async function callGemini(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const systemInstruction = {
    parts: [{ text: SYSTEM_PROMPT }],
  }

  const contents = messages
    .filter(
      (m) => !(m.role === 'assistant' && m.content === SYSTEM_PROMPT)
    )
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  if (contents.length === 0) {
    throw new Error('Isi percakapan kosong')
  }

  const requestBody = {
    systemInstruction,
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      topP: 0.95,
      topK: 40,
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
    ],
  }

  let response: Response | undefined
  let responseText = ''

  for (let attempt = 0; attempt < 3; attempt++) {
    response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      cache: 'no-store',
    })

    responseText = await response.text()

    if (response.ok) {
      break
    }

    const retryableStatus = [429, 500, 502, 503, 504].includes(
      response.status
    )

    if (!retryableStatus || attempt === 2) {
      break
    }

    const delay = 1000 * Math.pow(2, attempt)
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  if (!response) {
    throw new Error('Tidak ada response dari Gemini API')
  }

  if (!response.ok) {
    console.error('[CHAT API] Gemini API error:', {
      status: response.status,
      body: responseText,
      model: GEMINI_MODEL,
      hasApiKey: Boolean(GEMINI_API_KEY),
    })

    throw new GeminiApiError(
      response.status,
      `Gemini API gagal dengan status ${response.status}`
    )
  }

    let data: any

  try {
    data = JSON.parse(responseText)
  } catch (error) {
    console.error('[CHAT API] Response Gemini bukan JSON:', {
      message: error instanceof Error ? error.message : String(error),
      body: responseText,
    })

    throw new Error('Response dari Gemini bukan JSON yang valid')
  }

  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('')
      .trim() || ''

  if (!text) {
    console.error('[CHAT API] Response Gemini tidak berisi teks:', data)
    throw new Error('Gemini tidak mengembalikan jawaban')
  }

  return text
}
// ====================================================================
// POST HANDLER
// ====================================================================
export async function POST(request: Request) {
  try {
    // Cek API key
       if (!GEMINI_API_KEY) {
      console.error('[CHAT API] GEMINI_API_KEY belum dikonfigurasi')

      return NextResponse.json(
        {
          error: 'Layanan chat belum dikonfigurasi oleh administrator.',
        },
        { status: 503 }
      )
    }
    const body = await request.json()
    const { message, sessionId } = body

    // Validasi input dasar
    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json(
        { error: 'Pesan tidak boleh kosong' },
        { status: 400 }
      )
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'Pesan terlalu panjang (maksimal 2000 karakter)' },
        { status: 400 }
      )
    }

    // ============ FILTER DATA SENSITIF (KETAT) ============
    const sensitiveCheck = detectSensitiveData(message)
    if (sensitiveCheck) {
      return NextResponse.json({
        success: true,
        response: `⚠️ **Peringatan Keamanan Data**\n\nMohon maaf, pesan Anda ${sensitiveCheck.message}\n\n🛡️ **Penting:**\n- Admin PSKTI TIDAK PERNAH meminta data sensitif melalui chat\n- Data seperti NIP, NPWP, nomor rekening, password HANYA diisi di form resmi\n- Jika butuh bantuan terkait data tersebut, silakan:\n  • Isi langsung di form pendaftaran, atau\n  • Hubungi BPSDM Aceh: 📞 0651-22000 / ✉️ bpsdm@acehprov.go.id\n\nAda pertanyaan lain yang bisa saya bantu? 😊`,
        sessionId: sessionId || `anon-${Date.now()}`,
        blocked: true,
        blockedType: sensitiveCheck.type,
      })
    }

    // Generate atau gunakan sessionId
    const sid = sessionId || `anon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Ambil atau buat history percakapan
    let history = conversations.get(sid)
    if (!history) {
      history = [{ role: 'assistant', content: SYSTEM_PROMPT }]
      conversations.set(sid, history)
    }

    // Sanitasi pesan sebelum disimpan (mask data yang mungkin lolos deteksi)
    const sanitizedMessage = sanitizeMessage(message)

    // Tambahkan pesan user
    history.push({ role: 'user', content: sanitizedMessage })

    // Trim history jika terlalu panjang
    if (history.length > MAX_MESSAGES) {
      history = [history[0], ...history.slice(-(MAX_MESSAGES - 1))]
      conversations.set(sid, history)
    }

    // Panggil Gemini API
    const aiResponse = await callGemini(history)

    if (!aiResponse || aiResponse.trim().length === 0) {
      return NextResponse.json(
        {
          error:
            'Maaf, saya tidak dapat memberikan jawaban saat ini. Silakan coba lagi atau hubungi BPSDM Aceh langsung.',
        },
        { status: 500 }
      )
    }

    // Simpan response AI ke history
    history.push({ role: 'assistant', content: aiResponse })
    conversations.set(sid, history)

    return NextResponse.json({
      success: true,
      response: aiResponse,
      sessionId: sid,
    })
      } catch (error) {
    console.error('[CHAT API] Error lengkap:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      model: GEMINI_MODEL,
      hasApiKey: Boolean(GEMINI_API_KEY),
    })

    if (error instanceof GeminiApiError) {
      const errorMessage =
        error.status === 503
          ? 'Layanan AI sedang sibuk. Silakan coba lagi beberapa saat.'
          : error.status === 429
            ? 'Batas penggunaan layanan AI sedang tercapai. Silakan coba lagi nanti.'
            : 'Layanan AI sedang mengalami gangguan.'

      return NextResponse.json(
        { error: errorMessage },
        { status: error.status }
      )
    }

    return NextResponse.json(
      {
        error:
          'Maaf, terjadi kesalahan pada layanan chat. Silakan coba lagi beberapa saat kemudian.',
      },
      { status: 500 }
    )
  }
}

// ====================================================================
// DELETE HANDLER - Reset percakapan
// ====================================================================
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (sessionId) {
      conversations.delete(sessionId)
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { success: false },
      { status: 500 }
    )
  }
}
