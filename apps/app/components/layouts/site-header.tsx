"use client";

import { BrandLogo } from "@/components/layouts/brand-logo";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = {
  /** overlay = sobre el hero (landing); solid = barra fija (detalle) */
  variant?: "overlay" | "solid";
};

/** Header público: siempre el mismo logo de la landing. */
export function SiteHeader({ variant = "overlay" }: Props) {
  const overlay = variant === "overlay";
  const [loggedIn, setLoggedIn] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s: { user?: { id?: string } } | null) => {
        if (!cancelled) setLoggedIn(Boolean(s?.user?.id));
      })
      .catch(() => {
        if (!cancelled) setLoggedIn(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const linkMuted = overlay
    ? "rounded-full px-3 py-1.5 text-sm font-medium text-ink/90 hover:bg-white/10"
    : "rounded-full px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink";

  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className={
        overlay
          ? "absolute inset-x-0 top-0 z-30"
          : "sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur"
      }
    >
      <div className="relative mx-auto flex max-w-7xl items-center justify-center px-4 py-4 md:justify-between">
        <BrandLogo height={40} />

        <nav className="hidden items-center gap-2 md:flex">
          <Link href="/soy-dueno" className={linkMuted}>
            Soy dueño
          </Link>
          {loggedIn ? (
            <Link href="/favoritos" className={linkMuted}>
              Favoritos
            </Link>
          ) : (
            <Link href="/login?callbackUrl=/favoritos" className={linkMuted}>
              Entrar
            </Link>
          )}
          <Link
            href="/register"
            className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-paper"
          >
            Publicá tu sala
          </Link>
        </nav>

        <button
          type="button"
          aria-label="Abrir menú"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
          className={`absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full md:hidden ${
            overlay
              ? "text-ink hover:bg-white/10"
              : "text-ink hover:bg-surface-2"
          }`}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 7h16M4 12h16M4 17h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Menú mobile: drawer desde la derecha */}
      <div className="md:hidden" aria-hidden={!menuOpen}>
        <button
          type="button"
          aria-label="Cerrar menú"
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMenu}
          className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-300 ${
            menuOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          }`}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menú"
          className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-line bg-paper shadow-xl shadow-black/40 transition-transform duration-300 ease-out ${
            menuOpen
              ? "pointer-events-auto translate-x-0"
              : "pointer-events-none translate-x-full"
          }`}
        >
          <div className="relative flex items-center justify-center px-4 py-4">
            <span onClick={closeMenu} className="inline-flex">
              <BrandLogo height={40} href="/" />
            </span>
            <button
              type="button"
              aria-label="Cerrar menú"
              tabIndex={menuOpen ? 0 : -1}
              onClick={closeMenu}
              className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink hover:bg-surface-2"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-4 pb-8 pt-2">
            <Link
              href="/soy-dueno"
              tabIndex={menuOpen ? 0 : -1}
              className="rounded-xl px-4 py-3.5 text-base font-medium text-ink transition hover:bg-brand/15 hover:text-brand"
              onClick={closeMenu}
            >
              Soy dueño
            </Link>
            {loggedIn ? (
              <Link
                href="/favoritos"
                tabIndex={menuOpen ? 0 : -1}
                className="rounded-xl px-4 py-3.5 text-base font-medium text-ink transition hover:bg-brand/15 hover:text-brand"
                onClick={closeMenu}
              >
                Favoritos
              </Link>
            ) : (
              <Link
                href="/login?callbackUrl=/favoritos"
                tabIndex={menuOpen ? 0 : -1}
                className="rounded-xl px-4 py-3.5 text-base font-medium text-ink transition hover:bg-brand/15 hover:text-brand"
                onClick={closeMenu}
              >
                Entrar
              </Link>
            )}
            <Link
              href="/register"
              tabIndex={menuOpen ? 0 : -1}
              className="mt-2 rounded-xl bg-brand px-4 py-3.5 text-center text-base font-semibold text-paper transition hover:bg-brand-deep"
              onClick={closeMenu}
            >
              Publicá tu sala
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
