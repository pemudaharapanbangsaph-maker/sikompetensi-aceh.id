import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0F4C81",
};

export const metadata: Metadata = {
  title: "Sistem Informasi Kompetensi Teknis — BPSDM Aceh",
  description: "Sistem Informasi Internal Bidang Pengembangan dan Sertifikasi Kompetensi Teknis Inti BPSDM Provinsi Aceh. Mengelola Analisis Kebutuhan Diklat, Pelatihan, dan Uji Kompetensi ASN Aceh.",
  keywords: ["BPSDM", "Aceh", "Kompetensi Teknis", "Diklat", "Pelatihan", "Uji Kompetensi", "Sertifikasi"],
  authors: [{ name: "BPSDM Provinsi Aceh" }],
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
        className={`${geistSans.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
