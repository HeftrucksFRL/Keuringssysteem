"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { CalendarDays, FilePenLine, ChevronDown, Forklift, FolderKanban, KeyRound, LayoutDashboard, PackageCheck, Truck, Users, Wrench } from "lucide-react";
import type { Route } from "next";
import "./app-navigation.css";

type NavLink = { href: Route; label: string; icon: typeof LayoutDashboard };
const links: NavLink[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/klanten", label: "Klanten", icon: Users },
  { href: "/machines", label: "Machines", icon: Forklift },
  { href: "/werkbonnen", label: "Werkbonnen", icon: Wrench },
  { href: "/keuringen", label: "Keuringen", icon: FilePenLine },
  { href: "/planning", label: "Keuringsplanning", icon: FolderKanban },
  { href: "/planning/transport", label: "Transportplanning", icon: Truck },
  { href: "/planning/werkplaats", label: "Werkplaatsplanning", icon: Wrench },
  { href: "/verhuur", label: "Verhuur", icon: KeyRound },
  { href: "/werkplaats/bestellingen", label: "Onderdelen & gereedschap", icon: PackageCheck },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/werkplaats", label: "Werkplaats", icon: Wrench },
  { href: "/frello", label: "Frellobord", icon: FolderKanban }
];
const groups = [
  { label: "Planning", icon: FolderKanban, hrefs: ["/planning", "/planning/werkplaats", "/planning/transport"] },
  { label: "Werk & dossiers", icon: Wrench, hrefs: ["/werkbonnen", "/keuringen", "/verhuur", "/werkplaats/bestellingen"] },
  { label: "Relaties & materieel", icon: Users, hrefs: ["/klanten", "/machines"] }
];
function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/planning/werkplaats" && path === "/werkplaats") return true;
  if (href === "/planning" && ["/planning/transport", "/planning/werkplaats"].some(route => path === route || path.startsWith(route + "/"))) return false;
  return path === href || path.startsWith(`${href}/`);
}
export function AppNavigation({ variant = "desktop", workshopOnly = false }: { variant?: "desktop" | "mobile"; workshopOnly?: boolean }) {
  const pathname = usePathname(), router = useRouter(), nav = useRef<HTMLElement>(null);
  const prefetch = useCallback((href: Route) => router.prefetch(href), [router]);
  useEffect(() => {
    nav.current?.querySelectorAll("details[open]").forEach(el => el.removeAttribute("open"));
  }, [pathname]);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      nav.current?.querySelectorAll("details[open]").forEach(el => { if (!el.contains(event.target as Node)) el.removeAttribute("open"); });
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  function renderLink(link: NavLink, sub = false) {
    const Icon = link.icon;
    return <Link key={link.href} className={`${sub ? "app-subnav-link" : "app-nav-link"} ${isActive(pathname, link.href) ? "active" : ""}`}
      prefetch={false} aria-current={isActive(pathname, link.href) ? "page" : undefined} href={link.href}
      onFocus={() => prefetch(link.href)} onPointerEnter={() => prefetch(link.href)}
      onClick={() => nav.current?.querySelectorAll("details[open]").forEach(el => el.removeAttribute("open"))}>
      <Icon size={16}/><span>{link.label}</span>
    </Link>;
  }
  return <nav ref={nav} className={`${variant === "mobile" ? "mobile-topnav" : "topnav"} app-nav`} aria-label={variant === "mobile" ? "Hoofdnavigatie mobiel" : "Hoofdnavigatie"}>
    {workshopOnly ? renderLink(links.find(l => l.href === "/werkplaats")!) : <>
      {links.filter(l => l.href === "/").map(l => renderLink(l))}
      {groups.map(group => {
        const Icon = group.icon;
        const active = group.hrefs.some(href => isActive(pathname, href));
        return <details key={group.label} className={`app-nav-group ${active ? "active" : ""}`}
          onToggle={e => { const current = e.currentTarget; if (current.open) nav.current?.querySelectorAll("details[open]").forEach(el => { if (el !== current) el.removeAttribute("open"); }); }}
          onKeyDown={e => { if (e.key === "Escape") { e.currentTarget.open = false; e.currentTarget.querySelector("summary")?.focus(); } }}>
          <summary><Icon size={16}/><span>{group.label}</span><ChevronDown size={14}/></summary>
          <div className="app-subnav">{group.hrefs.map(href => renderLink(links.find(l => l.href === href)!, true))}</div>
        </details>;
      })}
      {links.filter(l => l.href === "/agenda" || l.href === "/frello").map(l => renderLink(l))}
    </>}
  </nav>;
}
