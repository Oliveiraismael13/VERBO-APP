import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const image = `${protocol}://${host}/og.png`;

  return {
    title: "Verbo — Bíblia e estudo",
    description: "Leia, encontre e aprofunde-se na Palavra.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "Verbo — Bíblia e estudo",
      description: "Transforme qualquer versículo em uma porta para o estudo bíblico.",
      images: [{ url: image, width: 1736, height: 907, alt: "Verbo — Leia. Encontre. Aprofunde." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Verbo — Bíblia e estudo",
      description: "Transforme qualquer versículo em uma porta para o estudo bíblico.",
      images: [image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
