"use client";

import { Modal } from "@/components/ui/modal";
import { apiBaseUrl } from "@/lib/holds-api";
import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  directorioEntradaId: string;
  estudioName: string;
};

export function GuiaReclamarModal({
  open,
  onClose,
  directorioEntradaId,
  estudioName,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const resetAndClose = () => {
    setNombre("");
    setTelefono("");
    setEmail("");
    setError(null);
    setSending(false);
    setDone(false);
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      const res = await fetch(`${apiBaseUrl()}/public/reclamaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directorioEntradaId,
          nombre,
          telefono,
          email,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; error?: { message?: string } }
        | null;
      if (!res.ok) {
        setError(data?.error?.message ?? "No se pudo enviar. Probá de nuevo.");
        return;
      }
      setDone(true);
    } catch {
      setError("No se pudo conectar. Revisá tu conexión e intentá otra vez.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={resetAndClose}
      title="Reclamar sala"
      placement="center"
      className="sm:!max-w-lg"
    >
      {done ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="font-[family-name:var(--font-display)] text-xl tracking-tight text-ink">
            ¡Pedido recibido!
          </p>
          <p className="text-sm text-muted">
            Te vamos a contactar a la brevedad para activar{" "}
            <span className="font-medium text-ink">{estudioName}</span> en
            SalaYa.
          </p>
          <button
            type="button"
            onClick={resetAndClose}
            className="mt-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-paper"
          >
            Listo
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="rounded-xl border border-line bg-surface-2/60 px-4 py-3 text-sm text-muted">
            <p className="leading-snug">
              Al reclamar{" "}
              <span className="font-medium text-ink">{estudioName}</span>{" "}
              pasás de una ficha simple del directorio a tu propia página del
              estudio, con apartados por sala, fotos, comodidades, precios y
              horarios.
            </p>
            <a
              href="/soy-dueno"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-medium text-brand underline-offset-2 hover:underline"
            >
              ¿Querés saber qué incluye?
            </a>
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Tu nombre</span>
            <input
              required
              name="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoComplete="name"
              className="rounded-xl border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-brand"
              placeholder="Nombre y apellido"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Teléfono</span>
            <input
              required
              name="telefono"
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              autoComplete="tel"
              className="rounded-xl border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-brand"
              placeholder="11 1234-5678"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink">Email</span>
            <input
              required
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="rounded-xl border border-line bg-surface px-3 py-2.5 text-ink outline-none focus:border-brand"
              placeholder="tu@email.com"
            />
          </label>

          {error ? (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={sending}
            className="rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-paper disabled:opacity-60"
          >
            {sending ? "Enviando…" : "Quiero reclamar esta sala"}
          </button>

          <p className="text-center text-xs text-muted">
            Te escribimos para verificar que sos el dueño y activar tu cuenta.
          </p>
        </form>
      )}
    </Modal>
  );
}
