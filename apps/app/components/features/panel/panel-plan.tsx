"use client";

import {
  checkoutPlanAction,
  type SuscripcionDto,
} from "@/app/actions/suscripcion";
import {
  PanelBadge,
  PanelButton,
  PanelPage,
} from "@/components/features/panel/panel-ui";
import { formatPrecio } from "@/lib/directorio-data";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

function statusLabel(status: string) {
  switch (status) {
    case "trialing":
      return "Prueba";
    case "active":
      return "Activa";
    case "past_due":
      return "Pago pendiente";
    case "expired":
      return "Vencida";
    case "canceled":
      return "Cancelada";
    case "exempt":
      return "Exenta";
    default:
      return status;
  }
}

function statusTone(status: string) {
  switch (status) {
    case "active":
    case "exempt":
      return "ok" as const;
    case "trialing":
      return "brand" as const;
    case "past_due":
      return "warn" as const;
    case "expired":
    case "canceled":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function formatFecha(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

type Props = {
  data: SuscripcionDto;
  flash?: { ok?: boolean; fail?: boolean };
};

export function PanelPlanView({ data, flash }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <PanelPage
      title="Plan SalaYa"
      description="Suscripción a la plataforma (cobro a SalaYa). Las señas de los músicos van a tu Mercado Pago."
    >
      {flash?.ok ? (
        <p className="mb-4 text-sm text-brand">Pago recibido. Plan actualizado.</p>
      ) : null}
      {flash?.fail ? (
        <p className="mb-4 text-sm text-red-600">
          El pago no se completó. Podés intentar de nuevo.
        </p>
      ) : null}
      {!data.canAccessPanel ? (
        <div className="mb-6 rounded-2xl border border-brand/40 bg-brand/10 px-4 py-4">
          <p className="font-medium text-ink">Panel bloqueado</p>
          <p className="mt-1 text-sm text-muted">
            {data.blockedReason ??
              "Elegí un plan para seguir usando SalaYa."}
          </p>
        </div>
      ) : null}

      <section className="mb-8 rounded-2xl border border-line bg-surface p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg tracking-tight">Estado actual</h2>
          <PanelBadge tone={statusTone(data.status)}>
            {statusLabel(data.status)}
          </PanelBadge>
          {data.mock ? <PanelBadge tone="warn">Mock</PanelBadge> : null}
        </div>
        <p className="mt-2 text-sm text-ink">
          Plan <span className="font-semibold">{data.planName}</span>
          {data.priceArs > 0 ? ` · ${formatPrecio(data.priceArs)}/mes` : " · gratis"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {data.status === "trialing" && data.trialEndsAt
            ? `Prueba hasta ${formatFecha(data.trialEndsAt)}`
            : data.periodEnd
              ? `Vigente hasta ${formatFecha(data.periodEnd)}`
              : "Sin período de cobro activo"}
        </p>
      </section>

      <section>
        <h2 className="font-display text-lg tracking-tight">Planes</h2>
        <p className="mt-1 text-sm text-muted">
          Catálogo extensible — podés sumar planes sin tocar la UI.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {data.plans.map((p) => (
            <li
              key={p.code}
              className={`flex flex-col rounded-2xl border p-4 ${
                p.current
                  ? "border-brand/50 bg-brand/5"
                  : "border-line bg-surface"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-ink">{p.name}</h3>
                {p.current ? <PanelBadge tone="ok">Actual</PanelBadge> : null}
              </div>
              <p className="mt-2 font-display text-2xl tracking-tight text-brand">
                {p.priceArs === 0 ? "Gratis" : formatPrecio(p.priceArs)}
              </p>
              <p className="text-xs text-muted">
                {p.periodDays} días · directorio {p.directorioPlan}
              </p>
              <div className="mt-4 flex-1" />
              <PanelButton
                disabled={pending || (p.current && data.status === "active")}
                onClick={() =>
                  start(async () => {
                    setError(null);
                    const res = await checkoutPlanAction(p.code);
                    if (!res.ok) {
                      setError(res.error);
                      return;
                    }
                    if (res.free) {
                      router.refresh();
                      return;
                    }
                    window.location.href = res.initPoint;
                  })
                }
              >
                {p.priceArs === 0
                  ? p.current && data.status === "active"
                    ? "Activo"
                    : "Activar"
                  : p.current && data.status === "active"
                    ? "Renovar"
                    : "Contratar"}
              </PanelButton>
            </li>
          ))}
        </ul>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        {!data.mpPlatformConfigured ? (
          <p className="mt-3 text-sm text-muted">
            Cobro de planes pagos requiere MP_ACCESS_TOKEN de plataforma (o
            MP_MOCK).
          </p>
        ) : null}
      </section>
    </PanelPage>
  );
}
