"use client";

import {
  formatPrecio,
  type DirectorioSala,
} from "@/lib/directorio-data";
import { trackAnalytics } from "@/lib/analytics";
import { Modal } from "@/components/ui/modal";
import { EstudioMap } from "@/components/features/estudio/estudio-map";
import Link from "next/link";
import { Fragment, useState } from "react";

type Props = {
  /** Entrada de directorio = estudio (complejo), no una sala suelta */
  sala: DirectorioSala & { distKm?: number | null };
  distancia: string | null;
  favorito: boolean;
  onToggleFavorito: () => void;
  highlighted?: boolean;
  onHover?: (id: string | null) => void;
};

function IconStar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden fill="currentColor">
      <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.1l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.5z" />
    </svg>
  );
}

function StarsRating({
  rating,
  count,
  className = "",
}: {
  rating: number;
  count?: number;
  className?: string;
}) {
  /** Redondeo a media estrella: 4.4 → 4.5, 4.2 → 4.0 */
  const stepped = Math.min(5, Math.max(0, Math.round(rating * 2) / 2));
  const starPath =
    "M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.1l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.5z";

  return (
    <span
      className={`inline-flex items-center gap-1.5 leading-none ${className}`}
      aria-label={`${rating.toFixed(1)} de 5${count ? `, ${count} reseñas` : ""}`}
    >
      <span className="inline-flex gap-px" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => {
          const fill = Math.min(1, Math.max(0, stepped - i)); // 1 | 0.5 | 0
          return (
            <span key={i} className="relative inline-block h-3.5 w-3.5 shrink-0">
              <svg
                viewBox="0 0 20 20"
                className="absolute inset-0 h-3.5 w-3.5 text-line"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.4}
              >
                <path d={starPath} />
              </svg>
              {fill > 0 ? (
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="h-3.5 w-3.5 text-brand"
                    fill="currentColor"
                  >
                    <path d={starPath} />
                  </svg>
                </span>
              ) : null}
            </span>
          );
        })}
      </span>
      <span className="text-sm tabular-nums font-semibold text-ink">
        {rating.toFixed(1)}
      </span>
      {count != null && count > 0 ? (
        <span className="text-xs text-muted">({count})</span>
      ) : null}
    </span>
  );
}

function websiteHref(url: string): string {
  const t = url.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function firstPathSegment(pathname: string): string | null {
  const seg = pathname
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return seg ?? null;
}

/** Etiqueta legible: @handle en IG, host/ruta en el resto. */
function websiteLabel(url: string): string {
  try {
    const u = new URL(websiteHref(url));
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    const handle = firstPathSegment(path);

    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      const reserved = new Set(["p", "reel", "reels", "stories", "explore", "share"]);
      if (handle && !reserved.has(handle.toLowerCase())) return `@${handle}`;
      return "Instagram";
    }

    if (
      host === "facebook.com" ||
      host === "fb.com" ||
      host === "m.facebook.com" ||
      host.endsWith(".facebook.com")
    ) {
      if (handle) return `facebook.com/${handle}`;
      return "Facebook";
    }

    if (path && path !== "/") {
      const short = `${host}${path}`;
      return short.length > 36 ? `${short.slice(0, 33)}…` : short;
    }
    return host || url;
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  }
}

function websiteKindLabel(url: string): string {
  try {
    const host = new URL(websiteHref(url)).hostname
      .replace(/^www\./i, "")
      .toLowerCase();
    if (host === "instagram.com" || host.endsWith(".instagram.com")) {
      return "Instagram";
    }
    if (
      host === "facebook.com" ||
      host === "fb.com" ||
      host === "m.facebook.com" ||
      host.endsWith(".facebook.com")
    ) {
      return "Facebook";
    }
  } catch {
    /* ignore */
  }
  return "Web";
}

function extractWebsite(sala: DirectorioSala): string | null {
  if (sala.website?.trim()) return sala.website.trim();
  const m = sala.description?.match(/(?:^|\n)Web:\s*(\S+)/i);
  return m?.[1]?.trim() || null;
}

function IconPin({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path d="M10 17s-5-4.6-5-8a5 5 0 1 1 10 0c0 3.4-5 8-5 8z" />
      <circle cx="10" cy="9" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconHeart({
  className,
  filled,
}: {
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
    >
      <path d="M12 20.25S3.75 14.8 3.75 9.4A4.65 4.65 0 0 1 12 6.75 4.65 4.65 0 0 1 20.25 9.4C20.25 14.8 12 20.25 12 20.25z" />
    </svg>
  );
}

function FavButton({
  favorito,
  onToggle,
}: {
  favorito: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`absolute left-3 top-3 z-20 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow backdrop-blur transition ${
        favorito
          ? "bg-paper text-brand"
          : "bg-paper/85 text-ink/70 hover:text-ink"
      }`}
      aria-label={favorito ? "Quitar de favoritos" : "Agregar a favoritos"}
      aria-pressed={favorito}
    >
      <IconHeart className="h-[18px] w-[18px]" filled={favorito} />
    </button>
  );
}

/** Cliente / destacado: ficha rica, CTA reservá online */
function EstudioClienteCard({
  sala,
  distancia,
  favorito,
  onToggleFavorito,
  highlighted,
  onHover,
}: Props) {
  const destacado = sala.plan === "destacado";

  return (
    <article
      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-surface transition ${
        highlighted
          ? "border-brand shadow-md ring-2 ring-brand/30"
          : destacado
            ? "border-brand/50 hover:border-brand"
            : "border-line hover:border-brand/40"
      }`}
      onMouseEnter={() => onHover?.(sala.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      <Link
        href={`/${sala.slug}`}
        className="absolute inset-0 z-10"
        aria-label={`Ver ${sala.name}`}
      />

      <div className="relative aspect-[16/10] overflow-hidden bg-paper">
        {sala.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={sala.photo}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-2 to-paper text-muted">
            <span className="text-sm font-medium">{sala.name}</span>
          </div>
        )}

        <FavButton favorito={favorito} onToggle={onToggleFavorito} />

        <div className="absolute right-3 top-3 z-[1] flex flex-col items-end gap-1.5">
          {destacado ? (
            <span className="rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-paper">
              Destacado
            </span>
          ) : null}
          <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            {sala.zona}
          </span>
        </div>

        {sala.libresHoy != null && sala.libresHoy > 0 ? (
          <span className="absolute bottom-3 left-3 z-[1] rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-paper">
            {sala.libresHoy} libre{sala.libresHoy === 1 ? "" : "s"} hoy
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Estudio
            </p>
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate font-[family-name:var(--font-display)] text-lg leading-tight tracking-tight text-ink">
                {sala.name}
              </h3>
              {distancia ? (
                <span className="shrink-0 rounded-md border border-brand px-2 py-0.5 text-[11px] font-medium tabular-nums text-brand">
                  {distancia}
                </span>
              ) : null}
            </div>
          </div>
          {sala.ratingAvg != null && sala.ratingCount > 0 ? (
            <p className="flex shrink-0 items-center gap-1 pt-0.5 text-sm">
              <IconStar className="h-3.5 w-3.5 text-brand" />
              <span className="font-semibold text-ink">
                {sala.ratingAvg.toFixed(1)}
              </span>
              <span className="text-muted">({sala.ratingCount})</span>
            </p>
          ) : null}
        </div>

        <p className="flex items-start gap-1.5 text-sm text-muted">
          <IconPin className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{sala.address}</span>
        </p>

        {sala.tagsDestacados.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {sala.tagsDestacados.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-line px-2 py-0.5 text-[11px] text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
          <p className="text-sm text-muted">
            {sala.cantidadSalas} sala{sala.cantidadSalas === 1 ? "" : "s"} · Desde{" "}
            <span className="font-semibold text-brand">
              {formatPrecio(sala.precioDesde)}
            </span>
            /h
          </p>
          <span className="relative z-20 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-paper">
            Reservá online
          </span>
        </div>
      </div>
    </article>
  );
}

/** Seed / guía: fila compacta — no se confunde con card comercial */
const DIAS_GUIA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
const DIAS_TABLA = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"] as const;
const ORDER_LUN_DOM = [1, 2, 3, 4, 5, 6, 0] as const;

function sortLunDom(a: number, b: number) {
  const rank = (d: number) => (d === 0 ? 7 : d);
  return rank(a) - rank(b);
}

/** Compacta rangos contiguos: Lun, Mar, Mié → Lun–Mié */
function labelDias(days: number[]): string {
  const sorted = [...new Set(days)].sort(sortLunDom);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return DIAS_GUIA[sorted[0]!] ?? "";

  const parts: string[] = [];
  let start = sorted[0]!;
  let prev = sorted[0]!;

  const flush = (from: number, to: number) => {
    const a = DIAS_GUIA[from] ?? String(from);
    const b = DIAS_GUIA[to] ?? String(to);
    parts.push(from === to ? a : `${a}–${b}`);
  };

  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i]!;
    const prevRank = prev === 0 ? 7 : prev;
    const dRank = d === 0 ? 7 : d;
    if (dRank === prevRank + 1) {
      prev = d;
      continue;
    }
    flush(start, prev);
    start = d;
    prev = d;
  }
  flush(start, prev);
  return parts.join(", ");
}

function groupHorariosCard(
  horarios: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
) {
  const bySlot = new Map<string, number[]>();
  for (const h of horarios) {
    const key = `${h.startTime}|${h.endTime}`;
    const days = bySlot.get(key) ?? [];
    days.push(h.dayOfWeek);
    bySlot.set(key, days);
  }

  const groups: Array<{
    label: string;
    startTime: string;
    endTime: string;
    firstDay: number;
  }> = [];

  for (const [key, daysRaw] of bySlot) {
    const [startTime, endTime] = key.split("|") as [string, string];
    const days = [...new Set(daysRaw)].sort(sortLunDom);
    groups.push({
      label: labelDias(days),
      startTime,
      endTime,
      firstDay: days[0] ?? 1,
    });
  }

  return groups.sort((a, b) => sortLunDom(a.firstDay, b.firstDay));
}

function GuiaAddress({
  address,
  zona,
  className = "text-sm text-ink/65",
}: {
  address?: string | null;
  zona?: string | null;
  className?: string;
}) {
  const parts = (address ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const street = parts[0] ?? null;
  // Solo barrio/localidad (sin "Ciudad Autónoma…") al lado de la calle
  const localidad = parts[1] ?? (!street ? zona : null) ?? null;

  if (!street && !localidad) return null;

  return (
    <p className={className}>
      {street}
      {street && localidad ? ` · ${localidad}` : localidad}
    </p>
  );
}

export function GuiaRow({
  sala,
  distancia,
}: {
  sala: DirectorioSala & { distKm?: number | null };
  distancia: string | null;
}) {
  const [open, setOpen] = useState(false);
  const telHref = sala.telefono
    ? `tel:${sala.telefono.replace(/\s/g, "")}`
    : undefined;
  const website = extractWebsite(sala);
  const horariosOrdenados = [...(sala.horarios ?? [])].sort((a, b) =>
    sortLunDom(a.dayOfWeek, b.dayOfWeek),
  );
  const horarioGroups = groupHorariosCard(horariosOrdenados);
  const hasRating = sala.ratingAvg != null && sala.ratingCount > 0;

  return (
    <li>
      <button
        type="button"
        aria-label={`Ver perfil de ${sala.name}`}
        onClick={() => {
          setOpen(true);
          trackAnalytics({
            eventType: "guia.contacto_abrir",
            directorioEntradaId: sala.id,
            payload: { name: sala.name, zona: sala.zona },
          });
        }}
        className="flex w-full flex-col gap-3 rounded-2xl border border-dashed border-line bg-surface/40 px-3 py-3 text-left transition hover:border-brand/40 hover:bg-surface/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 sm:flex-row sm:flex-nowrap sm:items-center sm:gap-4 sm:px-4"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="truncate text-base font-medium text-ink sm:text-lg">
              {sala.name}
            </h3>
            {distancia ? (
              <span className="shrink-0 rounded-md border border-brand px-2 py-0.5 text-[11px] font-medium tabular-nums text-brand">
                {distancia}
              </span>
            ) : null}
          </div>
          {hasRating ? (
            <StarsRating rating={sala.ratingAvg!} count={sala.ratingCount} />
          ) : null}
          <GuiaAddress address={sala.address} zona={sala.zona} />
          {horarioGroups.length > 0 ? (
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs text-ink">
              {horarioGroups.map((g, i) => (
                <Fragment key={`${g.label}-${g.startTime}-${g.endTime}`}>
                  {i > 0 ? (
                    <span className="select-none text-brand/55" aria-hidden>
                      ·
                    </span>
                  ) : null}
                  <span className="inline-flex items-baseline gap-1.5">
                    <span className="text-muted">{g.label}</span>
                    <span className="tabular-nums font-medium text-ink">
                      {g.startTime}–{g.endTime}
                    </span>
                  </span>
                </Fragment>
              ))}
            </p>
          ) : (
            <p className="text-xs text-muted">Horarios no publicados</p>
          )}
        </div>
        <span className="inline-flex w-full items-center justify-center rounded-lg border border-line bg-surface px-3 py-2.5 text-xs font-semibold text-ink sm:w-auto sm:shrink-0">
          Ver perfil
        </span>
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Contacto"
        placement="center"
        className="!max-h-[min(88vh,720px)] sm:!max-w-3xl"
        titleExtra={
          <Link
            href="/soy-dueno"
            className="max-w-[9.5rem] truncate text-left text-xs text-muted underline-offset-2 hover:text-brand hover:underline sm:max-w-none"
            onClick={() => setOpen(false)}
          >
            Soy el dueño
          </Link>
        }
      >
        <div className="flex flex-col gap-3.5">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h3
                className="min-w-0 truncate font-[family-name:var(--font-display)] text-xl leading-tight tracking-tight text-ink"
                title={sala.name}
              >
                {sala.name}
              </h3>
              {distancia ? (
                <span className="shrink-0 rounded-md border border-brand px-2 py-0.5 text-[11px] font-medium tabular-nums text-brand">
                  {distancia}
                </span>
              ) : null}
            </div>
            {hasRating ? (
              <div className="mt-1.5">
                <StarsRating rating={sala.ratingAvg!} count={sala.ratingCount} />
              </div>
            ) : null}
            {sala.address || sala.zona ? (
              <div className="mt-1.5">
                <GuiaAddress
                  address={sala.address}
                  zona={sala.zona}
                  className="text-sm text-muted"
                />
              </div>
            ) : null}
          </div>

          <dl className="grid gap-2.5 border-t border-line pt-3 text-sm">
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <dt className="shrink-0 text-muted">Teléfono</dt>
              <dd className="min-w-0 truncate text-right font-medium text-ink">
                {telHref && sala.telefono ? (
                  <a
                    href={telHref}
                    onClick={() => {
                      trackAnalytics({
                        eventType: "guia.contacto_llamar",
                        directorioEntradaId: sala.id,
                        payload: { name: sala.name },
                      });
                    }}
                    className="text-brand hover:underline"
                  >
                    {sala.telefono}
                  </a>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </dd>
            </div>
            <div className="flex min-w-0 items-baseline justify-between gap-3">
              <dt className="shrink-0 text-muted">
                {website ? websiteKindLabel(website) : "Web"}
              </dt>
              <dd className="min-w-0 truncate text-right">
                {website ? (
                  <a
                    href={websiteHref(website)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-brand hover:underline"
                  >
                    {websiteLabel(website)}
                  </a>
                ) : (
                  <span className="text-muted">—</span>
                )}
              </dd>
            </div>
          </dl>

          <div className="border-t border-line pt-3">
            <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
              Horarios
            </p>
            {horariosOrdenados.length > 0 ? (
              <>
                {/* Mobile: grupos compactos */}
                <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5 text-sm text-ink sm:hidden">
                  {horarioGroups.map((g, i) => (
                    <Fragment key={`${g.label}-${g.startTime}-${g.endTime}`}>
                      {i > 0 ? (
                        <span className="select-none text-brand/55" aria-hidden>
                          ·
                        </span>
                      ) : null}
                      <span className="inline-flex items-baseline gap-1.5">
                        <span className="text-muted">{g.label}</span>
                        <span className="tabular-nums font-medium text-ink">
                          {g.startTime}–{g.endTime}
                        </span>
                      </span>
                    </Fragment>
                  ))}
                </p>

                {/* Desktop: tabla semanal */}
                <div className="hidden overflow-hidden rounded-xl border border-line sm:block">
                  <table className="w-full table-fixed border-collapse text-center text-sm">
                    <colgroup>
                      {ORDER_LUN_DOM.map((dow) => (
                        <col key={dow} className="w-[14.2857%]" />
                      ))}
                    </colgroup>
                    <thead>
                      <tr className="bg-surface-2/60">
                        {ORDER_LUN_DOM.map((dow) => {
                          const isToday = dow === new Date().getDay();
                          return (
                            <th
                              key={dow}
                              scope="col"
                              className={`border-b border-r border-line px-1 py-2.5 text-xs font-semibold last:border-r-0 ${
                                isToday
                                  ? "bg-brand/15 text-brand"
                                  : "text-muted"
                              }`}
                            >
                              {DIAS_TABLA[dow]}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        {ORDER_LUN_DOM.map((dow) => {
                          const delDia = horariosOrdenados.filter(
                            (x) => x.dayOfWeek === dow,
                          );
                          const isToday = dow === new Date().getDay();
                          return (
                            <td
                              key={dow}
                              className={`border-r border-line px-1 py-3 align-middle last:border-r-0 ${
                                isToday ? "bg-brand/10" : ""
                              }`}
                            >
                              {delDia.length > 0 ? (
                                <span className="flex flex-col gap-0.5 text-[11px] tabular-nums text-muted">
                                  {delDia.map((h, i) => (
                                    <span key={`${h.startTime}-${h.endTime}-${i}`}>
                                      {h.startTime} – {h.endTime}
                                    </span>
                                  ))}
                                </span>
                              ) : (
                                <span className="text-[11px] text-muted/60">
                                  Cerrado
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted sm:hidden">
                  Horarios no publicados
                </p>
                <div className="hidden overflow-hidden rounded-xl border border-line sm:block">
                  <table className="w-full table-fixed border-collapse text-center text-sm">
                    <colgroup>
                      {ORDER_LUN_DOM.map((dow) => (
                        <col key={dow} className="w-[14.2857%]" />
                      ))}
                    </colgroup>
                    <thead>
                      <tr className="bg-surface-2/60">
                        {ORDER_LUN_DOM.map((dow) => (
                          <th
                            key={dow}
                            scope="col"
                            className="border-b border-r border-line px-1 py-2.5 text-xs font-semibold text-muted last:border-r-0"
                          >
                            {DIAS_TABLA[dow]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td
                          colSpan={7}
                          className="px-3 py-5 text-sm text-muted"
                        >
                          Horarios no publicados
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {sala.lat != null && sala.lng != null ? (
            <div className="border-t border-line pt-3">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                Cómo llegar
              </p>
              <EstudioMap
                mode="js"
                compact
                lat={sala.lat}
                lng={sala.lng}
                address={sala.address || sala.name}
                name={sala.name}
                googlePlaceId={sala.googlePlaceId}
              />
            </div>
          ) : null}
        </div>
      </Modal>
    </li>
  );
}

export function SalaCard(props: Props) {
  return <EstudioClienteCard {...props} />;
}
