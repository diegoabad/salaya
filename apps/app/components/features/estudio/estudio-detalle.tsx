"use client";

import { SiteFooter } from "@/components/layouts/site-footer";
import { SiteHeader } from "@/components/layouts/site-header";
import { Modal } from "@/components/ui/modal";
import { formatPrecio } from "@/lib/directorio-data";
import type { EstudioDetalle } from "@/lib/estudio-detalle-data";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AmenidadIcon } from "./amenidad-icon";
import { EstudioResenas } from "./estudio-resenas";
import { EstudioMap } from "./estudio-map";
import { PhotoGallery } from "./photo-gallery";
import { SalaEstudioCard } from "./sala-estudio-card";

/** getDay(): 0=Dom … 6=Sáb — mostramos Lu→Do */
const ORDER_LUN_DOM = [1, 2, 3, 4, 5, 6, 0] as const;

type Promo = EstudioDetalle["promociones"][number];

function ensureHttp(url: string): string {
  const t = url.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

function whatsappHref(raw: string): string {
  const t = raw.trim();
  if (/wa\.me|whatsapp\.com/i.test(t)) return ensureHttp(t);
  const digits = t.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : ensureHttp(t);
}

function firstPathSegment(pathname: string): string | null {
  const seg = pathname
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean)[0];
  return seg ?? null;
}

/** Valor legible de un link: @handle, host/ruta, etc. */
function contactDisplayValue(url: string, kind: "ig" | "yt" | "tt" | "web" | "other"): string {
  try {
    const u = new URL(ensureHttp(url));
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    const handle = firstPathSegment(path);

    if (kind === "ig" || host === "instagram.com" || host.endsWith(".instagram.com")) {
      const reserved = new Set(["p", "reel", "reels", "stories", "explore", "share"]);
      if (handle && !reserved.has(handle.toLowerCase())) return `@${handle}`;
      return "instagram.com";
    }
    if (kind === "yt" || host.includes("youtube.com") || host === "youtu.be") {
      if (host === "youtu.be" && handle) return `youtu.be/${handle}`;
      if (handle) {
        const short = `${host}${path}`;
        return short.length > 40 ? `${short.slice(0, 37)}…` : short;
      }
      return "youtube.com";
    }
    if (kind === "tt" || host.includes("tiktok.com")) {
      if (handle) return handle.startsWith("@") ? handle : `@${handle}`;
      return "tiktok.com";
    }
    if (path && path !== "/") {
      const short = `${host}${path}`;
      return short.length > 40 ? `${short.slice(0, 37)}…` : short;
    }
    return host || url;
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
  }
}

function whatsappDisplay(raw: string): string {
  const t = raw.trim();
  if (/wa\.me|whatsapp\.com/i.test(t)) return contactDisplayValue(t, "other");
  return t;
}

function contactItems(estudio: EstudioDetalle): Array<{
  key: string;
  label: string;
  value: string;
  href: string;
  external?: boolean;
}> {
  const items: Array<{
    key: string;
    label: string;
    value: string;
    href: string;
    external?: boolean;
  }> = [];
  if (estudio.telefono?.trim()) {
    const tel = estudio.telefono.trim();
    items.push({
      key: "tel",
      label: "Teléfono",
      value: tel,
      href: `tel:${tel.replace(/\s/g, "")}`,
    });
  }
  if (estudio.whatsapp?.trim()) {
    const wa = estudio.whatsapp.trim();
    items.push({
      key: "wa",
      label: "WhatsApp",
      value: whatsappDisplay(wa),
      href: whatsappHref(wa),
      external: true,
    });
  }
  if (estudio.instagramUrl?.trim()) {
    const ig = estudio.instagramUrl.trim();
    items.push({
      key: "ig",
      label: "Instagram",
      value: contactDisplayValue(ig, "ig"),
      href: ensureHttp(ig),
      external: true,
    });
  }
  const web = estudio.websiteUrl?.trim() || estudio.website?.trim();
  if (web) {
    items.push({
      key: "web",
      label: "Web",
      value: contactDisplayValue(web, "web"),
      href: ensureHttp(web),
      external: true,
    });
  }
  if (estudio.youtubeUrl?.trim()) {
    const yt = estudio.youtubeUrl.trim();
    items.push({
      key: "yt",
      label: "YouTube",
      value: contactDisplayValue(yt, "yt"),
      href: ensureHttp(yt),
      external: true,
    });
  }
  if (estudio.tiktokUrl?.trim()) {
    const tt = estudio.tiktokUrl.trim();
    items.push({
      key: "tt",
      label: "TikTok",
      value: contactDisplayValue(tt, "tt"),
      href: ensureHttp(tt),
      external: true,
    });
  }
  for (const [i, l] of (estudio.linksExtra ?? []).entries()) {
    if (!l.label?.trim() || !l.url?.trim()) continue;
    const url = l.url.trim();
    items.push({
      key: `x-${i}`,
      label: l.label.trim(),
      value: contactDisplayValue(url, "other"),
      href: ensureHttp(url),
      external: true,
    });
  }
  return items;
}

function sortLunDom(a: number, b: number) {
  const rank = (d: number) => (d === 0 ? 7 : d);
  return rank(a) - rank(b);
}

function galleryImages(estudio: EstudioDetalle): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (src?: string | null) => {
    const s = src?.trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  const hasEstudioGallery = (estudio.photos?.length ?? 0) > 0;
  for (const p of estudio.photos ?? []) push(p);
  push(estudio.photo);
  // Si el estudio ya tiene galería propia, no mezclar fotos de salas
  if (!hasEstudioGallery) {
    for (const sala of estudio.salas) {
      for (const p of sala.photos) push(p);
    }
  }
  return out.slice(0, 12);
}

function formatDias(days: number[]) {
  if (!days.length) return "Todos los días";
  return formatDiasRango(days);
}

/** Colapsa días consecutivos: Lun–Vie; si no, lista corta. */
function formatDiasRango(days: number[]): string {
  const names = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;
  const sorted = [...new Set(days)].sort(sortLunDom);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return names[sorted[0]!]!;

  const ranks = sorted.map((d) => (d === 0 ? 7 : d));
  let consecutive = true;
  for (let i = 1; i < ranks.length; i++) {
    if (ranks[i]! !== ranks[i - 1]! + 1) {
      consecutive = false;
      break;
    }
  }
  if (consecutive && sorted.length >= 3) {
    return `${names[sorted[0]!]}–${names[sorted[sorted.length - 1]!]}`;
  }
  return sorted.map((d) => names[d]!).join(", ");
}

/** Agrupa días que comparten el mismo horario (semana Lun→Dom). */
function groupHorarios(
  horarios: Array<{ dayOfWeek: number; startTime: string; endTime: string }>,
) {
  const bySlot = new Map<string, number[]>();
  for (const h of horarios) {
    const key = `${h.startTime}|${h.endTime}`;
    const days = bySlot.get(key) ?? [];
    days.push(h.dayOfWeek);
    bySlot.set(key, days);
  }

  const openDays = new Set(horarios.map((h) => h.dayOfWeek));

  const ranges: Array<{
    label: string;
    startTime: string | null;
    endTime: string | null;
    days: number[];
    cerrado: boolean;
  }> = [];

  for (const [key, daysRaw] of bySlot) {
    const [startTime, endTime] = key.split("|") as [string, string];
    const days = [...new Set(daysRaw)].sort(sortLunDom);
    ranges.push({
      label: formatDiasRango(days),
      startTime,
      endTime,
      days,
      cerrado: false,
    });
  }

  const closed = ORDER_LUN_DOM.filter((d) => !openDays.has(d));
  if (closed.length > 0 && horarios.length > 0) {
    ranges.push({
      label: formatDiasRango([...closed]),
      startTime: null,
      endTime: null,
      days: [...closed],
      cerrado: true,
    });
  }

  return ranges.sort((a, b) => sortLunDom(a.days[0] ?? 1, b.days[0] ?? 1));
}

function promoResumen(p: Promo): string {
  const parts: string[] = [];
  if (p.tipo === "puntual") parts.push("Promo puntual");
  else parts.push("Continua");
  if (p.tipo === "continuo" && p.daysOfWeek.length) {
    parts.push(formatDias(p.daysOfWeek));
  }
  if (p.fechaDesde && p.fechaHasta) {
    parts.push(`${p.fechaDesde} → ${p.fechaHasta}`);
  }
  if (p.startTime && p.endTime) {
    parts.push(`${p.startTime}–${p.endTime}`);
  }
  return parts.join(" · ");
}

function promoExplicacion(p: Promo): string {
  const desc =
    p.descuentoPorcentaje != null
      ? `Descuento del ${Math.round(p.descuentoPorcentaje)}% sobre el precio base de la sala`
      : `Precio promocional de ${formatPrecio(p.precioPorHora)}/h`;

  if (p.tipo === "continuo") {
    const dias =
      p.daysOfWeek.length > 0 ? formatDias(p.daysOfWeek) : "todos los días";
    const franja =
      p.startTime && p.endTime
        ? ` entre ${p.startTime} y ${p.endTime}`
        : " todo el día";
    return `${desc}. Aplica ${dias}${franja}, de forma recurrente.`;
  }

  const vigencia =
    p.fechaDesde && p.fechaHasta
      ? ` Vigente del ${p.fechaDesde} al ${p.fechaHasta}.`
      : "";
  return `${desc}.${vigencia} Es una promo con fechas limitadas.`;
}

function PromoCarousel({
  promos,
  onOpen,
}: {
  promos: Promo[];
  onOpen: (p: Promo) => void;
}) {
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(max > 4 && el.scrollLeft < max - 4);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [promos.length]);

  const scrollByCard = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-promo-card]");
    const step = (card?.offsetWidth ?? 280) + 12;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const showArrows = promos.length > 2;

  return (
    <section className="scroll-mt-24">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight md:text-2xl">
          Promociones
        </h2>
        {showArrows ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Promoción anterior"
              disabled={!canPrev}
              onClick={() => scrollByCard(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span aria-hidden className="text-base leading-none">
                ‹
              </span>
            </button>
            <button
              type="button"
              aria-label="Promoción siguiente"
              disabled={!canNext}
              onClick={() => scrollByCard(1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span aria-hidden className="text-base leading-none">
                ›
              </span>
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-4 overflow-hidden">
        <ul
          ref={scrollerRef}
          className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth overscroll-x-contain"
        >
          {promos.map((p) => (
            <li
              key={p.id}
              data-promo-card
              className="w-[min(85%,18rem)] shrink-0 snap-start sm:w-[calc((100%-0.75rem)/2.35)]"
            >
              <button
                type="button"
                onClick={() => onOpen(p)}
                className="flex h-full w-full flex-col rounded-2xl border border-line bg-surface px-4 py-3.5 text-left transition hover:border-brand/40"
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base tracking-tight text-ink">
                      {p.nombre}
                    </p>
                    <p className="mt-1 text-xs leading-snug text-muted">
                      {promoResumen(p)}
                    </p>
                  </div>
                  {p.descuentoPorcentaje != null ? (
                    <span className="shrink-0 rounded-md bg-brand/15 px-2 py-1 text-sm font-bold tabular-nums text-brand">
                      −{Math.round(p.descuentoPorcentaje)}%
                    </span>
                  ) : (
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-brand">
                      {formatPrecio(p.precioPorHora)}/h
                    </span>
                  )}
                </div>
                <span className="mt-3 text-[11px] text-muted">Ver términos</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Section({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-[family-name:var(--font-display)] text-xl tracking-tight md:text-2xl">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Columnas según cantidad: evita filas raras (ej. 4 → 2×2, no 3+1). */
function salasGridClass(n: number): string {
  if (n <= 1) return "grid max-w-lg gap-4 grid-cols-1";
  if (n === 2) return "grid gap-4 sm:grid-cols-2";
  if (n === 3) return "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
  if (n === 4) return "grid gap-4 sm:grid-cols-2";
  if (n % 3 === 0) return "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
  if (n % 2 === 0) return "grid gap-4 sm:grid-cols-2 lg:grid-cols-2";
  // 5, 7, 11…: 3 cols deja menos “huérfanos” que forzar 2
  return "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
}

type Props = {
  estudio: EstudioDetalle;
  /** Destino del “Volver” (default: directorio) */
  backHref?: string;
  backLabel?: string;
  /**
   * `full` = página pública (header/footer).
   * `embed` = vista embebida en el panel (sin chrome del sitio).
   */
  chrome?: "full" | "embed";
};

export function EstudioDetalleView({
  estudio,
  backHref = "/",
  backLabel = "Volver",
  chrome = "full",
}: Props) {
  const images = useMemo(() => galleryImages(estudio), [estudio]);
  const salas = estudio.salas;
  const horarios = [...(estudio.horarios ?? [])].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek,
  );
  const horarioGroups = groupHorarios(horarios);
  const promos = estudio.promociones ?? [];
  const descripcion = estudio.description?.trim() ?? "";
  const amenidades = estudio.amenidades;
  const [promoOpen, setPromoOpen] = useState<Promo | null>(null);
  const embed = chrome === "embed";

  return (
    <div
      className={
        embed
          ? "flex flex-col bg-paper text-ink"
          : "flex min-h-full flex-col bg-paper text-ink"
      }
    >
      {!embed ? <SiteHeader variant="solid" /> : null}

      {/* Hero */}
      <PhotoGallery
        images={images}
        alt={estudio.name}
        flush
        className={
          embed
            ? "h-[min(52vh,420px)] min-h-[240px] w-full md:h-[min(56vh,480px)]"
            : "h-[min(78vh,720px)] min-h-[420px] w-full md:h-[min(82vh,780px)]"
        }
        overlay={
          <div className="mx-auto flex h-full w-full max-w-7xl flex-col justify-between px-4 py-5 md:py-8">
            {!embed ? (
              <Link
                href={backHref}
                className="inline-flex w-fit items-center gap-1.5 text-sm text-white/85 transition hover:text-white"
              >
                <span aria-hidden>←</span> {backLabel}
              </Link>
            ) : (
              <span className="inline-flex w-fit rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur-sm">
                Vista previa pública
              </span>
            )}

            <div className="flex flex-col gap-4 pb-6 md:pb-10">
              <div className="flex flex-row items-end justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-white drop-shadow md:text-5xl">
                    {estudio.name}
                  </h1>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80">
                    <span>{estudio.address}</span>
                    {estudio.ratingAvg != null ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-brand">★</span>
                        <span className="font-medium text-white">
                          {estudio.ratingAvg.toFixed(1)}
                        </span>
                        <span>({estudio.ratingCount})</span>
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 text-right text-base text-white/85">
                  Desde{" "}
                  <span className="text-3xl font-semibold text-brand md:text-4xl">
                    {formatPrecio(estudio.precioDesde)}
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

      <div
        className={
          embed
            ? "mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 md:gap-10 md:py-8"
            : "mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 md:gap-12 md:py-10"
        }
      >
        {horarioGroups.length > 0 ? (
          <Section title="Horarios">
            <ul className="divide-y divide-line border-y border-line">
              {horarioGroups.map((g) => (
                <li
                  key={`${g.label}-${g.startTime ?? "c"}`}
                  className="flex items-baseline justify-between gap-4 px-3 py-3.5"
                >
                  <span className="text-sm font-medium text-ink">{g.label}</span>
                  {g.cerrado || !g.startTime || !g.endTime ? (
                    <span className="text-sm text-muted">Cerrado</span>
                  ) : (
                    <span className="tabular-nums text-sm font-medium text-ink">
                      {g.startTime}–{g.endTime}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {promos.length > 0 ? (
          <PromoCarousel promos={promos} onOpen={setPromoOpen} />
        ) : null}

        <Section title={`Salas (${salas.length})`} id="salas">
          {salas.length > 0 ? (
            <ul className={salasGridClass(salas.length)}>
              {salas.map((sala, i) => (
                <li
                  key={sala.id}
                  className="animate-rise"
                  style={{ animationDelay: `${Math.min(i, 5) * 0.05}s` }}
                >
                  <SalaEstudioCard estudioSlug={estudio.slug} sala={sala} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              Este estudio todavía no publicó salas.
            </p>
          )}
        </Section>

        <Section title="Ubicación">
          <div className="space-y-3">
            {estudio.address?.trim() || estudio.zona?.trim() ? (
              <p className="text-base font-medium text-ink">
                {estudio.address?.trim() || estudio.zona.trim()}
              </p>
            ) : null}
            <EstudioMap
              mode="js"
              lat={estudio.lat}
              lng={estudio.lng}
              address={estudio.address}
              name={estudio.name}
              googlePlaceId={estudio.googlePlaceId}
            />
          </div>
        </Section>

        {(() => {
          const contacts = contactItems(estudio);
          if (contacts.length === 0) return null;
          return (
            <Section title="Contacto">
              <ul className="divide-y divide-line border-y border-line">
                {contacts.map((c) => (
                  <li key={c.key}>
                    <a
                      href={c.href}
                      {...(c.external
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                      className="group block px-3 py-3.5 transition hover:bg-surface-2/50"
                    >
                      <span className="block text-xs font-medium uppercase tracking-wide text-muted">
                        {c.label}
                      </span>
                      <span className="mt-1 block truncate text-base font-medium text-ink group-hover:text-brand">
                        {c.value}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          );
        })()}

        <EstudioResenas
          resenas={estudio.resenas}
          ratingAvg={estudio.ratingAvg}
        />
      </div>

      {!embed ? <SiteFooter /> : null}

      <Modal
        open={Boolean(promoOpen)}
        onClose={() => setPromoOpen(null)}
        title={promoOpen?.nombre ?? "Promoción"}
        placement="center"
        className="sm:max-w-md!"
        titleExtra={
          promoOpen?.descuentoPorcentaje != null ? (
            <span className="rounded-md bg-brand/15 px-2 py-0.5 text-sm font-bold tabular-nums text-brand">
              −{Math.round(promoOpen.descuentoPorcentaje)}%
            </span>
          ) : null
        }
      >
        {promoOpen ? (
          <div className="flex flex-col gap-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Cómo funciona
              </p>
              <p className="mt-1.5 leading-relaxed text-ink">
                {promoExplicacion(promoOpen)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Condiciones
              </p>
              <ul className="mt-1.5 list-disc space-y-1.5 pl-4 leading-relaxed text-muted">
                <li>
                  El descuento se aplica al precio por hora de la sala en el
                  momento de reservar, si el turno cae dentro de la vigencia.
                </li>
                <li>
                  Sujeto a disponibilidad. No acumulable con otras promociones
                  salvo que el estudio indique lo contrario.
                </li>
                <li>
                  La política de cancelación y seña del estudio sigue vigente
                  sobre el monto final.
                </li>
                <li>
                  El estudio puede modificar o dar de baja la promo sin previo
                  aviso.
                </li>
              </ul>
            </div>
            <p className="text-xs text-muted">{promoResumen(promoOpen)}</p>
            <button
              type="button"
              onClick={() => setPromoOpen(null)}
              className="mt-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-paper"
            >
              Entendido
            </button>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
