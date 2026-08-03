"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Gancho suave después del primer favorito */
export function FavoritosHint({
  justAdded,
  loggedIn,
}: {
  justAdded: boolean;
  loggedIn?: boolean;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!justAdded || loggedIn) return;
    const seen = sessionStorage.getItem("salas:fav-hint");
    if (seen) return;
    sessionStorage.setItem("salas:fav-hint", "1");
    setShow(true);
  }, [justAdded, loggedIn]);

  if (!show) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-40 w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-line bg-surface p-4 shadow-xl md:bottom-8">
      <p className="text-sm text-ink">
        Guardado en este dispositivo.{" "}
        <Link
          href="/login?callbackUrl=/favoritos"
          className="font-semibold text-brand underline"
        >
          Entrá
        </Link>{" "}
        para sincronizar y compartir tu lista.
      </p>
      <button
        type="button"
        className="mt-2 text-xs text-muted underline"
        onClick={() => setShow(false)}
      >
        Entendido
      </button>
    </div>
  );
}
