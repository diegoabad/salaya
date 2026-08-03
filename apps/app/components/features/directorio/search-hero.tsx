"use client";

import type { DirectorioSala } from "@/lib/directorio-data";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Suggestion =
  | { type: "zona"; label: string }
  | { type: "estudio"; label: string; slug: string };

type Props = {
  query: string;
  onQueryChange: (v: string) => void;
  onSearch: (value: string, zona?: string) => void;
  zonas: readonly string[];
  salas: DirectorioSala[];
};

type MenuPos = { top: number; left: number; width: number };

export function SearchHero({
  query,
  onQueryChange,
  onSearch,
  zonas,
  salas,
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo((): Suggestion[] => {
    const fold = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "");
    const q = fold(query.trim());
    const zonaHits = (q.length < 1
      ? [...zonas]
      : zonas.filter((z) => fold(z).includes(q))
    )
      .slice(0, 12)
      .map((z) => ({ type: "zona" as const, label: z }));

    const estudioHits =
      q.length < 1
        ? []
        : salas
            .filter((s) => fold(s.name).includes(q))
            .slice(0, 8)
            .map((s) => ({
              type: "estudio" as const,
              label: s.name,
              slug: s.slug,
            }));

    return [...zonaHits, ...estudioHits];
  }, [query, zonas, salas]);

  const showMenu = open && suggestions.length > 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!showMenu) {
      setMenuPos(null);
      return;
    }

    const update = () => {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setMenuPos({
        top: r.bottom + 8,
        left: r.left,
        width: r.width,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [showMenu, suggestions.length]);

  const pick = (s: Suggestion) => {
    if (s.type === "zona") {
      onQueryChange(s.label);
      onSearch(s.label, s.label);
    } else {
      onQueryChange(s.label);
      onSearch(s.label);
    }
    setOpen(false);
  };

  const menu =
    mounted && showMenu && menuPos
      ? createPortal(
          <ul
            role="listbox"
            className="fixed z-[100] max-h-[min(20rem,50vh)] overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface shadow-xl"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: menuPos.width,
            }}
          >
            {suggestions.map((s) => (
              <li key={`${s.type}-${s.label}`} role="option">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-surface-2"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(s)}
                >
                  <span className="text-xs uppercase tracking-wide text-muted">
                    {s.type === "zona" ? "Zona" : "Estudio"}
                  </span>
                  <span className="font-medium text-ink">{s.label}</span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )
      : null;

  return (
    <section className="relative border-b border-line">
      <div
        className="absolute inset-0 -z-10 overflow-hidden"
        style={{
          backgroundImage: `
            linear-gradient(120deg, rgba(10,11,14,0.88) 0%, rgba(10,11,14,0.55) 55%, rgba(10,11,14,0.35) 100%),
            url(https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=1800&q=80)
          `,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />

      <div className="mx-auto flex max-w-7xl flex-col px-4 pb-10 pt-28 md:pb-14 md:pt-36">
        <h1 className="animate-rise max-w-2xl font-[family-name:var(--font-display)] text-3xl leading-[1.05] tracking-tight text-white md:text-5xl">
          Encontrá sala de ensayo cerca tuyo
        </h1>
        <p className="animate-rise-delay mt-2 max-w-lg text-base text-white/80 md:text-lg">
          Buscá por barrio o nombre. Reservá online en las que ya están en la
          plataforma.
        </p>

        <div className="animate-rise-delay relative mt-6 max-w-2xl">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  onQueryChange(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                  setTimeout(() => setOpen(false), 150);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onSearch(query);
                    setOpen(false);
                  }
                }}
                placeholder="Barrio o nombre del estudio…"
                className="w-full rounded-xl border border-line bg-surface px-4 py-3.5 text-base text-ink shadow-lg outline-none ring-2 ring-transparent placeholder:text-muted focus:ring-brand"
                autoComplete="off"
                aria-label="Buscar estudio o barrio"
                aria-autocomplete="list"
                aria-expanded={showMenu}
              />
              {menu}
            </div>

            <button
              type="button"
              onClick={() => {
                onSearch(query);
                setOpen(false);
              }}
              className="rounded-xl bg-[var(--brand)] px-6 py-3.5 text-sm font-semibold text-paper shadow-lg transition hover:bg-[var(--brand-deep)]"
            >
              Buscar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
