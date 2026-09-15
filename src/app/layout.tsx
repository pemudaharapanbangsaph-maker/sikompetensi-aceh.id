import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
  weight: ["200", "300", "400", "500", "600", "700", "800"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
  style: ["normal", "italic"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0F4C81",
};

export const metadata: Metadata = {
  title: "Sistem Informasi Kompetensi Teknis (PKSTI) — BPSDM Aceh",
  description: "Sistem Informasi Internal Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti BPSDM Aceh. Mengelola Analisis Kebutuhan Diklat, Pelatihan, dan Uji Kompetensi ASN Aceh.",
  keywords: ["BPSDM", "Aceh", "Kompetensi Teknis", "Diklat", "Pelatihan", "Uji Kompetensi", "Sertifikasi"],
  authors: [{ name: "BPSDM Aceh" }],
  icons: {
    icon: "/logo-pancacita.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
       className={`${inter.variable} ${jakarta.variable} ${playfair.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
