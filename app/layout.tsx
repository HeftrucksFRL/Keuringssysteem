import "./globals.css";
import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import Image from "next/image";
import Link from "next/link";
import brandLogo from "../Logo Heftrucks.frl.png";
import { AuthStatus } from "@/components/auth-status";
import { AppNavigation } from "@/components/app-navigation";
import { RouteLoadingIndicator } from "@/components/route-loading-indicator";

export const metadata: Metadata = {
  title: "Keuringssysteem | Heftrucks Friesland",
  applicationName: "Heftrucks Friesland",
  description: "Digitale keuringsapp voor intern transportmaterieel.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/app-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/app-icon-192.png"]
  },
  appleWebApp: {
    capable: true,
    title: "Keuringen HF",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#005ea8"
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>
        <div className="shell">
          <Suspense fallback={null}>
            <RouteLoadingIndicator />
          </Suspense>
          <header className="topbar">
            <div className="brand">
              <Link className="brand-link" href="/">
                <Image
                  className="brand-logo"
                  src={brandLogo}
                  alt="Heftrucks Friesland"
                  width={196}
                  height={54}
                  priority
                  unoptimized
                />
              </Link>
              <span>Keuringssysteem</span>
            </div>
            <AppNavigation variant="desktop" />
            <div className="auth-slot">
              <AuthStatus />
            </div>
          </header>
          <div className="mobile-auth-slot">
            <AuthStatus />
          </div>
          <AppNavigation variant="mobile" />
          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
