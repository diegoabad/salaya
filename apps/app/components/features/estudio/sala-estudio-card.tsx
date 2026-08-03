"use client";

import { formatPrecio } from "@/lib/directorio-data";
import type { EstudioSala } from "@/lib/estudio-detalle-data";
import Link from "next/link";

type Props = {
  estudioSlug: string;
  sala: EstudioSala;
};

function Diamond({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 8 8" className={className} aria-hidden fill="currentColor">
      <path d="M4 0L8 4L4 8L0 4z" />
    </svg>
  );
}

function IconPeople({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="6" cy="5" r="2.2" />
      <path d="M1.5 13.5c.4-2.2 2.2-3.5 4.5-3.5s4.1 1.3 4.5 3.5" strokeLinecap="round" />
      <circle cx="11.5" cy="5.5" r="1.6" />
      <path d="M10.2 10.2c1.4.3 2.5 1.2 2.8 2.8" strokeLinecap="round" />
    </svg>
  );
}

function IconSize({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M6 2.5v11M2.5 6h11" strokeLinecap="round" />
    </svg>
  );
}

export function SalaEstudioCard({ estudioSlug, sala }: Props) {
  const medidas = `${sala.anchoMetros}x${sala.largoMetros}m`.replace(".", ",");
  const noDisp = !sala.disponibleHoy;
  const href = `/${estudioSlug}/sala/${sala.slug}`;
  const photo = sala.photos[0] ?? "";
  const tagPills = sala.tags.slice(0, 3);

  return (
    <article
      className={`group relative overflow-hidden rounded-2xl border bg-surface transition duration-200 ${
        noDisp
          ? "border-line opacity-80"
          : "border-line hover:border-brand hover:shadow-[0_0_0_1px_var(--brand)]"
      }`}
    >
      <Link href={href} className="absolute inset-0 z-10" aria-label={sala.name} />

      <div className="relative aspect-[16/11] overflow-hidden bg-paper">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] ${
              noDisp ? "grayscale-[0.35]" : ""
            }`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-2 to-paper text-muted">
            <span className="text-sm font-medium">{sala.name}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {sala.popular && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-orange-300 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              Popular
            </span>
          )}
          {sala.nueva && (
            <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-paper">
              Nueva
            </span>
          )}
          {sala.disponibleHoy ? (
            <span className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold text-paper">
              Disponible hoy
            </span>
          ) : (
            <span className="rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur-sm">
              No disponible
            </span>
          )}
        </div>

        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
          {sala.ratingAvg != null && sala.ratingCount > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-black/65 px-2 py-1 text-xs text-white backdrop-blur-sm">
              <span className="text-brand">★</span>
              <span className="font-semibold">{sala.ratingAvg.toFixed(1)}</span>
              <span className="text-white/70">({sala.ratingCount})</span>
            </span>
          ) : (
            <span />
          )}
          <span className="rounded-lg bg-brand px-2.5 py-1 text-sm font-bold text-paper shadow-sm">
            <span className="font-semibold opacity-90">Desde </span>
            {formatPrecio(sala.precioHora)}
            <span className="font-semibold">/h</span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 p-4">
        <div className="flex flex-wrap gap-1.5">
          {tagPills.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] text-muted"
            >
              {tag}
            </span>
          ))}
        </div>

        <h3 className="font-[family-name:var(--font-display)] text-lg tracking-tight text-ink md:text-xl">
          {sala.name}
        </h3>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <IconPeople className="h-3.5 w-3.5" />
            {sala.capacity} pers.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconSize className="h-3.5 w-3.5" />
            {medidas}
          </span>
        </div>

        {sala.caracteristicas.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1.5 border-t border-line pt-3">
            {sala.caracteristicas.slice(0, 3).map((c) => (
              <span
                key={c}
                className="inline-flex items-center gap-1.5 text-xs text-muted"
              >
                <Diamond className="h-2 w-2 shrink-0 text-brand" />
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
