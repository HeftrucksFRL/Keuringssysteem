"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  Forklift,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Users,
  Wrench
} from "lucide-react";
import type { Route } from "next";

const links: Array<{
  href: Route;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/keuringen/nieuw", label: "Nieuw", icon: ClipboardCheck },
  { href: "/klanten", label: "Klanten", icon: Users },
  { href: "/machines", label: "Machines", icon: Forklift },
  { href: "/planning", label: "Planning", icon: FolderKanban },
  { href: "/keuringen", label: "Keuringen", icon: Wrench }
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();

  return (
    <>
      <details className="mobile-menu">
        <summary className="mobile-menu-button" aria-label="Menu openen">
          <Menu size={20} />
          <span>Menu</span>
        </summary>
        <div className="mobile-menu-panel">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                className={`mobile-menu-link ${isActive(pathname, link.href) ? "active" : ""}`}
                href={link.href}
              >
                <Icon size={18} />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      </details>

      <nav className="topnav" aria-label="Hoofdnavigatie">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              className={isActive(pathname, link.href) ? "active" : ""}
              href={link.href}
            >
              <Icon size={16} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <nav className="bottom-nav" aria-label="Snelle navigatie">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              className={`bottom-nav-link ${isActive(pathname, link.href) ? "active" : ""}`}
              href={link.href}
            >
              <Icon size={18} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
