"use client";

import {
  updateHorariosAction,
  updateNegocioAction,
  type NegocioDto,
} from "@/app/actions/negocio";
import { EstudioDetalleView } from "@/components/features/estudio/estudio-detalle";
import {
  AMENIDAD_ICON_PRESETS,
  AmenidadIcon,
  type AmenidadIconPresetId,
} from "@/components/features/estudio/amenidad-icon";
import { EstudioPhotosUpload } from "@/components/features/panel/estudio-photos-upload";
import { PanelButton } from "@/components/features/panel/panel-ui";
import { AddressPlacesInput } from "@/components/ui/address-places-input";
import { Modal } from "@/components/ui/modal";
import type { EstudioDetalle } from "@/lib/estudio-detalle-data";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

const DIAS_SEMANA = [
  { day: 1, label: "Lunes" },
  { day: 2, label: "Martes" },
  { day: 3, label: "Miércoles" },
  { day: 4, label: "Jueves" },
  { day: 5, label: "Viernes" },
  { day: 6, label: "Sábado" },
  { day: 0, label: "Domingo" },
] as const;

type FranjaHorario = {
  startTime: string;
  endTime: string;
};

type DiaHorario = {
  dayOfWeek: number;
  closed: boolean;
  franjas: FranjaHorario[];
};

type LinkExtra = { label: string; url: string };

type Draft = {
  name: string;
  sedeName: string;
  zona: string;
  address: string;
  description: string;
  photo: string;
  photos: string[];
  amenidades: string[];
  tagsDestacados: string[];
  telefono: string;
  whatsapp: string;
  instagramUrl: string;
  websiteUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  linksExtra: LinkExtra[];
  lat: number | null;
  lng: number | null;
  horarios: DiaHorario[];
};

const FRANJA_DEFAULT: FranjaHorario = { startTime: "10:00", endTime: "23:00" };
const MAX_FRANJAS_DIA = 4;

function initPhotos(
  estudio: EstudioDetalle,
  negocio: NegocioDto,
): string[] {
  const fromSede = negocio.sede.photos?.length
    ? negocio.sede.photos
    : estudio.photos?.length
      ? estudio.photos
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (u?: string | null) => {
    const s = u?.trim();
    if (!s || seen.has(s)) return;
    seen.add(s);
    out.push(s);
  };
  for (const p of fromSede) push(p);
  push(negocio.sede.photoUrl);
  push(estudio.photo);
  return out.slice(0, 12);
}

function initHorarios(rows: NegocioDto["horarios"]): DiaHorario[] {
  return DIAS_SEMANA.map(({ day }) => {
    const dayRows = rows
      .filter((h) => h.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return {
      dayOfWeek: day,
      closed: dayRows.length === 0,
      franjas:
        dayRows.length > 0
          ? dayRows.map((r) => ({
              startTime: r.startTime.slice(0, 5),
              endTime: r.endTime.slice(0, 5),
            }))
          : [{ ...FRANJA_DEFAULT }],
    };
  });
}

function draftFromSources(
  estudio: EstudioDetalle,
  negocio: NegocioDto,
): Draft {
  return {
    name: negocio.tenant.name || estudio.name,
    sedeName: negocio.sede.name || estudio.name,
    zona: negocio.sede.zona ?? estudio.zona ?? "",
    address: negocio.sede.address ?? estudio.address ?? "",
    description: negocio.sede.description ?? estudio.description ?? "",
    photo: negocio.sede.photoUrl ?? estudio.photo ?? "",
    photos: initPhotos(estudio, negocio),
    amenidades: [...(negocio.sede.amenidades.length
      ? negocio.sede.amenidades
      : estudio.amenidades)],
    tagsDestacados: [
      ...(negocio.directorio.tagsDestacados.length
        ? negocio.directorio.tagsDestacados
        : estudio.tagsDestacados),
    ],
    telefono: negocio.directorio.telefono || estudio.telefono || "",
    whatsapp: negocio.tenant.whatsapp || estudio.whatsapp || "",
    instagramUrl: negocio.tenant.instagramUrl || estudio.instagramUrl || "",
    websiteUrl: negocio.tenant.websiteUrl || estudio.websiteUrl || "",
    youtubeUrl: negocio.tenant.youtubeUrl || estudio.youtubeUrl || "",
    tiktokUrl: negocio.tenant.tiktokUrl || estudio.tiktokUrl || "",
    linksExtra: [
      ...(negocio.tenant.linksExtra?.length
        ? negocio.tenant.linksExtra
        : estudio.linksExtra ?? []),
    ],
    lat: negocio.sede.lat ?? estudio.lat,
    lng: negocio.sede.lng ?? estudio.lng,
    horarios: initHorarios(
      negocio.horarios.length ? negocio.horarios : estudio.horarios,
    ),
  };
}

function applyDraft(
  base: EstudioDetalle,
  draft: Draft,
): EstudioDetalle {
  return {
    ...base,
    name: draft.name.trim() || base.name,
    zona: draft.zona.trim() || base.zona,
    address: draft.address.trim() || base.address,
    description: draft.description,
    photo: draft.photos[0] ?? draft.photo,
    photos: draft.photos,
    amenidades: draft.amenidades,
    tagsDestacados: draft.tagsDestacados,
    telefono: draft.telefono || undefined,
    whatsapp: draft.whatsapp || null,
    instagramUrl: draft.instagramUrl || null,
    websiteUrl: draft.websiteUrl || null,
    youtubeUrl: draft.youtubeUrl || null,
    tiktokUrl: draft.tiktokUrl || null,
    linksExtra: draft.linksExtra.filter((l) => l.label.trim() && l.url.trim()),
    lat: draft.lat,
    lng: draft.lng,
    horarios: draft.horarios
      .filter((h) => !h.closed)
      .flatMap((h) =>
        h.franjas.map((f) => ({
          dayOfWeek: h.dayOfWeek,
          startTime: f.startTime.slice(0, 5),
          endTime: f.endTime.slice(0, 5),
        })),
      ),
  };
}

type Props = {
  estudio: EstudioDetalle;
  negocio: NegocioDto;
  basePath?: string;
  readOnly?: boolean;
};

export function PanelMiEstudioView({
  estudio,
  negocio,
  basePath = "/panel",
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState(() => draftFromSources(estudio, negocio));
  const [editOpen, setEditOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [addingAmenidad, setAddingAmenidad] = useState(false);
  const [amenidadNombre, setAmenidadNombre] = useState("");
  const [amenidadIconId, setAmenidadIconId] =
    useState<AmenidadIconPresetId | null>(null);
  const [addingLink, setAddingLink] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const preview = useMemo(
    () => (readOnly ? estudio : applyDraft(estudio, draft)),
    [readOnly, estudio, draft],
  );

  const publicHref = `/${estudio.slug}`;

  const toggleDestacado = (a: string) => {
    setDraft((d) => {
      const set = new Set(d.tagsDestacados);
      if (set.has(a)) set.delete(a);
      else set.add(a);
      return { ...d, tagsDestacados: [...set] };
    });
  };

  const resetAmenidadForm = () => {
    setAddingAmenidad(false);
    setAmenidadNombre("");
    setAmenidadIconId(null);
  };

  const resetLinkForm = () => {
    setAddingLink(false);
    setLinkLabel("");
    setLinkUrl("");
  };

  const addExtraLink = () => {
    const label = linkLabel.trim();
    const url = linkUrl.trim();
    if (!label || !url) return;
    if (draft.linksExtra.length >= 8) return;
    setDraft((d) => ({
      ...d,
      linksExtra: [...d.linksExtra, { label, url }],
    }));
    resetLinkForm();
  };

  const addAmenidad = () => {
    const preset = amenidadIconId
      ? AMENIDAD_ICON_PRESETS.find((p) => p.id === amenidadIconId)
      : null;
    const nombre = amenidadNombre.trim() || preset?.label || "";
    if (!nombre) return;
    if (draft.amenidades.some((a) => a.toLowerCase() === nombre.toLowerCase())) {
      resetAmenidadForm();
      return;
    }
    setDraft((d) => ({
      ...d,
      amenidades: [...d.amenidades, nombre],
    }));
    resetAmenidadForm();
  };

  const removeAmenidad = (a: string) => {
    setDraft((d) => ({
      ...d,
      amenidades: d.amenidades.filter((x) => x !== a),
      tagsDestacados: d.tagsDestacados.filter((x) => x !== a),
    }));
  };

  const save = () => {
    if (readOnly) return;
    setError(null);
    setOkMsg(null);
    start(async () => {
      const fd = new FormData();
      fd.set("tenantName", draft.name.trim());
      fd.set("sedeName", draft.sedeName.trim() || draft.name.trim());
      fd.set("zona", draft.zona);
      fd.set("address", draft.address);
      fd.set("description", draft.description);
      fd.set("photoUrl", draft.photos[0] ?? draft.photo);
      fd.set("photos", draft.photos.join(", "));
      fd.set("amenidades", draft.amenidades.join(", "));
      fd.set("tagsDestacados", draft.tagsDestacados.join(", "));
      fd.set("telefono", draft.telefono);
      fd.set("whatsapp", draft.whatsapp);
      fd.set("instagramUrl", draft.instagramUrl);
      fd.set("websiteUrl", draft.websiteUrl);
      fd.set("youtubeUrl", draft.youtubeUrl);
      fd.set("tiktokUrl", draft.tiktokUrl);
      fd.set(
        "linksExtra",
        JSON.stringify(
          draft.linksExtra.filter((l) => l.label.trim() && l.url.trim()),
        ),
      );
      if (draft.lat != null) fd.set("lat", String(draft.lat));
      if (draft.lng != null) fd.set("lng", String(draft.lng));
      // Conservar políticas
      fd.set("holdMinutos", String(negocio.politica?.holdMinutos ?? 5));
      fd.set(
        "cancelacionVentanaHoras",
        String(negocio.politica?.cancelacionVentanaHoras ?? 24),
      );
      fd.set(
        "duracionMinMinutos",
        String(negocio.politica?.duracionMinMinutos ?? 60),
      );
      fd.set(
        "duracionMaxMinutos",
        String(negocio.politica?.duracionMaxMinutos ?? 240),
      );
      fd.set("senaModo", negocio.politica?.senaModo ?? "siempre");
      fd.set("senaTipo", negocio.politica?.senaTipo ?? "porcentaje");
      fd.set("senaValor", negocio.politica?.senaValor ?? "30");
      fd.set(
        "senaDestinoCancelacion",
        negocio.politica?.senaDestinoCancelacion ?? "perder",
      );
      if (negocio.politica?.permiteReprogramar !== false) {
        fd.set("permiteReprogramar", "on");
      }

      const res = await updateNegocioAction(null, fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }

      const horRes = await updateHorariosAction({
        horarios: draft.horarios.flatMap((h) =>
          h.closed
            ? [{ dayOfWeek: h.dayOfWeek, closed: true }]
            : h.franjas.map((f) => ({
                dayOfWeek: h.dayOfWeek,
                closed: false,
                startTime: f.startTime,
                endTime: f.endTime,
              })),
        ),
      });
      if (!horRes.ok) {
        setError(horRes.error);
        return;
      }

      setOkMsg("Ficha guardada.");
      setEditOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-surface">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
        <div className="min-w-0">
          <h1 className="font-display text-xl tracking-tight md:text-2xl">
            Mi estudio
          </h1>
          <p className="text-sm text-muted">
            Así se ve tu página pública. Editá y mirá los cambios al instante.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={publicHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-line bg-surface-2 px-3.5 py-2 text-sm font-semibold text-ink transition hover:border-brand/40"
          >
            Abrir en la web
          </Link>
          <PanelButton
            onClick={() => {
              setError(null);
              setOkMsg(null);
              setDraft(draftFromSources(estudio, negocio));
              resetAmenidadForm();
              resetLinkForm();
              setEditOpen(true);
            }}
          >
            Editar ficha
          </PanelButton>
        </div>
      </div>

      {okMsg ? (
        <p className="shrink-0 bg-brand/10 px-4 py-2 text-sm text-brand">
          {okMsg}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <EstudioDetalleView estudio={preview} chrome="embed" />
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar ficha pública"
        placement="center"
        className="h-[calc(100dvh-0.75rem)] max-h-none w-full sm:h-auto sm:max-h-[min(96vh,960px)] sm:max-w-5xl!"
        bodyClassName="pb-4"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <PanelButton variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </PanelButton>
            <PanelButton disabled={pending || readOnly} onClick={save}>
              {pending ? "Guardando…" : "Guardar y publicar"}
            </PanelButton>
          </div>
        }
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted">
            Los cambios se reflejan en la vista previa al instante. Guardá para
            publicarlos.
          </p>

          <section className="space-y-3">
            <EstudioPhotosUpload
              photos={draft.photos}
              localOnly={readOnly}
              onChange={(photos) =>
                setDraft((d) => ({
                  ...d,
                  photos,
                  photo: photos[0] ?? "",
                }))
              }
            />
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">Identidad</h3>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Nombre del estudio
              </span>
              <input
                value={draft.name}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value }))
                }
                className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Nombre de la sede
              </span>
              <input
                value={draft.sedeName}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, sedeName: e.target.value }))
                }
                className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Descripción
              </span>
              <textarea
                rows={4}
                value={draft.description}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, description: e.target.value }))
                }
                className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
              />
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">Ubicación</h3>
            <p className="text-xs text-muted">
              Escribí calle y número; al elegir la sugerencia completamos barrio,
              mapa y coordenadas.
            </p>
            <AddressPlacesInput
              key="ficha-address"
              defaultValue={draft.address}
              defaultLat={draft.lat}
              defaultLng={draft.lng}
              onChangeAddress={(address) =>
                setDraft((d) =>
                  d.address === address ? d : { ...d, address },
                )
              }
              onResolved={(v) =>
                setDraft((d) => ({
                  ...d,
                  address: v.address,
                  lat: v.lat,
                  lng: v.lng,
                  zona: v.zona?.trim() || d.zona,
                }))
              }
            />
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                Barrio / zona
              </span>
              <input
                value={draft.zona}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, zona: e.target.value }))
                }
                placeholder="Se completa al elegir la dirección"
                className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
              />
              <span className="text-[11px] text-muted">
                Lo sacamos de Google; podés corregirlo si hace falta.
              </span>
            </label>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">Comodidades</h3>
            <p className="text-xs text-muted">
              Tocá una para destacarlas en la web. El icono es el mismo que ve el
              músico.
            </p>
            <div className="flex flex-wrap gap-2">
              {draft.amenidades.map((a) => {
                const on = draft.tagsDestacados.includes(a);
                return (
                  <div
                    key={a}
                    className={`inline-flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-1 text-sm transition ${
                      on
                        ? "border-brand bg-brand/15 text-brand"
                        : "border-line bg-surface-2 text-muted"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDestacado(a)}
                      className="inline-flex items-center gap-1.5 py-0.5 hover:text-ink"
                      title={on ? "Quitar de destacados" : "Destacar en la web"}
                    >
                      <AmenidadIcon name={a} className="shrink-0 opacity-90" />
                      <span>{a}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Quitar ${a}`}
                      onClick={() => removeAmenidad(a)}
                      className="rounded-full px-1.5 py-0.5 text-muted transition hover:bg-paper hover:text-ink"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
              {draft.amenidades.length === 0 ? (
                <span className="text-sm text-muted">Ninguna todavía</span>
              ) : null}
            </div>

            {!addingAmenidad ? (
              <button
                type="button"
                onClick={() => setAddingAmenidad(true)}
                className="inline-flex items-center justify-center rounded-xl border border-dashed border-line px-3.5 py-2 text-sm font-medium text-ink transition hover:border-brand/40 hover:text-brand"
              >
                + Agregar
              </button>
            ) : (
              <div className="space-y-3 rounded-xl border border-line bg-paper p-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">
                    Nombre
                  </span>
                  <input
                    autoFocus
                    value={amenidadNombre}
                    onChange={(e) => setAmenidadNombre(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addAmenidad();
                      }
                      if (e.key === "Escape") resetAmenidadForm();
                    }}
                    placeholder="Ej. WiFi, Sala de espera…"
                    className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-brand/50"
                  />
                </label>
                <div className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Icono{" "}
                    <span className="font-normal normal-case tracking-normal text-muted">
                      (opcional)
                    </span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {AMENIDAD_ICON_PRESETS.map((p) => {
                      const selected = amenidadIconId === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          title={p.label}
                          onClick={() => {
                            setAmenidadIconId((cur) =>
                              cur === p.id ? null : p.id,
                            );
                          }}
                          className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                            selected
                              ? "border-brand bg-brand/15 text-brand"
                              : "border-line bg-surface text-muted hover:text-ink"
                          }`}
                        >
                          <p.Icon />
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PanelButton type="button" onClick={addAmenidad}>
                    Agregar
                  </PanelButton>
                  <PanelButton
                    type="button"
                    variant="ghost"
                    onClick={resetAmenidadForm}
                  >
                    Cancelar
                  </PanelButton>
                </div>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">Contacto</h3>
            <p className="text-xs text-muted">
              Se muestran en la ficha pública para que el músico te escriba o te
              siga.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  Teléfono
                </span>
                <input
                  value={draft.telefono}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, telefono: e.target.value }))
                  }
                  placeholder="11 5555-0000"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  WhatsApp
                </span>
                <input
                  value={draft.whatsapp}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, whatsapp: e.target.value }))
                  }
                  placeholder="54911…"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  Instagram
                </span>
                <input
                  value={draft.instagramUrl}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      instagramUrl: e.target.value,
                    }))
                  }
                  placeholder="https://instagram.com/…"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  Web
                </span>
                <input
                  value={draft.websiteUrl}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, websiteUrl: e.target.value }))
                  }
                  placeholder="https://"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  YouTube
                </span>
                <input
                  value={draft.youtubeUrl}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, youtubeUrl: e.target.value }))
                  }
                  placeholder="https://youtube.com/…"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-xs font-medium uppercase tracking-wide text-muted">
                  TikTok
                </span>
                <input
                  value={draft.tiktokUrl}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, tiktokUrl: e.target.value }))
                  }
                  placeholder="https://tiktok.com/@…"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
                />
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Otros links
              </p>
              {draft.linksExtra.length > 0 ? (
                <ul className="space-y-2">
                  {draft.linksExtra.map((l, i) => (
                    <li
                      key={`${l.label}-${i}`}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-ink">{l.label}</span>
                      <span className="min-w-0 flex-1 truncate text-muted">
                        {l.url}
                      </span>
                      <button
                        type="button"
                        aria-label={`Quitar ${l.label}`}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            linksExtra: d.linksExtra.filter((_, idx) => idx !== i),
                          }))
                        }
                        className="rounded-lg px-2 py-1 text-muted transition hover:bg-surface-2 hover:text-ink"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              {!addingLink ? (
                <button
                  type="button"
                  disabled={draft.linksExtra.length >= 8}
                  onClick={() => setAddingLink(true)}
                  className="inline-flex items-center justify-center rounded-xl border border-dashed border-line px-3.5 py-2 text-sm font-medium text-ink transition hover:border-brand/40 hover:text-brand disabled:opacity-40"
                >
                  + Agregar link
                </button>
              ) : (
                <div className="space-y-3 rounded-xl border border-line bg-paper p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted">
                        Nombre
                      </span>
                      <input
                        autoFocus
                        value={linkLabel}
                        onChange={(e) => setLinkLabel(e.target.value)}
                        placeholder="Spotify, Bandcamp…"
                        className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-brand/50"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted">
                        URL
                      </span>
                      <input
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addExtraLink();
                          }
                          if (e.key === "Escape") resetLinkForm();
                        }}
                        className="rounded-xl border border-line bg-surface px-3 py-2 outline-none focus:border-brand/50"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PanelButton type="button" onClick={addExtraLink}>
                      Agregar
                    </PanelButton>
                    <PanelButton
                      type="button"
                      variant="ghost"
                      onClick={resetLinkForm}
                    >
                      Cancelar
                    </PanelButton>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-ink">
              Horario de atención
            </h3>
            <p className="text-xs text-muted">
              Podés sumar más de una franja por día (ej. 10–14 y 17–23).
            </p>
            <ul className="space-y-2">
              {DIAS_SEMANA.map(({ day, label }, idx) => {
                const row = draft.horarios[idx]!;
                return (
                  <li
                    key={day}
                    className="flex min-h-[3.25rem] flex-wrap items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2"
                  >
                    <label className="flex min-w-30 items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={!row.closed}
                        onChange={(e) => {
                          const open = e.target.checked;
                          setDraft((d) => ({
                            ...d,
                            horarios: d.horarios.map((h) =>
                              h.dayOfWeek === day
                                ? {
                                    ...h,
                                    closed: !open,
                                    franjas:
                                      h.franjas.length > 0
                                        ? h.franjas
                                        : [{ ...FRANJA_DEFAULT }],
                                  }
                                : h,
                            ),
                          }));
                        }}
                      />
                      {label}
                    </label>
                    {row.closed ? (
                      <div className="flex min-h-[2.125rem] min-w-0 flex-1 items-center">
                        <span className="text-sm text-muted">Cerrado</span>
                      </div>
                    ) : (
                      <div className="flex min-h-[2.125rem] min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                        {row.franjas.map((f, fi) => (
                          <div
                            key={fi}
                            className="flex items-center gap-2 text-sm"
                          >
                            <input
                              type="time"
                              value={f.startTime.slice(0, 5)}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDraft((d) => ({
                                  ...d,
                                  horarios: d.horarios.map((h) =>
                                    h.dayOfWeek === day
                                      ? {
                                          ...h,
                                          franjas: h.franjas.map((x, i) =>
                                            i === fi
                                              ? { ...x, startTime: v }
                                              : x,
                                          ),
                                        }
                                      : h,
                                  ),
                                }));
                              }}
                              className="h-[2.125rem] rounded-lg border border-line bg-surface px-2 py-1.5"
                            />
                            <span className="text-muted">a</span>
                            <input
                              type="time"
                              value={f.endTime.slice(0, 5)}
                              onChange={(e) => {
                                const v = e.target.value;
                                setDraft((d) => ({
                                  ...d,
                                  horarios: d.horarios.map((h) =>
                                    h.dayOfWeek === day
                                      ? {
                                          ...h,
                                          franjas: h.franjas.map((x, i) =>
                                            i === fi
                                              ? { ...x, endTime: v }
                                              : x,
                                          ),
                                        }
                                      : h,
                                  ),
                                }));
                              }}
                              className="h-[2.125rem] rounded-lg border border-line bg-surface px-2 py-1.5"
                            />
                            {row.franjas.length > 1 ? (
                              <button
                                type="button"
                                aria-label="Quitar franja"
                                onClick={() =>
                                  setDraft((d) => ({
                                    ...d,
                                    horarios: d.horarios.map((h) =>
                                      h.dayOfWeek === day
                                        ? {
                                            ...h,
                                            franjas: h.franjas.filter(
                                              (_, i) => i !== fi,
                                            ),
                                          }
                                        : h,
                                    ),
                                  }))
                                }
                                className="rounded-lg px-2 py-1 text-muted transition hover:bg-surface-2 hover:text-ink"
                              >
                                ×
                              </button>
                            ) : null}
                          </div>
                        ))}
                        {row.franjas.length < MAX_FRANJAS_DIA ? (
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                horarios: d.horarios.map((h) => {
                                  if (h.dayOfWeek !== day) return h;
                                  const last =
                                    h.franjas[h.franjas.length - 1] ??
                                    FRANJA_DEFAULT;
                                  return {
                                    ...h,
                                    franjas: [
                                      ...h.franjas,
                                      {
                                        startTime: last.endTime,
                                        endTime: "23:00",
                                      },
                                    ],
                                  };
                                }),
                              }))
                            }
                            className="shrink-0 text-xs font-medium text-brand hover:underline"
                          >
                            + Franja
                          </button>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
