"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
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
  const router = useRouter();
  const prefetchRoute = useCallback((href: Route) => router.prefetch(href), [router]);

  useEffect(() => {
    if (variant !== "desktop") {
      return;
    }

    const prefetchAll = () => links.forEach((link) => prefetchRoute(link.href));
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idleId = idleWindow.requestIdleCallback
      ? idleWindow.requestIdleCallback(prefetchAll, { timeout: 1500 })
      : globalThis.setTimeout(prefetchAll, 350);

    return () => {
      if (idleWindow.cancelIdleCallback && typeof idleId === "number") {
        idleWindow.cancelIdleCallback(idleId);
      } else {
        globalThis.clearTimeout(idleId);
      }
    };
  }, [prefetchRoute, variant]);

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
              onFocus={() => prefetchRoute(link.href)}
              onPointerEnter={() => prefetchRoute(link.href)}
              prefetch
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
            onFocus={() => prefetchRoute(link.href)}
            onPointerEnter={() => prefetchRoute(link.href)}
            prefetch
          >
            <Icon size={16} />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
