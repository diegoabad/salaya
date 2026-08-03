"use client";

import { Modal } from "@/components/ui/modal";
import { formatPrecio } from "@/lib/directorio-data";
import type { EstudioSala } from "@/lib/estudio-detalle-data";
import {
  confirmHold,
  checkoutHold,
  fetchAdicionalesPublicos,
  putHold,
  type AdicionalPublicoGrupo,
} from "@/lib/holds-api";
import {
  POLITICA_DEFAULTS,
  SALAYA_CANCEL_DISCLAIMER,
  textoPoliticaCancelacion,
} from "@repo/shared";
import { useEffect, useMemo, useState } from "react";

export type DemoPoliticaSena = {
  senaModo: "nunca" | "siempre" | "reincidentes";
  senaTipo: "porcentaje" | "fijo";
  senaValor: string;
  holdMinutos: number;
  cancelacionVentanaHoras?: number;
  senaDestinoCancelacion?: "devolver" | "credito" | "perder";
};

type Mode = "invitado" | "cuenta";
type Step = "datos" | "pago" | "ok";

type Props = {
  open: boolean;
  onClose: () => void;
  sala: EstudioSala;
  fecha: string;
  fechaLabel: string;
  horas: string[];
  rangos: string[];
  /** Precio de sala (sin extras); se suma con adicionales sincronizados */
  totalSala: number;
  holdExpiresAt: number | null;
  politica: DemoPoliticaSena;
  onHoldExpired: () => void;
  onConfirmed?: () => void;
  onTotalChange?: (total: number) => void;
};

function formatCountdown(ms: number) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function calcularSena(total: number, politica: DemoPoliticaSena): number {
  if (politica.senaModo === "nunca") return 0;
  if (politica.senaTipo === "fijo") {
    return Math.round(Number.parseFloat(politica.senaValor));
  }
  return Math.round((total * Number.parseFloat(politica.senaValor)) / 100);
}

function precioLinea(
  item: AdicionalPublicoGrupo["items"][number],
  cantidad: number,
  horas: number,
): number {
  if (item.modalidad === "por_hora") {
    return Math.round(item.precioBase * horas * cantidad);
  }
  return Math.round(item.precioBase * cantidad);
}

export function ReservaCheckoutModal({
  open,
  onClose,
  sala,
  fecha,
  fechaLabel,
  horas,
  rangos,
  totalSala,
  holdExpiresAt,
  politica,
  onHoldExpired,
  onConfirmed,
  onTotalChange,
}: Props) {
  const [step, setStep] = useState<Step>("datos");
  const [mode, setMode] = useState<Mode>("invitado");
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [tick, setTick] = useState(() => Date.now());
  const [grupos, setGrupos] = useState<AdicionalPublicoGrupo[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [syncingExtras, setSyncingExtras] = useState(false);
  const [holdTotal, setHoldTotal] = useState<number | null>(null);

  const extrasLocal = useMemo(() => {
    let sum = 0;
    for (const g of grupos) {
      for (const item of g.items) {
        const n = qty[item.id] ?? 0;
        if (n > 0) sum += precioLinea(item, n, horas.length);
      }
    }
    return sum;
  }, [grupos, qty, horas.length]);

  const total = holdTotal ?? totalSala + extrasLocal;
  const senaMonto = useMemo(
    () => calcularSena(total, politica),
    [total, politica],
  );
  const requiereSena = senaMonto > 0;
  const aPagar = requiereSena ? senaMonto : total;
  const holdLeft = holdExpiresAt ? holdExpiresAt - tick : 0;

  useEffect(() => {
    onTotalChange?.(total);
  }, [total, onTotalChange]);

  useEffect(() => {
    if (!open) return;
    setStep("datos");
    setMode("invitado");
    setError(null);
    setPaying(false);
    setPassword("");
    setQty({});
    setHoldTotal(null);
    setGrupos([]);
    let cancelled = false;
    void fetchAdicionalesPublicos(sala.id)
      .then((data) => {
        if (!cancelled) setGrupos(data.grupos);
      })
      .catch(() => {
        if (!cancelled) setGrupos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sala.id]);

  useEffect(() => {
    if (!open || !holdExpiresAt) return;
    const id = window.setInterval(() => {
      const now = Date.now();
      setTick(now);
      if (now >= holdExpiresAt) onHoldExpired();
    }, 250);
    return () => window.clearInterval(id);
  }, [open, holdExpiresAt, onHoldExpired]);

  // Sync adicionales → hold (congela precio para seña/MP)
  useEffect(() => {
    if (!open || horas.length === 0) return;
    const adicionales = Object.entries(qty)
      .filter(([, n]) => n > 0)
      .map(([id, cantidad]) => ({ id, cantidad }));
    const t = window.setTimeout(() => {
      void (async () => {
        setSyncingExtras(true);
        setError(null);
        try {
          const hold = await putHold(sala.id, {
            fecha,
            horas,
            adicionales,
          });
          if (hold.precioTotal != null) setHoldTotal(Math.round(hold.precioTotal));
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "No se pudieron guardar los extras",
          );
        } finally {
          setSyncingExtras(false);
        }
      })();
    }, 400);
    return () => window.clearTimeout(t);
  }, [open, sala.id, fecha, horas, qty]);

  const title =
    step === "ok"
      ? "Reserva confirmada"
      : step === "pago"
        ? requiereSena
          ? "Pagar seña"
          : "Pagar reserva"
        : "Completá tu reserva";

  const setItemQty = (id: string, next: number, stock: number | null) => {
    const max = stock == null ? 99 : stock;
    const n = Math.max(0, Math.min(max, next));
    setQty((prev) => {
      const copy = { ...prev };
      if (n <= 0) delete copy[id];
      else copy[id] = n;
      return copy;
    });
  };

  const validarDatos = () => {
    setError(null);
    if (mode === "invitado") {
      if (!nombre.trim() || nombre.trim().length < 2) {
        setError("Ingresá tu nombre.");
        return false;
      }
      if (!telefono.trim() || telefono.replace(/\D/g, "").length < 8) {
        setError("Ingresá un teléfono válido.");
        return false;
      }
      if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError("Ingresá un email válido.");
        return false;
      }
      return true;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Ingresá tu email.");
      return false;
    }
    if (!password || password.length < 4) {
      setError("Ingresá tu contraseña.");
      return false;
    }
    if (!telefono.trim() || telefono.replace(/\D/g, "").length < 8) {
      setError("Ingresá un teléfono válido (identidad de reserva).");
      return false;
    }
    if (!nombre.trim()) setNombre(email.split("@")[0] ?? "Cliente");
    return true;
  };

  const irAPagar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validarDatos()) return;
    if (syncingExtras) {
      setError("Esperá un segundo: estamos guardando los extras…");
      return;
    }
    setStep("pago");
  };

  const simularPago = async () => {
    setPaying(true);
    setError(null);
    try {
      const nombreOk = nombre.trim() || email.split("@")[0] || "Cliente";
      const telOk = telefono.trim();
      if (requiereSena || aPagar > 0) {
        const checkout = await checkoutHold({
          salaId: sala.id,
          clienteNombre: nombreOk,
          clienteTelefono: telOk,
          clienteEmail: email.trim(),
        });
        window.location.href = checkout.initPoint;
        return;
      }
      const result = await confirmHold({
        salaId: sala.id,
        clienteNombre: nombreOk,
        clienteTelefono: telOk,
        clienteEmail: email.trim(),
        pagoOk: true,
      });
      setCodigo(result.codigo);
      setStep("ok");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar");
    } finally {
      setPaying(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {holdExpiresAt && step !== "ok" && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2.5">
          <p className="text-xs text-muted sm:text-sm">
            Horarios bloqueados para vos
          </p>
          <p className="font-mono text-base font-semibold tabular-nums text-brand">
            {formatCountdown(holdLeft)}
          </p>
        </div>
      )}

      {step === "datos" && (
        <form onSubmit={irAPagar} className="flex flex-col gap-4">
          <div className="rounded-xl border border-line bg-paper/50 px-3 py-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-ink">{sala.name}</p>
                <p className="mt-1 capitalize text-muted">{fechaLabel}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5">
                  <span className="text-lg font-semibold leading-tight text-brand sm:text-xl">
                    {formatPrecio(total)}
                  </span>
                  <span className="text-xs text-muted sm:text-sm">
                    {horas.length}h · {rangos.join(", ")}
                  </span>
                </p>
                {extrasLocal > 0 && (
                  <p className="mt-0.5 text-xs text-muted">
                    Sala {formatPrecio(totalSala)} + extras{" "}
                    {formatPrecio(extrasLocal)}
                  </p>
                )}
                {requiereSena ? (
                  <p className="mt-1 text-xs text-muted sm:text-sm">
                    Seña{" "}
                    <span className="font-semibold text-ink">
                      {formatPrecio(senaMonto)}
                    </span>
                    <span>
                      {" "}
                      ({politica.senaValor}
                      {politica.senaTipo === "porcentaje" ? "%" : ""})
                    </span>
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted sm:text-sm">Sin seña</p>
                )}
              </div>
            </div>
            <div className="mt-3 border-t border-line pt-3 text-xs text-muted sm:text-sm">
              <p className="font-medium text-ink">Cancelación</p>
              <p className="mt-1">
                {textoPoliticaCancelacion({
                  cancelacionVentanaHoras:
                    politica.cancelacionVentanaHoras ??
                    POLITICA_DEFAULTS.cancelacionVentanaHoras,
                  senaDestinoCancelacion:
                    politica.senaDestinoCancelacion ??
                    POLITICA_DEFAULTS.senaDestinoCancelacion,
                  requiereSena,
                })}
              </p>
              <p className="mt-2 text-[11px] leading-snug text-muted/90 sm:text-xs">
                {SALAYA_CANCEL_DISCLAIMER}
              </p>
            </div>
          </div>

          {grupos.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-ink">Adicionales</p>
              {grupos.map((g) => (
                <div key={g.id} className="rounded-xl border border-line bg-paper/40 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {g.name}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {g.items.map((item) => {
                      const n = qty[item.id] ?? 0;
                      const line = precioLinea(item, Math.max(n, 1), horas.length);
                      return (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-ink">{item.name}</p>
                            <p className="text-xs text-muted">
                              {formatPrecio(item.precioBase)}
                              {item.modalidad === "por_hora" ? "/h" : ""}
                              {item.stock != null ? ` · stock ${item.stock}` : ""}
                              {n > 0 ? ` · ${formatPrecio(precioLinea(item, n, horas.length))}` : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              aria-label={`Menos ${item.name}`}
                              disabled={n <= 0}
                              onClick={() =>
                                setItemQty(item.id, n - 1, item.stock)
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink hover:bg-surface-2 disabled:opacity-30"
                            >
                              −
                            </button>
                            <span className="w-6 text-center tabular-nums font-medium">
                              {n}
                            </span>
                            <button
                              type="button"
                              aria-label={`Más ${item.name}`}
                              disabled={item.stock != null && n >= item.stock}
                              onClick={() =>
                                setItemQty(item.id, n + 1, item.stock)
                              }
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink hover:bg-surface-2 disabled:opacity-30"
                            >
                              +
                            </button>
                          </div>
                          <span className="sr-only">
                            {formatPrecio(line)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {syncingExtras && (
                <p className="text-xs text-muted">Actualizando total…</p>
              )}
            </div>
          )}

          <div className="flex rounded-xl border border-line bg-paper p-1">
            <button
              type="button"
              onClick={() => {
                setMode("invitado");
                setError(null);
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === "invitado"
                  ? "bg-brand text-paper"
                  : "text-muted hover:text-ink"
              }`}
            >
              Datos
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("cuenta");
                setError(null);
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === "cuenta"
                  ? "bg-brand text-paper"
                  : "text-muted hover:text-ink"
              }`}
            >
              Iniciar sesión
            </button>
          </div>

          {mode === "invitado" ? (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-muted">Nombre</span>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  autoComplete="name"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-ink outline-none ring-brand/40 focus:ring-2"
                  placeholder="Tu nombre"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-muted">Teléfono</span>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  type="tel"
                  autoComplete="tel"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-ink outline-none ring-brand/40 focus:ring-2"
                  placeholder="11 2345 6789"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-muted">Email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-ink outline-none ring-brand/40 focus:ring-2"
                  placeholder="vos@email.com"
                />
              </label>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted">
                Si ya tenés cuenta de músico, entrá para completar más rápido.
              </p>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-muted">Email</span>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-ink outline-none ring-brand/40 focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-muted">Contraseña</span>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-ink outline-none ring-brand/40 focus:ring-2"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-muted">Teléfono</span>
                <input
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  type="tel"
                  autoComplete="tel"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 text-ink outline-none ring-brand/40 focus:ring-2"
                  placeholder="11 2345 6789"
                />
              </label>
            </div>
          )}

          {error && (
            <p
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="rounded-xl bg-brand px-4 py-3.5 text-sm font-semibold leading-[1.4] text-paper transition hover:bg-brand-deep"
          >
            {requiereSena
              ? `Ir a pagar seña · ${formatPrecio(senaMonto)}`
              : `Ir a pagar · ${formatPrecio(total)}`}
          </button>
        </form>
      )}

      {step === "pago" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-line bg-paper/50 px-3 py-3 text-sm">
            <p className="text-muted">
              {requiereSena ? "Seña a pagar" : "Total a pagar"}
            </p>
            <p className="mt-1 text-2xl font-semibold text-brand">
              {formatPrecio(aPagar)}
            </p>
            {requiereSena && (
              <p className="mt-1 text-xs text-muted">
                Resta {formatPrecio(total - senaMonto)} en el estudio
              </p>
            )}
            <p className="mt-2 text-muted">
              {mode === "invitado" ? nombre : email} · {fechaLabel} ·{" "}
              {rangos.join(", ")}
            </p>
          </div>

          <p className="text-sm text-muted">
            Te llevamos a Mercado Pago para pagar
            {requiereSena ? " la seña" : ""}. El horario queda bloqueado hasta
            que se acredite.
          </p>

          {error && (
            <p
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
              role="alert"
            >
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={paying}
            onClick={simularPago}
            className="rounded-xl bg-[#009ee3] px-4 py-3.5 text-sm font-semibold leading-[1.4] text-white transition hover:bg-[#0088c6] disabled:opacity-60"
          >
            {paying ? "Procesando pago…" : "Pagar con Mercado Pago"}
          </button>
          <button
            type="button"
            disabled={paying}
            onClick={() => setStep("datos")}
            className="text-sm text-muted hover:text-ink"
          >
            ← Volver a datos
          </button>
        </div>
      )}

      {step === "ok" && (
        <div className="flex flex-col gap-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/20 text-2xl text-brand">
            ✓
          </div>
          <div>
            <p className="text-sm text-muted">Código de reserva</p>
            <p className="mt-1 font-mono text-xl font-semibold text-ink">
              {codigo}
            </p>
          </div>
          <p className="text-sm text-muted">
            {requiereSena
              ? `Seña pagada. Te esperamos el ${fechaLabel} · ${rangos.join(", ")}.`
              : `Reserva confirmada para ${fechaLabel} · ${rangos.join(", ")}.`}
          </p>
          <p className="text-xs text-muted">
            Enviamos el comprobante a {email || "tu email"}.
          </p>
          <button
            type="button"
            onClick={() => {
              onConfirmed?.();
              onClose();
            }}
            className="rounded-xl bg-brand px-4 py-3.5 text-sm font-semibold leading-[1.4] text-paper transition hover:bg-brand-deep"
          >
            Listo
          </button>
        </div>
      )}
    </Modal>
  );
}
