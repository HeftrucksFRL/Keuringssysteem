"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  Forklift,
  FolderKanban,
  LayoutDashboard,
  Menu,
  PackageCheck,
  Users,
  Wrench
} from "lucide-react";
import type { Route } from "next";

const links: Array<{
  href: Route;
  label: string;
  mobileLabel?: string;
  icon: typeof LayoutDashboard;
  mobileQuick?: boolean;
}> = [
  { href: "/", label: "Dashboard", mobileLabel: "Home", icon: LayoutDashboard, mobileQuick: true },
  {
    href: "/keuringen/nieuw",
    label: "Nieuwe keuring",
    mobileLabel: "Nieuw",
    icon: ClipboardCheck,
    mobileQuick: true
  },
  { href: "/klanten", label: "Klanten", icon: Users, mobileQuick: true },
  { href: "/machines", label: "Machines", icon: Forklift, mobileQuick: true },
  { href: "/planning", label: "Planning", icon: FolderKanban, mobileQuick: true },
  { href: "/keuringen", label: "Keuringen", mobileLabel: "Keur", icon: Wrench, mobileQuick: true },
  { href: "/verhuur", label: "Verhuur", mobileLabel: "Huur", icon: PackageCheck, mobileQuick: true }
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation() {
  const pathname = usePathname();
  const quickLinks = links.filter((link) => link.mobileQuick);

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
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              className={`bottom-nav-link ${isActive(pathname, link.href) ? "active" : ""}`}
              href={link.href}
            >
              <Icon size={18} />
              <span>{link.mobileLabel ?? link.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
