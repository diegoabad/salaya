"use client";

import { BrandLogo } from "@/components/layouts/brand-logo";
import { DatePicker } from "@/components/ui/date-picker";
import { fechaHoyIso } from "@/lib/fechas";
import { apiBaseUrl } from "@/lib/holds-api";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";

type Preview = {
  permitida: boolean;
  error?: string | null;
  reserva: {
    id: string;
    codigo: string;
    salaId: string;
    salaNombre: string;
    estudioNombre: string | null;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    senaPagada: boolean;
    senaMonto: number;
  };
};

function ReprogramarInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("t") ?? "";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [done, setDone] = useState<{
    fecha: string;
    horaInicio: string;
    horaFin: string;
  } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fecha, setFecha] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!token) {
      setLoadError("Link inválido o incompleto.");
      return;
    }
    let cancelled = false;
    void fetch(
      `${apiBaseUrl()}/public/reservas/reprogramar?t=${encodeURIComponent(token)}`,
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data?.error?.message ?? "No se pudo cargar la reserva",
          );
        }
        if (cancelled) return;
        const preview = data as Preview;
        setPreview(preview);
        setFecha(preview.reserva.fecha);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const fecha = String(fd.get("fecha") ?? "");
    const horaInicio = String(fd.get("horaInicio") ?? "");
    const horaFin = String(fd.get("horaFin") ?? "");
    setFormError(null);
    start(async () => {
      const res = await fetch(`${apiBaseUrl()}/public/reservas/reprogramar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          t: token,
          confirm: true,
          fecha,
          horaInicio,
          horaFin,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data?.error?.message ?? "No se pudo reprogramar");
        return;
      }
      setDone({
        fecha: data.fecha,
        horaInicio: data.horaInicio,
        horaFin: data.horaFin,
      });
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10">
      <BrandLogo />

      <h1 className="mt-8 font-display text-2xl tracking-tight text-ink">
        Reprogramar reserva
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
          <p className="font-medium text-brand">Turno actualizado.</p>
          <p className="text-sm text-muted">
            {preview.reserva.codigo} · {preview.reserva.salaNombre}
          </p>
          <p className="text-sm text-ink">
            Nuevo horario: {done.fecha} · {done.horaInicio}–{done.horaFin}
          </p>
          {preview.reserva.senaPagada ? (
            <p className="text-xs text-muted">
              La seña queda asociada a esta misma reserva.
            </p>
          ) : null}
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
              Actual: {preview.reserva.fecha} · {preview.reserva.horaInicio}–
              {preview.reserva.horaFin}
            </p>
            <p className="mt-1 text-xs text-muted">{preview.reserva.codigo}</p>
          </div>

          {!preview.permitida ? (
            <>
              <p className="text-sm text-amber-200">
                {preview.error ?? "No se puede reprogramar esta reserva."}
              </p>
              <Link
                href="/"
                className="inline-block text-sm font-medium text-brand underline"
              >
                Volver al inicio
              </Link>
            </>
          ) : (
            <form className="flex flex-col gap-3" onSubmit={onSubmit}>
              <p className="text-sm text-muted">
                Elegí un nuevo horario. La seña se mantiene en la misma reserva.
              </p>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Nueva fecha</span>
                <DatePicker
                  name="fecha"
                  tone="paper"
                  min={fechaHoyIso()}
                  value={fecha}
                  onChange={setFecha}
                  aria-label="Nueva fecha"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-muted">Desde</span>
                  <input
                    name="horaInicio"
                    required
                    pattern="\d{2}:\d{2}"
                    placeholder="18:00"
                    defaultValue={preview.reserva.horaInicio}
                    className="rounded-xl border border-line bg-paper px-3 py-2.5"
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-muted">Hasta</span>
                  <input
                    name="horaFin"
                    required
                    pattern="\d{2}:\d{2}"
                    placeholder="20:00"
                    defaultValue={preview.reserva.horaFin}
                    className="rounded-xl border border-line bg-paper px-3 py-2.5"
                  />
                </label>
              </div>
              {formError ? (
                <p className="text-sm text-red-200">{formError}</p>
              ) : null}
              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-paper disabled:opacity-60"
              >
                {pending ? "Guardando…" : "Confirmar nuevo horario"}
              </button>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function ReprogramarPage() {
  return (
    <main className="min-h-full bg-paper text-ink">
      <Suspense
        fallback={
          <p className="p-10 text-center text-sm text-muted">Cargando…</p>
        }
      >
        <ReprogramarInner />
      </Suspense>
    </main>
  );
}
