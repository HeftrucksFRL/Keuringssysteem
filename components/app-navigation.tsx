"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  Forklift,
  FolderKanban,
  LayoutDashboard,
  PackageCheck,
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
  {
    href: "/keuringen/nieuw",
    label: "Nieuwe keuring",
    icon: ClipboardCheck
  },
  { href: "/klanten", label: "Klanten", icon: Users },
  { href: "/machines", label: "Machines", icon: Forklift },
  { href: "/planning", label: "Planning", icon: FolderKanban },
  { href: "/keuringen", label: "Keuringen", icon: Wrench },
  { href: "/verhuur", label: "Verhuur", icon: PackageCheck }
];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNavigation({ variant = "desktop" }: { variant?: "desktop" | "mobile" }) {
  const pathname = usePathname();

  if (variant === "mobile") {
    return (
      <nav className="mobile-topnav" aria-label="Hoofdnavigatie mobiel">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              className={`mobile-topnav-link ${isActive(pathname, link.href) ? "active" : ""}`}
              href={link.href}
            >
              <Icon size={16} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
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
  );
}
