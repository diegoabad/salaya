"use client";

import { BrandLogo } from "@/components/layouts/brand-logo";
import { apiBaseUrl } from "@/lib/holds-api";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useTransition } from "react";

type Preview = {
  clienteNombre: string;
  estudioNombre: string;
  estudioSlug: string;
};

function ResenarInner() {
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [done, setDone] = useState<{ estudioSlug: string; estudioNombre: string } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!token) {
      setLoadError("Link inválido o incompleto.");
      return;
    }
    let cancelled = false;
    void fetch(
      `${apiBaseUrl()}/public/resenas/invitar?t=${encodeURIComponent(token)}`,
    )
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data?.error?.message ?? "No se pudo cargar la invitación",
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

  function enviar() {
    setError(null);
    start(async () => {
      const res = await fetch(`${apiBaseUrl()}/public/resenas/invitar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, rating, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error?.message ?? "No se pudo publicar la reseña");
        return;
      }
      setDone({
        estudioSlug: data.estudioSlug,
        estudioNombre: data.estudioNombre,
      });
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 py-8">
      <BrandLogo className="mb-8 self-start" />

      {loadError ? (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h1 className="font-display text-xl text-ink">No disponible</h1>
          <p className="mt-2 text-sm text-muted">{loadError}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-brand underline">
            Ir al inicio
          </Link>
        </div>
      ) : done ? (
        <div className="rounded-2xl border border-brand/30 bg-brand/10 p-5">
          <h1 className="font-display text-xl text-ink">¡Gracias!</h1>
          <p className="mt-2 text-sm text-muted">
            Tu reseña de {done.estudioNombre} ya quedó publicada.
          </p>
          <Link
            href={`/${done.estudioSlug}`}
            className="mt-4 inline-block text-sm font-medium text-brand underline"
          >
            Ver el estudio
          </Link>
        </div>
      ) : !preview ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h1 className="font-display text-xl text-ink">
            ¿Cómo te fue en {preview.estudioNombre}?
          </h1>
          <p className="mt-1 text-sm text-muted">
            Hola {preview.clienteNombre}, contanos tu experiencia.
          </p>

          <div className="mt-5">
            <p className="text-sm font-medium text-muted">Puntaje</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[5, 4, 3, 2, 1].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                    rating === n
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-line bg-paper text-muted hover:text-ink"
                  }`}
                >
                  {n} ★
                </button>
              ))}
            </div>
          </div>

          <label className="mt-4 flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Tu reseña</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Equipos, sonido, atención…"
              className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
            />
          </label>

          {error ? (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="button"
            disabled={pending || body.trim().length < 5}
            onClick={enviar}
            className="mt-5 w-full rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-paper disabled:opacity-50"
          >
            {pending ? "Publicando…" : "Publicar reseña"}
          </button>
        </div>
      )}
    </main>
  );
}

export default function ResenarPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-lg px-4 py-8 text-sm text-muted">
          Cargando…
        </main>
      }
    >
      <ResenarInner />
    </Suspense>
  );
}
