"use client";

import { BrandLogo } from "@/components/layouts/brand-logo";
import { formatPrecio } from "@/lib/directorio-data";
import { apiBaseUrl } from "@/lib/holds-api";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";

type Preview = {
  alreadyCancelled: boolean;
  permitida: boolean;
  error?: string | null;
  politicaTexto: string;
  destinoTexto: string;
  disclaimer: string;
  reserva: {
    id: string;
    codigo: string;
    salaNombre: string;
    estudioNombre: string | null;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    senaPagada: boolean;
    senaMonto: number;
  };
};

function CancelarInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("t") ?? "";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    destinoSena: string;
    alreadyCancelled?: boolean;
  } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!token) {
      setLoadError("Link inválido o incompleto.");
      return;
    }
    let cancelled = false;
    void fetch(
      `${apiBaseUrl()}/public/reservas/cancel?t=${encodeURIComponent(token)}`,
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data?.error?.message ?? "No se pudo cargar la reserva",
          );
        }
        if (!cancelled) setPreview(data as Preview);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function confirmar() {
    start(async () => {
      const res = await fetch(`${apiBaseUrl()}/public/reservas/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data?.error?.message ?? "No se pudo cancelar");
        return;
      }
      setDone({
        destinoSena: data.destinoSena,
        alreadyCancelled: data.alreadyCancelled,
      });
      router.refresh();
    });
  }

  return (
      <div className="mx-auto w-full max-w-lg px-4 py-10">
      <BrandLogo />

      <h1 className="mt-8 font-display text-2xl tracking-tight text-ink">
        Cancelar reserva
      </h1>

      {loadError ? (
        <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {loadError}
        </p>
      ) : null}

      {!preview && !loadError ? (
        <p className="mt-4 text-sm text-muted">Cargando…</p>
      ) : null}

      {done && preview ? (
        <div className="mt-6 space-y-3 rounded-2xl border border-line bg-surface p-5">
          <p className="font-medium text-brand">
            {done.alreadyCancelled
              ? "Esta reserva ya estaba cancelada."
              : "Reserva cancelada."}
          </p>
          <p className="text-sm text-muted">
            {preview.reserva.codigo} · {preview.reserva.salaNombre} ·{" "}
            {preview.reserva.fecha} {preview.reserva.horaInicio}–
            {preview.reserva.horaFin}
          </p>
          {done.destinoSena !== "n/a" ? (
            <p className="text-sm text-ink">
              Sobre la seña: {preview.destinoTexto}.
            </p>
          ) : null}
          <p className="text-xs text-muted">{preview.disclaimer}</p>
          <Link href="/" className="inline-block text-sm text-brand underline">
            Volver al inicio
          </Link>
        </div>
      ) : null}

      {preview && !done ? (
        <div className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-5">
          <div>
            <p className="text-lg font-medium text-ink">
              {preview.reserva.salaNombre}
            </p>
            {preview.reserva.estudioNombre ? (
              <p className="text-sm text-muted">{preview.reserva.estudioNombre}</p>
            ) : null}
            <p className="mt-1 text-sm text-ink">
              {preview.reserva.fecha} · {preview.reserva.horaInicio}–
              {preview.reserva.horaFin}
            </p>
            <p className="mt-1 text-xs text-muted">{preview.reserva.codigo}</p>
          </div>

          {preview.reserva.senaPagada ? (
            <p className="text-sm text-ink">
              Seña pagada:{" "}
              <span className="font-semibold">
                {formatPrecio(preview.reserva.senaMonto)}
              </span>
            </p>
          ) : null}

          <div className="rounded-xl border border-line bg-paper/60 px-3 py-3 text-sm">
            <p className="font-medium text-ink">Política del estudio</p>
            <p className="mt-1 text-muted">{preview.politicaTexto}</p>
            {preview.permitida && !preview.alreadyCancelled ? (
              <p className="mt-2 text-ink">
                Si confirmás: {preview.destinoTexto}.
              </p>
            ) : null}
            {preview.error ? (
              <p className="mt-2 text-amber-200">{preview.error}</p>
            ) : null}
            {preview.alreadyCancelled ? (
              <p className="mt-2 text-brand">Ya estaba cancelada.</p>
            ) : null}
          </div>

          <p className="text-xs leading-snug text-muted">{preview.disclaimer}</p>

          {preview.permitida && !preview.alreadyCancelled ? (
            <button
              type="button"
              disabled={pending}
              onClick={confirmar}
              className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {pending ? "Cancelando…" : "Confirmar cancelación"}
            </button>
          ) : (
            <Link
              href="/"
              className="inline-block text-sm font-medium text-brand underline"
            >
              Volver al inicio
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function CancelarPage() {
  return (
    <main className="min-h-full bg-paper text-ink">
      <Suspense
        fallback={
          <p className="p-10 text-center text-sm text-muted">Cargando…</p>
        }
      >
        <CancelarInner />
      </Suspense>
    </main>
  );
}
