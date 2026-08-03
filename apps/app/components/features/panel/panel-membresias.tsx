"use client";

import type { ClienteDto } from "@/app/actions/clientes";
import {
  asignarMembresiaAction,
  createMembresiaPlanAction,
  renovarMembresiaAction,
  setMembresiaEstadoAction,
  updateMembresiaPlanAction,
  type ClienteMembresiaDto,
  type MembresiaPlanDto,
  type MembresiasBundleDto,
} from "@/app/actions/membresias";
import {
  PanelBadge,
  PanelButton,
  PanelEmpty,
  PanelPage,
} from "@/components/features/panel/panel-ui";
import { Modal } from "@/components/ui/modal";
import { formatPrecio } from "@/lib/directorio-data";
import { fechaHoyIso, formatFechaYmd } from "@/lib/fechas";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

type Medio = "efectivo" | "transferencia" | "mercadopago" | "tarjeta";

/** Orden UI Lun→Dom; valor = Date#getDay (0=dom … 6=sáb) */
const DIAS_UI: { value: number; label: string }[] = [
  { value: 1, label: "Lu" },
  { value: 2, label: "Ma" },
  { value: 3, label: "Mi" },
  { value: 4, label: "Ju" },
  { value: 5, label: "Vi" },
  { value: 6, label: "Sa" },
  { value: 0, label: "Do" },
];

function formatHoras(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "—";
  const rounded = Math.round(n * 10) / 10;
  return `${rounded} h`;
}

function formatDiasPreferidos(dias: number[]) {
  if (!dias.length) return "Sin preferencia";
  const set = new Set(dias);
  return DIAS_UI.filter((d) => set.has(d.value))
    .map((d) => d.label)
    .join(" · ");
}

type Props = {
  data: MembresiasBundleDto;
  clientes?: ClienteDto[];
  isDemo?: boolean;
};

export function PanelMembresiasView({
  data,
  clientes = [],
  isDemo = false,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [localPlanes, setLocalPlanes] = useState(data.planes);
  const [localMems, setLocalMems] = useState(data.membresias);

  const planes = isDemo ? localPlanes : data.planes;
  const membresias = isDemo ? localMems : data.membresias;

  const emptyPlanDraft = () => ({
    name: "",
    descripcion: "",
    precioMensual: "",
    horasMensuales: "",
    horasMinSemanales: "",
    diasPreferidos: [] as number[],
    diasPeriodo: "30",
  });

  const [planOpen, setPlanOpen] = useState(false);
  const [planDraft, setPlanDraft] = useState(emptyPlanDraft);

  const [asignarOpen, setAsignarOpen] = useState(false);
  const [q, setQ] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [planId, setPlanId] = useState("");
  const [medio, setMedio] = useState<Medio>("efectivo");

  const [renovarId, setRenovarId] = useState<string | null>(null);
  const [renovarMedio, setRenovarMedio] = useState<Medio>("efectivo");

  const hoy = fechaHoyIso();
  const planesActivos = planes.filter((p) => p.active);

  const clientesFiltrados = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = [...clientes].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es"),
    );
    if (!needle) return list.slice(0, 30);
    return list
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(needle) ||
          (c.email?.toLowerCase().includes(needle) ?? false) ||
          c.telefono.replace(/\s/g, "").includes(needle.replace(/\s/g, "")),
      )
      .slice(0, 30);
  }, [clientes, q]);

  const toggleDia = (dia: number) => {
    setPlanDraft((prev) => {
      const has = prev.diasPreferidos.includes(dia);
      return {
        ...prev,
        diasPreferidos: has
          ? prev.diasPreferidos.filter((d) => d !== dia)
          : [...prev.diasPreferidos, dia].sort((a, b) => a - b),
      };
    });
  };

  const crearPlan = () => {
    const precio = Number(planDraft.precioMensual.replace(",", "."));
    const horas = Number(planDraft.horasMensuales.replace(",", "."));
    const minSem = Number(planDraft.horasMinSemanales.replace(",", ".") || "0");
    const dias = Number(planDraft.diasPeriodo) || 30;
    if (planDraft.name.trim().length < 2) {
      setError("Nombre del abono demasiado corto");
      return;
    }
    if (!(precio >= 0)) {
      setError("Indicá un valor válido");
      return;
    }
    if (!(horas > 0)) {
      setError("Indicá las horas mensuales del abono");
      return;
    }
    if (!(minSem >= 0)) {
      setError("El mínimo semanal no es válido");
      return;
    }
    setError(null);
    start(async () => {
      if (isDemo) {
        const plan: MembresiaPlanDto = {
          id: `demo-plan-${Date.now()}`,
          name: planDraft.name.trim(),
          descripcion: planDraft.descripcion.trim() || null,
          precioMensual: precio,
          creditoMensual: 0,
          horasMensuales: horas,
          horasMinSemanales: minSem,
          diasPreferidos: planDraft.diasPreferidos,
          diasPeriodo: dias,
          active: true,
        };
        setLocalPlanes((prev) => [...prev, plan]);
        setPlanOpen(false);
        setOkMsg(`Abono “${plan.name}” creado.`);
        return;
      }
      const res = await createMembresiaPlanAction({
        name: planDraft.name.trim(),
        descripcion: planDraft.descripcion.trim() || null,
        precioMensual: precio.toFixed(2),
        horasMensuales: horas.toFixed(1),
        horasMinSemanales: minSem.toFixed(1),
        diasPreferidos: planDraft.diasPreferidos,
        diasPeriodo: dias,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPlanOpen(false);
      setOkMsg("Abono creado.");
      router.refresh();
    });
  };

  const asignar = () => {
    if (!clienteId || !planId) {
      setError("Elegí cliente y abono");
      return;
    }
    setError(null);
    start(async () => {
      if (isDemo) {
        const c = clientes.find((x) => x.id === clienteId);
        const p = planes.find((x) => x.id === planId);
        if (!c || !p) return;
        const mem: ClienteMembresiaDto = {
          id: `demo-mem-${Date.now()}`,
          clienteId: c.id,
          planId: p.id,
          estado: "activa",
          vigenteDesde: hoy,
          vigenteHasta: hoy,
          clienteNombre: c.nombre,
          clienteTelefono: c.telefono,
          clienteEmail: c.email,
          creditoFavor: c.creditoFavor,
          planName: p.name,
          precioMensual: p.precioMensual,
          creditoMensual: p.creditoMensual,
          horasMensuales: p.horasMensuales,
          horasMinSemanales: p.horasMinSemanales,
          diasPreferidos: p.diasPreferidos,
          diasPeriodo: p.diasPeriodo,
        };
        setLocalMems((prev) => [mem, ...prev]);
        setAsignarOpen(false);
        setOkMsg(
          `Abono de ${c.nombre}: ${formatHoras(p.horasMensuales)}/mes · ${formatPrecio(p.precioMensual)}.`,
        );
        return;
      }
      const res = await asignarMembresiaAction({
        clienteId,
        planId,
        medioPago: medio,
        cobrarAhora: true,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAsignarOpen(false);
      setOkMsg("Abono asignado y cobrado. Quedó registrado en caja.");
      router.refresh();
    });
  };

  const renovar = () => {
    if (!renovarId) return;
    setError(null);
    start(async () => {
      if (isDemo) {
        setLocalMems((prev) =>
          prev.map((m) =>
            m.id === renovarId
              ? {
                  ...m,
                  vigenteHasta: hoy,
                  estado: "activa",
                }
              : m,
          ),
        );
        setRenovarId(null);
        setOkMsg("Período renovado (demo).");
        return;
      }
      const res = await renovarMembresiaAction({
        membresiaId: renovarId,
        medioPago: renovarMedio,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setRenovarId(null);
      setOkMsg("Período cobrado y vigencia extendida.");
      router.refresh();
    });
  };

  return (
    <PanelPage
      title="Abonos"
      description="Planes de horas mensuales. Enlazá un cliente a un cupo, con mínimo semanal, valor y días preferidos."
      actions={
        <div className="flex flex-wrap gap-2">
          <PanelButton
            variant="ghost"
            onClick={() => {
              setError(null);
              setPlanDraft(emptyPlanDraft());
              setPlanOpen(true);
            }}
          >
            + Nuevo abono
          </PanelButton>
          <PanelButton
            onClick={() => {
              setError(null);
              setQ("");
              setClienteId("");
              setPlanId(planesActivos[0]?.id ?? "");
              setMedio("efectivo");
              setAsignarOpen(true);
            }}
            disabled={planesActivos.length === 0}
          >
            Enlazar cliente
          </PanelButton>
        </div>
      }
    >
      {okMsg ? (
        <p className="mb-4 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-sm text-ink">
          {okMsg}
        </p>
      ) : null}

      <section className="mb-8">
        <h2 className="font-display text-lg tracking-tight">Planes de abono</h2>
        <p className="mt-1 text-sm text-muted">
          Definí horas mensuales, mínimo semanal, valor y preferencia de días.
        </p>
        {planes.length === 0 ? (
          <div className="mt-3">
            <PanelEmpty>
              Creá un abono, por ejemplo: 16 h/mes · mín. 4 h/semana · Lu–Vi ·
              $60.000.
            </PanelEmpty>
          </div>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {planes.map((p) => (
              <li
                key={p.id}
                className="rounded-2xl border border-line bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{p.name}</p>
                    {p.descripcion ? (
                      <p className="mt-0.5 text-xs text-muted">{p.descripcion}</p>
                    ) : null}
                  </div>
                  {p.active ? (
                    <PanelBadge tone="ok">Activo</PanelBadge>
                  ) : (
                    <PanelBadge>Inactivo</PanelBadge>
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-muted">Horas / mes</dt>
                    <dd className="font-semibold text-ink">
                      {formatHoras(p.horasMensuales)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Valor</dt>
                    <dd className="font-semibold text-brand">
                      {formatPrecio(p.precioMensual)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Mín. semanal</dt>
                    <dd className="text-ink">
                      {formatHoras(p.horasMinSemanales)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Período</dt>
                    <dd className="text-ink">{p.diasPeriodo} días</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted">Días preferidos</dt>
                    <dd className="text-ink">
                      {formatDiasPreferidos(p.diasPreferidos ?? [])}
                    </dd>
                  </div>
                </dl>
                {!isDemo ? (
                  <button
                    type="button"
                    className="mt-3 text-xs font-semibold text-muted underline hover:text-ink"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await updateMembresiaPlanAction(p.id, {
                          active: !p.active,
                        });
                        router.refresh();
                      })
                    }
                  >
                    {p.active ? "Desactivar" : "Activar"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-lg tracking-tight">
          Abonos activos
        </h2>
        <p className="mt-1 text-sm text-muted">
          Clientes enlazados a un plan. Al cobrar el período se registra en caja
          y se extiende la vigencia.
        </p>
        {membresias.length === 0 ? (
          <div className="mt-3">
            <PanelEmpty>Todavía no hay clientes con abono.</PanelEmpty>
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {membresias.map((m) => {
              const vencida = m.vigenteHasta < hoy;
              return (
                <li
                  key={m.id}
                  className="rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{m.clienteNombre}</p>
                      <p className="text-xs text-muted">
                        {m.clienteTelefono}
                        {m.clienteEmail ? ` · ${m.clienteEmail}` : ""}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        <span className="text-ink">{m.planName}</span>
                        {" · "}
                        {formatHoras(m.horasMensuales)}/mes
                        {m.horasMinSemanales > 0
                          ? ` · mín. ${formatHoras(m.horasMinSemanales)}/sem`
                          : ""}
                        {" · "}
                        {formatFechaYmd(m.vigenteDesde)} →{" "}
                        {formatFechaYmd(m.vigenteHasta)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatDiasPreferidos(m.diasPreferidos ?? [])}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <PanelBadge
                        tone={
                          m.estado === "activa"
                            ? vencida
                              ? "danger"
                              : "ok"
                            : "neutral"
                        }
                      >
                        {m.estado === "activa" && vencida
                          ? "Vencido"
                          : m.estado === "activa"
                            ? "Activo"
                            : m.estado}
                      </PanelBadge>
                      <span className="text-sm font-semibold tabular-nums text-brand">
                        {formatPrecio(m.precioMensual)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PanelButton
                      type="button"
                      disabled={pending || m.estado === "cancelada"}
                      onClick={() => {
                        setError(null);
                        setRenovarMedio("efectivo");
                        setRenovarId(m.id);
                      }}
                    >
                      Cobrar período
                    </PanelButton>
                    {m.estado !== "cancelada" ? (
                      <button
                        type="button"
                        disabled={pending}
                        className="rounded-xl border border-line px-3 py-2 text-xs text-muted hover:text-ink"
                        onClick={() =>
                          start(async () => {
                            if (isDemo) {
                              setLocalMems((prev) =>
                                prev.map((x) =>
                                  x.id === m.id
                                    ? { ...x, estado: "cancelada" }
                                    : x,
                                ),
                              );
                              return;
                            }
                            await setMembresiaEstadoAction({
                              membresiaId: m.id,
                              estado: "cancelada",
                            });
                            router.refresh();
                          })
                        }
                      >
                        Cancelar
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {error && !planOpen && !asignarOpen && !renovarId ? (
        <p className="mt-4 text-sm text-red-600">{error}</p>
      ) : null}

      <Modal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        title="Nuevo abono"
        placement="center"
        className="sm:max-w-md!"
        footer={
          <div className="flex justify-end gap-2">
            <PanelButton variant="ghost" onClick={() => setPlanOpen(false)}>
              Cancelar
            </PanelButton>
            <PanelButton disabled={pending} onClick={crearPlan}>
              {pending ? "…" : "Crear"}
            </PanelButton>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Field
            label="Nombre"
            value={planDraft.name}
            onChange={(v) => setPlanDraft({ ...planDraft, name: v })}
            placeholder="Abono 16 h"
          />
          <Field
            label="Descripción (opcional)"
            value={planDraft.descripcion}
            onChange={(v) => setPlanDraft({ ...planDraft, descripcion: v })}
            placeholder="Ideal para bandas fijas"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Horas mensuales"
              value={planDraft.horasMensuales}
              onChange={(v) =>
                setPlanDraft({ ...planDraft, horasMensuales: v })
              }
              placeholder="16"
              inputMode="decimal"
            />
            <Field
              label="Mín. horas / semana"
              value={planDraft.horasMinSemanales}
              onChange={(v) =>
                setPlanDraft({ ...planDraft, horasMinSemanales: v })
              }
              placeholder="4"
              inputMode="decimal"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Valor (por período)"
              value={planDraft.precioMensual}
              onChange={(v) => setPlanDraft({ ...planDraft, precioMensual: v })}
              placeholder="60000"
              inputMode="decimal"
            />
            <Field
              label="Días del período"
              value={planDraft.diasPeriodo}
              onChange={(v) => setPlanDraft({ ...planDraft, diasPeriodo: v })}
              placeholder="30"
              inputMode="numeric"
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-muted">
              Días preferidos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_UI.map((d) => {
                const on = planDraft.diasPreferidos.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDia(d.value)}
                    className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      on
                        ? "border-brand bg-brand/10 text-brand"
                        : "border-line bg-paper text-muted hover:border-brand/40 hover:text-ink"
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-xs text-muted">
              Orientativo para agenda; no bloquea otros días.
            </p>
          </div>
          {error && planOpen ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={asignarOpen}
        onClose={() => setAsignarOpen(false)}
        title="Enlazar cliente a un abono"
        placement="center"
        className="sm:max-w-lg!"
        footer={
          <div className="flex justify-end gap-2">
            <PanelButton variant="ghost" onClick={() => setAsignarOpen(false)}>
              Cancelar
            </PanelButton>
            <PanelButton
              disabled={pending || !clienteId || !planId}
              onClick={asignar}
            >
              {pending ? "…" : "Cobrar y activar"}
            </PanelButton>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Se cobra el valor del abono, queda registrado en caja y el cliente
            queda con el cupo de horas del período.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Abono</span>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="rounded-xl border border-line bg-paper px-3 py-2.5"
            >
              <option value="">Elegí un abono</option>
              {planesActivos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatHoras(p.horasMensuales)} ·{" "}
                  {formatPrecio(p.precioMensual)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Buscar cliente</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, email, teléfono…"
              className="rounded-xl border border-line bg-paper px-3 py-2.5"
            />
          </label>
          <ul className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-line bg-paper p-1.5">
            {clientesFiltrados.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setClienteId(c.id)}
                  className={`flex w-full rounded-lg px-3 py-2 text-left text-sm ${
                    clienteId === c.id
                      ? "bg-brand/10 font-medium text-ink"
                      : "hover:bg-surface-2"
                  }`}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {c.nombre}
                    <span className="text-muted">
                      {" "}
                      · {c.telefono}
                      {c.email ? ` · ${c.email}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Medio de pago</span>
            <select
              value={medio}
              onChange={(e) => setMedio(e.target.value as Medio)}
              className="rounded-xl border border-line bg-paper px-3 py-2.5"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </label>
          {error && asignarOpen ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={!!renovarId}
        onClose={() => setRenovarId(null)}
        title="Cobrar período"
        placement="center"
        className="sm:max-w-md!"
        footer={
          <div className="flex justify-end gap-2">
            <PanelButton variant="ghost" onClick={() => setRenovarId(null)}>
              Cancelar
            </PanelButton>
            <PanelButton disabled={pending} onClick={renovar}>
              {pending ? "…" : "Cobrar y renovar"}
            </PanelButton>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            Se cobra el valor del abono y se extiende la vigencia del período.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Medio de pago</span>
            <select
              value={renovarMedio}
              onChange={(e) => setRenovarMedio(e.target.value as Medio)}
              className="rounded-xl border border-line bg-paper px-3 py-2.5"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="mercadopago">Mercado Pago</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </label>
          {error && renovarId ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
        </div>
      </Modal>
    </PanelPage>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
      />
    </label>
  );
}
