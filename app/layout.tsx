import "./globals.css";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import type { Route } from "next";
import { AuthStatus } from "@/components/auth-status";

export const metadata: Metadata = {
  title: "Keuringssysteem | Heftrucks Friesland",
  description: "Digitale keuringsapp voor intern transportmaterieel."
};

const links: { href: Route; label: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/keuringen/nieuw", label: "Nieuwe keuring" },
  { href: "/klanten", label: "Klanten" },
  { href: "/machines", label: "Machines" },
  { href: "/planning", label: "Planning" },
  { href: "/keuringen", label: "Keuringen" }
];

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl">
      <body>
        <div className="shell">
          <header className="topbar">
            <div className="brand">
              <Image
                src="/logo-heftrucks-frl.png"
                alt="Heftrucks Friesland"
                width={220}
                height={64}
                priority
              />
              <span>Keuringssysteem</span>
            </div>
            <nav className="topnav" aria-label="Hoofdnavigatie">
              {links.map((link) => (
                <Link key={link.href} href={link.href}>
                  {link.label}
                </Link>
              ))}
            </nav>
            <AuthStatus />
          </header>
          <main className="page">{children}</main>
        </div>
      </body>
    </html>
  );
}
