"use client";

import { BrandLogo } from "@/components/layouts/brand-logo";
import { PANEL_NAV_GROUPS } from "@/components/layouts/panel-nav";
import { PanelNavIconSvg } from "@/components/layouts/panel-nav-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Props = {
  estudioName: string;
  userLabel: string;
  role: "owner" | "employee" | null;
  /** Default /panel — usar /panel-demo en la vista de prueba */
  basePath?: string;
  homeHref?: string;
  /** Si hay exitHref, muestra link en lugar del form de signOut */
  exitHref?: string;
  exitLabel?: string;
  signOutAction?: () => Promise<void>;
};

function remapHref(href: string, basePath: string) {
  if (basePath === "/panel") return href;
  if (href === "/panel") return basePath;
  return href.replace(/^\/panel/, basePath);
}

function isActive(pathname: string, href: string, basePath: string) {
  if (href === basePath) return pathname === basePath;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PanelSidebar({
  estudioName,
  userLabel,
  role,
  basePath = "/panel",
  homeHref,
  exitHref,
  exitLabel = "Salir",
  signOutAction,
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const logoHref = homeHref ?? basePath;

  const navGroups = PANEL_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((i) => !(role !== "owner" && i.href === "/panel/equipo"))
      .map((item) => ({
        ...item,
        href: remapHref(item.href, basePath),
      })),
  })).filter((g) => g.items.length > 0);

  const footer = (
    <div className="mt-auto border-t border-line p-3">
      <p className="truncate px-2 text-xs text-muted">{userLabel}</p>
      {role ? (
        <p className="px-2 text-[10px] uppercase tracking-wide text-muted/80">
          {role === "owner" ? "Dueño" : "Colaborador"}
        </p>
      ) : null}
      {exitHref ? (
        <Link
          href={exitHref}
          className="mt-2 block w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-ink"
        >
          {exitLabel}
        </Link>
      ) : signOutAction ? (
        <form action={signOutAction} className="mt-2">
          <button
            type="submit"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-surface-2 hover:text-ink"
          >
            {exitLabel}
          </button>
        </form>
      ) : null}
    </div>
  );

  const nav = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2 py-3">
      {navGroups.map((group) => (
        <div key={group.id}>
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted">
            {group.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href, basePath);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-brand/15 text-brand"
                      : "text-muted hover:bg-surface-2 hover:text-ink"
                  }`}
                >
                  <PanelNavIconSvg
                    name={item.icon}
                    className={`h-4 w-4 shrink-0 ${active ? "text-brand" : ""}`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
        <div className="min-w-0">
          <BrandLogo height={28} href={logoHref} />
          <p className="truncate text-xs text-muted">{estudioName}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink"
          aria-expanded={open}
          aria-label="Menú"
        >
          Menú
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-line bg-surface">
            <div className="border-b border-line px-4 py-4">
              <p className="font-display text-lg tracking-tight">{estudioName}</p>
              <p className="text-xs text-muted">Panel de gestión</p>
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      <aside className="sticky top-0 hidden min-h-dvh w-72 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="border-b border-line px-4 py-5">
          <BrandLogo height={32} href={logoHref} />
          <p className="mt-3 font-display text-lg tracking-tight">{estudioName}</p>
          <p className="text-xs text-muted">Panel de gestión</p>
        </div>
        {nav}
        {footer}
      </aside>
    </>
  );
}
