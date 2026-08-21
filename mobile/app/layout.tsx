import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import AppInstall from "../components/AppInstall";
import "./globals.css";
import "./rpg.css";

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
  const image = `${protocol}://${host}/og.png?v=2`;

  return {
    title: "Verbo — Sua jornada na Palavra",
    description: "Leia a Bíblia, conclua capítulos, ganhe XP e avance em uma jornada de fé e constância.",
    manifest: "/manifest.webmanifest",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/icons/verbo-192.png" },
    appleWebApp: { capable: true, title: "Verbo", statusBarStyle: "black-translucent" },
    openGraph: {
      title: "Verbo — Sua jornada na Palavra",
      description: "Leia capítulos, ganhe XP e avance em uma jornada bíblica gamificada.",
      images: [{ url: image, width: 1736, height: 907, alt: "Verbo — Sua jornada na Palavra" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Verbo — Sua jornada na Palavra",
      description: "Leia capítulos, ganhe XP e avance em uma jornada bíblica gamificada.",
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
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/verbo-180.png?v=2" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-title" content="Verbo" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <AppInstall />
      </body>
    </html>
  );
}
