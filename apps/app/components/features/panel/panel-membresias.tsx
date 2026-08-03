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

  const [planOpen, setPlanOpen] = useState(false);
  const [planDraft, setPlanDraft] = useState({
    name: "",
    descripcion: "",
    precioMensual: "",
    creditoMensual: "",
    diasPeriodo: "30",
  });

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

  const crearPlan = () => {
    const precio = Number(planDraft.precioMensual.replace(",", "."));
    const credito = Number(planDraft.creditoMensual.replace(",", "."));
    const dias = Number(planDraft.diasPeriodo) || 30;
    if (planDraft.name.trim().length < 2) {
      setError("Nombre del plan demasiado corto");
      return;
    }
    if (!(precio >= 0) || !(credito >= 0)) {
      setError("Precio y crédito deben ser números válidos");
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
          creditoMensual: credito,
          diasPeriodo: dias,
          active: true,
        };
        setLocalPlanes((prev) => [...prev, plan]);
        setPlanOpen(false);
        setOkMsg(`Plan “${plan.name}” creado.`);
        return;
      }
      const res = await createMembresiaPlanAction({
        name: planDraft.name.trim(),
        descripcion: planDraft.descripcion.trim() || null,
        precioMensual: precio.toFixed(2),
        creditoMensual: credito.toFixed(2),
        diasPeriodo: dias,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPlanOpen(false);
      setOkMsg("Plan creado.");
      router.refresh();
    });
  };

  const asignar = () => {
    if (!clienteId || !planId) {
      setError("Elegí cliente y plan");
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
          creditoFavor: c.creditoFavor + p.creditoMensual,
          planName: p.name,
          precioMensual: p.precioMensual,
          creditoMensual: p.creditoMensual,
          diasPeriodo: p.diasPeriodo,
        };
        setLocalMems((prev) => [mem, ...prev]);
        setAsignarOpen(false);
        setOkMsg(
          `Membresía de ${c.nombre}: pagó ${formatPrecio(p.precioMensual)} y recibió ${formatPrecio(p.creditoMensual)} de crédito.`,
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
      setOkMsg("Membresía asignada y cobrada. El crédito quedó en la ficha del cliente.");
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
                  creditoFavor: m.creditoFavor + m.creditoMensual,
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
      setOkMsg("Período cobrado: crédito sumado al cliente.");
      router.refresh();
    });
  };

  return (
    <PanelPage
      title="Membresías"
      description="El cliente paga un monto por período y recibe crédito para ir gastando en turnos."
      actions={
        <div className="flex flex-wrap gap-2">
          <PanelButton
            variant="ghost"
            onClick={() => {
              setError(null);
              setPlanDraft({
                name: "",
                descripcion: "",
                precioMensual: "",
                creditoMensual: "",
                diasPeriodo: "30",
              });
              setPlanOpen(true);
            }}
          >
            + Plan
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
            Asignar membresía
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
        <h2 className="font-display text-lg tracking-tight">Planes</h2>
        <p className="mt-1 text-sm text-muted">
          Definí cuánto pagan y cuánto crédito reciben por mes (o período).
        </p>
        {planes.length === 0 ? (
          <div className="mt-3">
            <PanelEmpty>
              Creá un plan, por ejemplo: paga $40.000 → recibe $50.000 de crédito.
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
                    <dt className="text-xs text-muted">Paga</dt>
                    <dd className="font-semibold text-ink">
                      {formatPrecio(p.precioMensual)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Recibe de crédito</dt>
                    <dd className="font-semibold text-brand">
                      {formatPrecio(p.creditoMensual)}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-xs text-muted">Período</dt>
                    <dd className="text-ink">{p.diasPeriodo} días</dd>
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
          Membresías activas
        </h2>
        <p className="mt-1 text-sm text-muted">
          Al cobrar el período, el crédito se suma al saldo a favor del cliente
          (se gasta en turnos).
        </p>
        {membresias.length === 0 ? (
          <div className="mt-3">
            <PanelEmpty>Todavía no hay membresías asignadas.</PanelEmpty>
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
                        Plan <span className="text-ink">{m.planName}</span>
                        {" · "}
                        {formatFechaYmd(m.vigenteDesde)} →{" "}
                        {formatFechaYmd(m.vigenteHasta)}
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
                          ? "Vencida"
                          : m.estado}
                      </PanelBadge>
                      <span className="text-sm text-muted">
                        Crédito ficha{" "}
                        <span className="font-semibold text-brand">
                          {formatPrecio(m.creditoFavor)}
                        </span>
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
        title="Nuevo plan"
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
            placeholder="Membresía mensuales"
          />
          <Field
            label="Descripción (opcional)"
            value={planDraft.descripcion}
            onChange={(v) => setPlanDraft({ ...planDraft, descripcion: v })}
            placeholder="Ideal para bandas fijas"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Paga (por período)"
              value={planDraft.precioMensual}
              onChange={(v) => setPlanDraft({ ...planDraft, precioMensual: v })}
              placeholder="40000"
              inputMode="decimal"
            />
            <Field
              label="Crédito que recibe"
              value={planDraft.creditoMensual}
              onChange={(v) =>
                setPlanDraft({ ...planDraft, creditoMensual: v })
              }
              placeholder="50000"
              inputMode="decimal"
            />
          </div>
          <Field
            label="Días del período"
            value={planDraft.diasPeriodo}
            onChange={(v) => setPlanDraft({ ...planDraft, diasPeriodo: v })}
            placeholder="30"
            inputMode="numeric"
          />
          {error && planOpen ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={asignarOpen}
        onClose={() => setAsignarOpen(false)}
        title="Asignar membresía"
        placement="center"
        className="sm:max-w-lg!"
        footer={
          <div className="flex justify-end gap-2">
            <PanelButton variant="ghost" onClick={() => setAsignarOpen(false)}>
              Cancelar
            </PanelButton>
            <PanelButton disabled={pending || !clienteId || !planId} onClick={asignar}>
              {pending ? "…" : "Cobrar y activar"}
            </PanelButton>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Se cobra el precio del plan, se suma el crédito a la ficha del
            cliente y queda registrado en caja.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Plan</span>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="rounded-xl border border-line bg-paper px-3 py-2.5"
            >
              <option value="">Elegí un plan</option>
              {planesActivos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · paga {formatPrecio(p.precioMensual)} → crédito{" "}
                  {formatPrecio(p.creditoMensual)}
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
            Se cobra el precio del plan, se suma el crédito mensual al cliente y
            se extiende la vigencia.
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
