import "./globals.css";
import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthStatus } from "@/components/auth-status";
import { AppNavigation } from "@/components/app-navigation";
import { RouteLoadingIndicator } from "@/components/route-loading-indicator";

export const metadata: Metadata = {
  title: "Keuringssysteem | Heftrucks Friesland",
  description: "Digitale keuringsapp voor intern transportmaterieel."
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
              <img
                className="brand-logo"
                src="/logo-heftrucks-frl.png"
                alt="Heftrucks Friesland"
                width={196}
                height={54}
              />
              <span>Keuringssysteem</span>
            </div>
            <AppNavigation />
            <div className="auth-slot">
              <AuthStatus />
            </div>
          </header>
          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
