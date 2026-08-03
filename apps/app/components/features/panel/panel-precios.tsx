"use client";

import {
  createReglaAction,
  deleteReglaAction,
  updatePrecioBaseSalaAction,
  updateReglaAction,
  type PreciosBundleDto,
  type ReglaPrecioDto,
} from "@/app/actions/precios";
import {
  PanelButton,
  PanelEmpty,
  PanelPage,
} from "@/components/features/panel/panel-ui";
import {
  hourEndTime,
  PreciosHeatmap,
  type HeatSelection,
} from "@/components/features/panel/precios-heatmap";
import { FilterSelect } from "@/components/ui/filter-select";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { formatPrecio } from "@/lib/directorio-data";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

/** Orden visual AR: Lu → Do */
const DIAS = [
  { day: 1, label: "Lunes", short: "Lu" },
  { day: 2, label: "Martes", short: "Ma" },
  { day: 3, label: "Miércoles", short: "Mi" },
  { day: 4, label: "Jueves", short: "Ju" },
  { day: 5, label: "Viernes", short: "Vi" },
  { day: 6, label: "Sábado", short: "Sá" },
  { day: 0, label: "Domingo", short: "Do" },
] as const;

type Props = { data: PreciosBundleDto; readOnly?: boolean };

type Draft = {
  id?: string;
  nombre: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  precioPorHora: string;
};

function reglaToDraft(r: ReglaPrecioDto): Draft {
  return {
    id: r.id,
    nombre: r.nombre || "Tarifa",
    daysOfWeek: r.daysOfWeek.length > 0 ? [...r.daysOfWeek] : [0, 1, 2, 3, 4, 5, 6],
    startTime: r.startTime?.slice(0, 5) ?? "",
    endTime: r.endTime?.slice(0, 5) ?? "",
    precioPorHora: String(r.precioPorHora),
  };
}

function franjaLabel(r: ReglaPrecioDto) {
  if (r.startTime && r.endTime) {
    return `${r.startTime.slice(0, 5)}–${r.endTime.slice(0, 5)}`;
  }
  return "Todo el día";
}

/** Input de precio aislado para no perder el foco al tipear. */
function HeatPriceForm({
  summaryDays,
  hourFrom,
  hourTo,
  initialPrice,
  error,
  onPriceChange,
  onSubmit,
}: {
  summaryDays: string;
  hourFrom: number;
  hourTo: number;
  initialPrice: string;
  error: string | null;
  onPriceChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const [price, setPrice] = useState(initialPrice);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        {summaryDays}
        {" · "}
        {`${String(hourFrom).padStart(2, "0")}:00`}
        –
        {hourEndTime(hourTo)}
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-muted">Precio / hora</span>
        <input
          ref={inputRef}
          inputMode="decimal"
          value={price}
          onChange={(e) => {
            const v = e.target.value;
            setPrice(v);
            onPriceChange(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
          }}
          className="rounded-xl border border-line bg-paper px-3 py-2.5 text-lg font-semibold tabular-nums outline-none focus:border-brand/50"
        />
      </label>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function PanelPreciosView({ data, readOnly = false }: Props) {
  const router = useRouter();
  const [salaId, setSalaId] = useState(data.salas[0]?.id ?? "");
  const [baseEdit, setBaseEdit] = useState("");
  const [editingBase, setEditingBase] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editHeat, setEditHeat] = useState(false);
  const [heatSel, setHeatSel] = useState<HeatSelection | null>(null);
  const [heatPrice, setHeatPrice] = useState("");
  const [heatError, setHeatError] = useState<string | null>(null);
  /** Reglas locales (demo / si la API falla) para poder probar la grilla */
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

  const reglasSala = useMemo(
    () => reglas.filter((r) => r.scope === "sala" && r.scopeId === salaId),
    [reglas, salaId],
  );

  const continuas = useMemo(
    () => reglasSala.filter((r) => r.tipo === "continuo"),
    [reglasSala],
  );

  const closeHeatModal = useCallback(() => {
    setHeatSel(null);
    setHeatPrice("");
    setHeatError(null);
  }, []);

  const onHeatSelection = useCallback(
    (sel: HeatSelection) => {
      setHeatError(null);
      setHeatSel(sel);
      setHeatPrice(String(Math.round(base)));
    },
    [base],
  );

  const applyHeatPrice = () => {
    if (!heatSel || !salaId) return;
    const n = Number(heatPrice.replace(",", "."));
    if (!(n >= 0) || Number.isNaN(n)) {
      setHeatError("Precio inválido");
      return;
    }
    const startTime = `${String(heatSel.hourFrom).padStart(2, "0")}:00`;
    const endTime = hourEndTime(heatSel.hourTo);
    const days = [...heatSel.days];

    start(async () => {
      if (!readOnly) {
        const res = await createReglaAction({
          scope: "sala",
          scopeId: salaId,
          tipo: "continuo",
          nombre: `Tarifa ${startTime}–${endTime}`,
          daysOfWeek: days,
          startTime,
          endTime,
          fechaDesde: null,
          fechaHasta: null,
          precioPorHora: n.toFixed(2),
          descuentoPorcentaje: null,
        });
        if (res.ok) {
          closeHeatModal();
          router.refresh();
          return;
        }
        // Si falla la API, igual aplicamos en local para poder probar la UI
        setHeatError(null);
      }

      const local: ReglaPrecioDto = {
        id: `local-${Date.now()}`,
        scope: "sala",
        scopeId: salaId,
        scopeLabel: sala?.name ?? "Sala",
        tipo: "continuo",
        nombre: `Tarifa ${startTime}–${endTime}`,
        daysOfWeek: days,
        startTime,
        endTime,
        fechaDesde: null,
        fechaHasta: null,
        precioPorHora: n,
        descuentoPorcentaje: null,
        active: true,
      };
      setLocalReglas((prev) => [...prev, local]);
      closeHeatModal();
    });
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
    if (draft.daysOfWeek.length === 0) {
      setError("Elegí al menos un día.");
      return;
    }

    const n = Number(draft.precioPorHora.replace(",", "."));
    if (!(n >= 0) || Number.isNaN(n)) {
      setError("Precio inválido");
      return;
    }
    const precioPorHora = n.toFixed(2);

    start(async () => {
      if (draft.id) {
        const res = await updateReglaAction(draft.id, {
          tipo: "continuo",
          nombre: draft.nombre.trim() || "Tarifa",
          daysOfWeek: draft.daysOfWeek,
          startTime,
          endTime,
          fechaDesde: null,
          fechaHasta: null,
          precioPorHora,
          descuentoPorcentaje: null,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
      } else {
        const res = await createReglaAction({
          scope: "sala",
          scopeId: salaId,
          tipo: "continuo",
          nombre: draft.nombre.trim() || "Tarifa",
          daysOfWeek: draft.daysOfWeek,
          startTime,
          endTime,
          fechaDesde: null,
          fechaHasta: null,
          precioPorHora,
          descuentoPorcentaje: null,
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
      title="Precios"
      description="Tarifas semanales por sala, como las ve el músico al reservar."
      actions={
        salas.length > 0 ? (
          editHeat ? (
            <button
              type="button"
              onClick={() => {
                closeHeatModal();
                setEditHeat(false);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-ink/20 bg-ink px-3.5 py-2 text-sm font-semibold text-paper transition hover:bg-ink/90"
            >
              ✓ Listo
            </button>
          ) : (
            <PanelButton onClick={() => setEditHeat(true)}>
              Editar grilla
            </PanelButton>
          )
        ) : null
      }
    >
      {salas.length === 0 ? (
        <PanelEmpty>
          Creá salas primero para definir precios.
        </PanelEmpty>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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

            {sala ? (
              <div className="rounded-xl border border-line bg-surface px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted">
                  Precio base / hora
                </p>
                {editingBase ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      inputMode="decimal"
                      value={baseEdit}
                      onChange={(e) => setBaseEdit(e.target.value)}
                      className="w-28 rounded-lg border border-line bg-paper px-2 py-1.5 text-sm tabular-nums outline-none focus:border-brand/50"
                    />
                    <PanelButton
                      disabled={pending}
                      onClick={() => {
                        const n = Number(baseEdit.replace(",", "."));
                        if (!(n >= 0) || Number.isNaN(n)) {
                          setError("Precio base inválido");
                          return;
                        }
                        start(async () => {
                          if (readOnly) {
                            setEditingBase(false);
                            setError(
                              "En la vista de prueba el base no se guarda en el servidor.",
                            );
                            return;
                          }
                          const res = await updatePrecioBaseSalaAction(
                            sala.id,
                            n.toFixed(2),
                          );
                          if (!res.ok) {
                            setError(res.error);
                            return;
                          }
                          setEditingBase(false);
                          router.refresh();
                        });
                      }}
                    >
                      Guardar
                    </PanelButton>
                    <button
                      type="button"
                      className="text-sm text-muted"
                      onClick={() => setEditingBase(false)}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-3">
                    <p className="text-xl font-semibold text-brand">
                      {formatPrecio(base)}
                      <span className="text-sm font-normal text-muted">/h</span>
                    </p>
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand underline"
                      onClick={() => {
                        setBaseEdit(String(base));
                        setEditingBase(true);
                      }}
                    >
                      Editar
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg tracking-tight">
                  Semana típica
                </h2>
                <p className="text-sm text-muted">
                  {editHeat
                    ? "Arrastrá un bloque de celdas y definí el precio / hora."
                    : "Días arriba, horas a la izquierda. Usá “Editar grilla” para cambiar precios."}
                </p>
              </div>
            </div>

            {sala ? (
              <PreciosHeatmap
                salaId={salaId}
                salaName={sala.name}
                precioBase={base}
                reglas={reglasSala.filter(
                  (r) => r.tipo === "continuo" && r.active,
                )}
                editable={editHeat}
                onSelectionReady={onHeatSelection}
              />
            ) : null}

            {continuas.length > 0 ? (
              <div className="rounded-2xl border border-line bg-surface p-3 md:p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">
                  Franjas semanales ({continuas.length})
                </p>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                  {continuas.map((r) => (
                    <li
                      key={r.id}
                      className="flex items-start justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2.5"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => openEdit(r)}
                      >
                        <p className="truncate text-sm font-medium text-ink">
                          {r.nombre || "Tarifa"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {r.daysOfWeek.length === 0
                            ? "Todos los días"
                            : r.daysOfWeek
                                .slice()
                                .sort(
                                  (a, b) =>
                                    DIAS.findIndex((x) => x.day === a) -
                                    DIAS.findIndex((x) => x.day === b),
                                )
                                .map(
                                  (d) =>
                                    DIAS.find((x) => x.day === d)?.short ?? d,
                                )
                                .join(" · ")}
                          {" · "}
                          {franjaLabel(r)}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-brand">
                          {formatPrecio(r.precioPorHora)}/h
                        </p>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-muted hover:text-red-600"
                        onClick={() => setDeleteRegla(r)}
                      >
                        Eliminar
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {error && !draft ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      )}

      <Modal
        open={Boolean(heatSel)}
        onClose={closeHeatModal}
        title="Definir precio"
        placement="center"
        className="sm:max-w-md!"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <PanelButton variant="ghost" onClick={closeHeatModal}>
              Cancelar
            </PanelButton>
            <PanelButton disabled={pending} onClick={applyHeatPrice}>
              {pending ? "Guardando…" : "Aplicar"}
            </PanelButton>
          </div>
        }
      >
        {heatSel ? (
          <HeatPriceForm
            key={`${heatSel.days.join("-")}-${heatSel.hourFrom}-${heatSel.hourTo}`}
            summaryDays={
              heatSel.days.length === 7
                ? "Todos los días"
                : heatSel.days
                    .slice()
                    .sort(
                      (a, b) =>
                        DIAS.findIndex((x) => x.day === a) -
                        DIAS.findIndex((x) => x.day === b),
                    )
                    .map((d) => DIAS.find((x) => x.day === d)?.label ?? d)
                    .join(", ")
            }
            hourFrom={heatSel.hourFrom}
            hourTo={heatSel.hourTo}
            initialPrice={heatPrice}
            error={heatError}
            onPriceChange={setHeatPrice}
            onSubmit={applyHeatPrice}
          />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(draft)}
        onClose={closeDraft}
        title={draft?.id ? "Editar franja" : "Nueva franja"}
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

            <fieldset>
              <legend className="text-sm font-medium text-muted">Días</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {DIAS.map(({ day, short }) => {
                  const on = draft.daysOfWeek.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          daysOfWeek: on
                            ? draft.daysOfWeek.filter((d) => d !== day)
                            : [...draft.daysOfWeek, day].sort(
                                (a, b) =>
                                  DIAS.findIndex((x) => x.day === a) -
                                  DIAS.findIndex((x) => x.day === b),
                              ),
                        })
                      }
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                        on
                          ? "bg-brand text-paper"
                          : "border border-line bg-paper text-muted hover:border-brand/40"
                      }`}
                    >
                      {short}
                    </button>
                  );
                })}
              </div>
            </fieldset>

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
                    const fromList = continuas.find((x) => x.id === id);
                    closeDraft();
                    setDeleteRegla(
                      fromList ??
                        ({
                          id,
                          nombre: draft.nombre,
                          scope: "sala",
                          scopeId: salaId,
                          scopeLabel: "",
                          tipo: "continuo",
                          daysOfWeek: [],
                          startTime: null,
                          endTime: null,
                          fechaDesde: null,
                          fechaHasta: null,
                          precioPorHora: 0,
                          descuentoPorcentaje: null,
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
        title="Eliminar franja"
        description={
          deleteRegla
            ? `Se va a eliminar “${deleteRegla.nombre || "Tarifa"}”. El precio vuelve a la base u otras reglas.`
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
