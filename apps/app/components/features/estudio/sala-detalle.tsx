"use client";

import { SiteFooter } from "@/components/layouts/site-footer";
import { SiteHeader } from "@/components/layouts/site-header";
import { formatPrecio } from "@/lib/directorio-data";
import type { SalaDetalle } from "@/lib/estudio-detalle-data";
import Link from "next/link";
import { EstudioResenas } from "./estudio-resenas";
import { AmenidadIcon } from "./amenidad-icon";
import { PhotoGallery } from "./photo-gallery";
import { SalaReservaPicker } from "./sala-reserva-picker";

type Props = { data: SalaDetalle };

function StarsRow({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 20 20"
          className={`h-3.5 w-3.5 ${i < full ? "text-brand" : "text-white/35"}`}
          fill={i < full ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={i < full ? 0 : 1.4}
        >
          <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.1l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.5z" />
        </svg>
      ))}
    </span>
  );
}

export function SalaDetalleView({ data }: Props) {
  const { estudio, sala } = data;
  const medidas = `${sala.anchoMetros}x${sala.largoMetros}m`.replace(".", ",");
  const genreTags = sala.tags.filter((t) => t !== sala.categoria);
  const descripcion = sala.description?.trim() ?? "";
  const amenidades = estudio.amenidades;

  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <SiteHeader variant="solid" />

      <PhotoGallery
        images={sala.photos}
        alt={sala.name}
        flush
        className="h-[min(78vh,720px)] min-h-[420px] w-full md:h-[min(82vh,780px)]"
        overlay={
          <div className="mx-auto flex h-full w-full max-w-7xl flex-col justify-between px-4 py-5 md:py-8">
            <Link
              href={`/${estudio.slug}`}
              className="inline-flex w-fit items-center gap-1.5 text-sm text-white/85 transition hover:text-white"
            >
              <span aria-hidden>←</span> {estudio.name}
            </Link>

            <div className="flex flex-col gap-4 pb-6 md:pb-10">
              <div className="flex flex-row items-end justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-brand/50 bg-brand/20 px-3 py-1 text-xs font-semibold text-brand backdrop-blur-sm">
                      {sala.categoria}
                    </span>
                    {sala.disponibleHoy ? (
                      <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold text-paper">
                        Disponible hoy
                      </span>
                    ) : null}
                  </div>
                  <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-white drop-shadow md:text-5xl">
                    {sala.name}
                  </h1>
                  {sala.ratingAvg != null ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-white/80">
                      <StarsRow rating={sala.ratingAvg} />
                      <span className="font-medium text-white">
                        {sala.ratingAvg.toFixed(1)}
                      </span>
                      <span>({sala.ratingCount})</span>
                    </div>
                  ) : null}
                </div>
                <p className="shrink-0 text-right text-base text-white/85">
                  Desde{" "}
                  <span className="text-3xl font-semibold text-brand md:text-4xl">
                    {formatPrecio(sala.precioHora)}
                  </span>
                  <span className="text-white/60">/h</span>
                </p>
              </div>

              {descripcion ? (
                <p className="max-w-2xl text-sm leading-relaxed text-white/80 md:text-base">
                  {descripcion}
                </p>
              ) : null}

              {amenidades.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {amenidades.map((a) => (
                    <li
                      key={a}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur-sm"
                    >
                      <AmenidadIcon
                        name={a}
                        className="shrink-0 text-white/75"
                      />
                      {a}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        }
      />

      <div className="mx-auto max-w-7xl px-4 py-6 md:py-8">
        {genreTags.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {genreTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Dimensiones", value: medidas },
            { label: "Capacidad", value: `${sala.capacity} personas` },
            {
              label: "Horario",
              value: `${sala.horarioInicio} – ${sala.horarioFin}`,
            },
            { label: "Acústica", value: sala.acustica },
          ].map((s) => (
            <li
              key={s.label}
              className="rounded-2xl border border-line bg-surface px-4 py-3.5"
            >
              <p className="text-xs uppercase tracking-wide text-muted">
                {s.label}
              </p>
              <p className="mt-1 text-sm font-semibold text-ink">{s.value}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          <SalaReservaPicker sala={sala} />
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-surface p-4 md:p-5">
            <h2 className="font-display text-lg tracking-tight">
              Equipamiento incluido
            </h2>
            <ul className="mt-3 space-y-2">
              {sala.equipamiento.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-ink/90">
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand/20 text-[10px] font-bold text-brand"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-4 md:p-5">
            <h2 className="font-display text-lg tracking-tight">No incluido</h2>
            <ul className="mt-3 space-y-2">
              {sala.noIncluido.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm text-ink/90">
                  <span
                    className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-[10px] font-bold text-red-400"
                    aria-hidden
                  >
                    ✕
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <EstudioResenas
          resenas={estudio.resenas}
          ratingAvg={sala.ratingAvg ?? estudio.ratingAvg}
        />
      </div>

      <SiteFooter />
    </div>
  );
}
