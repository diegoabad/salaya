"use client";

import type { EstudioResena } from "@/lib/estudio-detalle-data";
import { useMemo, useState } from "react";

const INITIAL_VISIBLE = 2;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatFecha(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} de 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        const on = i < rating;
        return (
          <svg
            key={i}
            viewBox="0 0 20 20"
            className={`h-3.5 w-3.5 ${on ? "text-brand" : "text-line"}`}
            aria-hidden
            fill={on ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={on ? 0 : 1.4}
          >
            <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.1l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.5z" />
          </svg>
        );
      })}
    </span>
  );
}

type Props = {
  resenas: EstudioResena[];
  ratingAvg: number | null;
};

export function EstudioResenas({ resenas, ratingAvg }: Props) {
  const [expanded, setExpanded] = useState(false);

  const ordenadas = useMemo(
    () =>
      [...resenas].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [resenas],
  );

  if (ordenadas.length === 0) return null;

  const hasMore = ordenadas.length > INITIAL_VISIBLE;
  const visible =
    expanded || !hasMore ? ordenadas : ordenadas.slice(0, INITIAL_VISIBLE);
  const hiddenCount = ordenadas.length - INITIAL_VISIBLE;

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight md:text-2xl">
          Reseñas ({ordenadas.length})
        </h2>
        {ratingAvg != null && (
          <p className="flex items-center gap-2 text-sm">
            <Stars rating={Math.round(ratingAvg)} />
            <span className="font-semibold text-ink">{ratingAvg.toFixed(1)}</span>
          </p>
        )}
      </div>

      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {visible.map((r) => (
          <li
            key={r.id}
            className="rounded-2xl border border-line bg-surface p-4 md:p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-semibold text-ink"
                  aria-hidden
                >
                  {initials(r.authorName)}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{r.authorName}</p>
                  <p className="text-xs text-muted">{formatFecha(r.publishedAt)}</p>
                </div>
              </div>
              <p className="flex shrink-0 items-center gap-1.5">
                <Stars rating={r.rating} />
                <span className="text-sm font-semibold tabular-nums text-ink">
                  {r.rating.toFixed(1)}
                </span>
              </p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink/85">{r.body}</p>
          </li>
        ))}
      </ul>

      {hasMore ? (
        <div className="mt-5 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-sm font-semibold text-brand transition hover:text-brand-deep"
          >
            {expanded ? "Ver menos" : `Ver más (${hiddenCount})`}
          </button>
        </div>
      ) : null}
    </section>
  );
}
