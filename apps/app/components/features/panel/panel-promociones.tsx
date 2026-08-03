"use client";

import {
  createReglaAction,
  deleteReglaAction,
  updateReglaAction,
  type PreciosBundleDto,
  type ReglaPrecioDto,
} from "@/app/actions/precios";
import {
  PanelBadge,
  PanelButton,
  PanelEmpty,
  PanelPage,
} from "@/components/features/panel/panel-ui";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { FilterSelect } from "@/components/ui/filter-select";
import { Modal } from "@/components/ui/modal";
import { formatPrecio } from "@/lib/directorio-data";
import { fechaHoyIso } from "@/lib/fechas";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Props = { data: PreciosBundleDto; readOnly?: boolean };

type Draft = {
  id?: string;
  nombre: string;
  startTime: string;
  endTime: string;
  fechaDesde: string;
  fechaHasta: string;
  modoPrecio: "fijo" | "porcentaje";
  precioPorHora: string;
  descuentoPorcentaje: string;
};

function emptyPromoDraft(): Draft {
  return {
    nombre: "Flash",
    startTime: "",
    endTime: "",
    fechaDesde: fechaHoyIso(),
    fechaHasta: fechaHoyIso(),
    modoPrecio: "porcentaje",
    precioPorHora: "",
    descuentoPorcentaje: "25",
  };
}

function reglaToDraft(r: ReglaPrecioDto): Draft {
  return {
    id: r.id,
    nombre: r.nombre || "Promo",
    startTime: r.startTime?.slice(0, 5) ?? "",
    endTime: r.endTime?.slice(0, 5) ?? "",
    fechaDesde: r.fechaDesde?.slice(0, 10) ?? fechaHoyIso(),
    fechaHasta: r.fechaHasta?.slice(0, 10) ?? fechaHoyIso(),
    modoPrecio: r.descuentoPorcentaje != null ? "porcentaje" : "fijo",
    precioPorHora: String(r.precioPorHora),
    descuentoPorcentaje:
      r.descuentoPorcentaje != null ? String(r.descuentoPorcentaje) : "20",
  };
}

function franjaLabel(r: ReglaPrecioDto) {
  if (r.startTime && r.endTime) {
    return `${r.startTime.slice(0, 5)}–${r.endTime.slice(0, 5)}`;
  }
  return "Todo el día";
}

export function PanelPromocionesView({ data, readOnly = false }: Props) {
  const router = useRouter();
  const [salaId, setSalaId] = useState(data.salas[0]?.id ?? "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localReglas, setLocalReglas] = useState<ReglaPrecioDto[]>([]);
  const [hiddenReglaIds, setHiddenReglaIds] = useState<string[]>([]);
  const [deleteRegla, setDeleteRegla] = useState<ReglaPrecioDto | null>(null);

  const salas = data.salas;
  const reglas = useMemo(() => {
    const hidden = new Set(hiddenReglaIds);
    return [
      ...data.reglas.filter((r) => !hidden.has(r.id)),
      ...localReglas,
    ];
  }, [data.reglas, localReglas, hiddenReglaIds]);

  const sala = salas.find((s) => s.id === salaId) ?? null;
  const base = sala?.precioHora ?? 0;

  const salaOptions = useMemo(
    () => salas.map((s) => ({ value: s.id, label: s.name })),
    [salas],
  );

  const puntuales = useMemo(
    () =>
      reglas.filter(
        (r) =>
          r.scope === "sala" &&
          r.scopeId === salaId &&
          r.tipo === "puntual",
      ),
    [reglas, salaId],
  );

  const openCreatePromo = () => {
    setError(null);
    setDraft(emptyPromoDraft());
  };

  const openEdit = (r: ReglaPrecioDto) => {
    setError(null);
    setDraft(reglaToDraft(r));
  };

  const closeDraft = () => {
    setDraft(null);
    setError(null);
  };

  const saveDraft = () => {
    if (!draft || !salaId || readOnly) return;
    setError(null);

    const startTime = draft.startTime || null;
    const endTime = draft.endTime || null;
    if ((startTime && !endTime) || (!startTime && endTime)) {
      setError("Completá desde y hasta, o dejá ambos vacíos (todo el día).");
      return;
    }
    if (startTime && endTime && startTime >= endTime) {
      setError("El fin debe ser después del inicio.");
      return;
    }
    if (!draft.fechaDesde || !draft.fechaHasta) {
      setError("Las promos por fechas necesitan desde y hasta.");
      return;
    }

    let precioPorHora: string;
    let descuentoPorcentaje: string | null = null;

    if (draft.modoPrecio === "porcentaje") {
      const pct = Number(draft.descuentoPorcentaje.replace(",", "."));
      if (!(pct >= 0) || pct > 100 || Number.isNaN(pct)) {
        setError("% de descuento inválido");
        return;
      }
      const precio = Math.max(0, base * (1 - pct / 100));
      precioPorHora = precio.toFixed(2);
      descuentoPorcentaje = pct.toFixed(2);
    } else {
      const n = Number(draft.precioPorHora.replace(",", "."));
      if (!(n >= 0) || Number.isNaN(n)) {
        setError("Precio inválido");
        return;
      }
      precioPorHora = n.toFixed(2);
    }

    start(async () => {
      if (draft.id) {
        const res = await updateReglaAction(draft.id, {
          tipo: "puntual",
          nombre: draft.nombre.trim() || "Promo",
          daysOfWeek: [],
          startTime,
          endTime,
          fechaDesde: draft.fechaDesde,
          fechaHasta: draft.fechaHasta,
          precioPorHora,
          descuentoPorcentaje,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
      } else {
        const res = await createReglaAction({
          scope: "sala",
          scopeId: salaId,
          tipo: "puntual",
          nombre: draft.nombre.trim() || "Promo",
          daysOfWeek: [],
          startTime,
          endTime,
          fechaDesde: draft.fechaDesde,
          fechaHasta: draft.fechaHasta,
          precioPorHora,
          descuentoPorcentaje,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
      }
      closeDraft();
      router.refresh();
    });
  };

  return (
    <PanelPage
      title="Promociones"
      description="Ofertas con vigencia por fechas. Tienen prioridad sobre la semana típica."
      actions={
        salas.length > 0 ? (
          <PanelButton onClick={openCreatePromo}>
            Agregar promoción
          </PanelButton>
        ) : null
      }
    >
      {salas.length === 0 ? (
        <PanelEmpty>
          Creá salas primero para definir promociones.
        </PanelEmpty>
      ) : (
        <div className="space-y-5">
          <div className="w-full sm:max-w-xs">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
              Sala
            </p>
            <FilterSelect
              value={salaId}
              onChange={setSalaId}
              options={salaOptions}
              placeholder="Elegí una sala"
              aria-label="Elegir sala"
            />
          </div>

          <section className="space-y-4">
            {puntuales.length === 0 ? (
              <PanelEmpty>
                Todavía no hay promociones. Creá una con fechas de vigencia.
              </PanelEmpty>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {puntuales.map((r) => {
                  const pct = r.descuentoPorcentaje;
                  return (
                    <li
                      key={r.id}
                      className="relative overflow-hidden rounded-2xl border border-amber-500/35 bg-amber-500/10"
                    >
                      <div className="absolute left-0 top-0 h-full w-1 bg-amber-500" />
                      <div className="flex items-start justify-between gap-3 p-4 pl-5">
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openEdit(r)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-ink">
                              {r.nombre || "Promo"}
                            </p>
                            {!r.active ? (
                              <PanelBadge>Inactiva</PanelBadge>
                            ) : null}
                          </div>
                          <p className="mt-1 text-sm text-muted">
                            {r.fechaDesde}
                            {r.fechaHasta ? ` → ${r.fechaHasta}` : ""}
                            {" · "}
                            {franjaLabel(r)}
                          </p>
                          <div className="mt-3 flex flex-wrap items-end gap-3">
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted">
                                Precio
                              </p>
                              <p className="text-lg font-bold tabular-nums text-ink">
                                {formatPrecio(r.precioPorHora)}
                                <span className="text-sm font-normal text-muted">
                                  /h
                                </span>
                              </p>
                            </div>
                            {pct != null ? (
                              <div className="rounded-lg bg-amber-500/20 px-2.5 py-1.5">
                                <p className="text-[10px] font-medium uppercase tracking-wide text-amber-800">
                                  Descuento
                                </p>
                                <p className="text-base font-bold tabular-nums text-amber-900">
                                  −{pct}%
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-lg bg-amber-500/20 px-2.5 py-1.5">
                                <p className="text-[10px] font-medium uppercase tracking-wide text-amber-800">
                                  Tipo
                                </p>
                                <p className="text-sm font-semibold text-amber-900">
                                  Precio fijo
                                </p>
                              </div>
                            )}
                          </div>
                        </button>
                        <button
                          type="button"
                          className="shrink-0 text-xs text-muted hover:text-red-600"
                          onClick={() => setDeleteRegla(r)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {error && !draft ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}

      <Modal
        open={Boolean(draft)}
        onClose={closeDraft}
        title={draft?.id ? "Editar promoción" : "Nueva promoción"}
        placement="center"
        className="sm:max-w-lg!"
      >
        {draft ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Nombre</span>
              <input
                value={draft.nombre}
                onChange={(e) =>
                  setDraft({ ...draft, nombre: e.target.value })
                }
                className="rounded-xl border border-line bg-paper px-3 py-2.5"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Desde</span>
                <DatePicker
                  tone="paper"
                  value={draft.fechaDesde}
                  onChange={(v) => {
                    setDraft((d) =>
                      d
                        ? {
                            ...d,
                            fechaDesde: v,
                            fechaHasta:
                              v && d.fechaHasta && v > d.fechaHasta
                                ? v
                                : d.fechaHasta,
                          }
                        : d,
                    );
                  }}
                  aria-label="Fecha desde"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Hasta</span>
                <DatePicker
                  tone="paper"
                  min={draft.fechaDesde || undefined}
                  value={draft.fechaHasta}
                  onChange={(v) =>
                    setDraft({ ...draft, fechaHasta: v })
                  }
                  aria-label="Fecha hasta"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Horario desde</span>
                <input
                  type="time"
                  value={draft.startTime}
                  onChange={(e) =>
                    setDraft({ ...draft, startTime: e.target.value })
                  }
                  className="rounded-xl border border-line bg-paper px-3 py-2.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Hasta</span>
                <input
                  type="time"
                  value={draft.endTime}
                  onChange={(e) =>
                    setDraft({ ...draft, endTime: e.target.value })
                  }
                  className="rounded-xl border border-line bg-paper px-3 py-2.5"
                />
              </label>
            </div>
            <p className="text-xs text-muted">
              Vacío = vale todo el día.
            </p>

            <div className="flex overflow-hidden rounded-lg border border-line">
              {(
                [
                  ["porcentaje", "% sobre base"],
                  ["fijo", "Precio fijo"],
                ] as const
              ).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setDraft({ ...draft, modoPrecio: val })}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition ${
                    draft.modoPrecio === val
                      ? "bg-brand text-paper"
                      : "bg-surface text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {draft.modoPrecio === "porcentaje" ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">
                  Descuento % (base {formatPrecio(base)}/h)
                </span>
                <input
                  inputMode="decimal"
                  value={draft.descuentoPorcentaje}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      descuentoPorcentaje: e.target.value,
                    })
                  }
                  className="rounded-xl border border-line bg-paper px-3 py-2.5"
                />
                {(() => {
                  const pct = Number(
                    draft.descuentoPorcentaje.replace(",", "."),
                  );
                  if (!(pct >= 0) || Number.isNaN(pct)) return null;
                  const p = Math.max(0, base * (1 - pct / 100));
                  return (
                    <span className="text-xs text-brand">
                      Queda {formatPrecio(p)}/h
                    </span>
                  );
                })()}
              </label>
            ) : (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Precio / hora</span>
                <input
                  inputMode="decimal"
                  value={draft.precioPorHora}
                  onChange={(e) =>
                    setDraft({ ...draft, precioPorHora: e.target.value })
                  }
                  className="rounded-xl border border-line bg-paper px-3 py-2.5"
                />
              </label>
            )}

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <PanelButton
                disabled={pending || readOnly}
                onClick={saveDraft}
              >
                {pending ? "Guardando…" : draft.id ? "Guardar" : "Crear"}
              </PanelButton>
              {draft.id && !readOnly ? (
                <PanelButton
                  variant="danger"
                  disabled={pending}
                  onClick={() => {
                    const id = draft.id!;
                    const fromList = puntuales.find((x) => x.id === id);
                    closeDraft();
                    setDeleteRegla(
                      fromList ??
                        ({
                          id,
                          nombre: draft.nombre,
                          scope: "sala",
                          scopeId: salaId,
                          scopeLabel: "",
                          tipo: "puntual",
                          daysOfWeek: [],
                          startTime: draft.startTime || null,
                          endTime: draft.endTime || null,
                          fechaDesde: draft.fechaDesde,
                          fechaHasta: draft.fechaHasta,
                          precioPorHora: Number(draft.precioPorHora) || 0,
                          descuentoPorcentaje:
                            draft.modoPrecio === "porcentaje"
                              ? Number(draft.descuentoPorcentaje) || null
                              : null,
                          active: true,
                        } satisfies ReglaPrecioDto),
                    );
                  }}
                >
                  Eliminar
                </PanelButton>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={Boolean(deleteRegla)}
        onClose={() => setDeleteRegla(null)}
        title="Eliminar promoción"
        description={
          deleteRegla
            ? `Se va a eliminar “${deleteRegla.nombre || "Promo"}”. Deja de aplicar en las reservas nuevas.`
            : undefined
        }
        confirmLabel="Eliminar"
        danger
        pending={pending}
        onConfirm={() => {
          if (!deleteRegla) return;
          if (deleteRegla.id.startsWith("local-")) {
            setLocalReglas((prev) =>
              prev.filter((x) => x.id !== deleteRegla.id),
            );
            setDeleteRegla(null);
            return;
          }
          start(async () => {
            if (readOnly) {
              setHiddenReglaIds((ids) => [...ids, deleteRegla.id]);
              setDeleteRegla(null);
              return;
            }
            const res = await deleteReglaAction(deleteRegla.id);
            if (!res.ok) {
              setError(res.error);
              setDeleteRegla(null);
              return;
            }
            setDeleteRegla(null);
            router.refresh();
          });
        }}
      />
    </PanelPage>
  );
}
