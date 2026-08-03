"use client";

import {
  searchSalaByNombreAction,
  type DirectorioNombreHit,
} from "@/app/actions/directorio-search";
import { registerAction, type ActionResult } from "@/app/actions/auth";
import { GuiaReclamarModal } from "@/components/features/directorio/guia-reclamar-modal";
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { Field } from "./auth-form";

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerAction as (
      prev: ActionResult | null,
      formData: FormData,
    ) => Promise<ActionResult>,
    null,
  );
  const [businessName, setBusinessName] = useState("");
  const [hits, setHits] = useState<DirectorioNombreHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [claimTarget, setClaimTarget] = useState<DirectorioNombreHit | null>(
    null,
  );
  const requestId = useRef(0);
  const listId = useId();

  useEffect(() => {
    const q = businessName.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }

    const id = ++requestId.current;
    setSearching(true);
    const t = window.setTimeout(() => {
      void searchSalaByNombreAction(q).then((rows) => {
        if (requestId.current !== id) return;
        setHits(rows);
        setSearching(false);
      });
    }, 280);

    return () => window.clearTimeout(t);
  }, [businessName]);

  const visibleHits = hits.filter((h) => !dismissedIds.has(h.id));

  return (
    <>
      <form action={formAction} className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-1.5 text-sm">
          <label htmlFor={`${listId}-name`} className="font-medium text-muted">
            Nombre de la sala
          </label>
          <input
            id={`${listId}-name`}
            name="businessName"
            required
            value={businessName}
            onChange={(e) => {
              setBusinessName(e.target.value);
              setDismissedIds(new Set());
            }}
            placeholder="Ej. Sala Norte"
            autoComplete="organization"
            className="rounded-xl border border-line bg-surface px-3 py-2.5 text-ink outline-none ring-brand/40 placeholder:text-muted/60 focus:ring-2"
          />

          {searching ? (
            <p className="text-xs text-muted">Buscando en el directorio…</p>
          ) : null}

          {visibleHits.length > 0 ? (
            <ul
              className="mt-1 space-y-2"
              aria-label="Salas encontradas en el directorio"
            >
              {visibleHits.map((hit) => (
                <li
                  key={hit.id}
                  className="rounded-xl border border-line bg-surface-2/80 p-3"
                >
                  <div className="flex gap-3">
                    {hit.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hit.photo}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg bg-surface object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface text-xs text-muted">
                        Sala
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{hit.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {[hit.address || hit.zona].filter(Boolean).join(" · ")}
                      </p>
                      {!hit.claimable ? (
                        <p className="mt-1 text-xs text-brand">
                          Ya tiene dueño en SalaYa.{" "}
                          <Link
                            href="/login?callbackUrl=/panel"
                            className="underline"
                          >
                            Entrar al panel
                          </Link>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-muted">
                          ¿Es esta tu sala?
                        </p>
                      )}
                    </div>
                  </div>

                  {hit.claimable ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setClaimTarget(hit)}
                        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-paper"
                      >
                        Sí, es esta
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDismissedIds((prev) => new Set(prev).add(hit.id))
                        }
                        className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:text-ink"
                      >
                        No, es otra
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedIds((prev) => new Set(prev).add(hit.id))
                      }
                      className="mt-3 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted hover:text-ink"
                    >
                      Cerrar
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <Field label="Tu nombre" name="name" required autoComplete="name" />
        <Field
          label="Email"
          name="email"
          type="email"
          required
          autoComplete="email"
        />
        <Field
          label="Contraseña"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Mínimo 8 caracteres"
        />

        {state && !state.ok ? (
          <p
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-brand-deep disabled:opacity-60"
        >
          {pending ? "Esperá…" : "Crear cuenta"}
        </button>

        <p className="text-center text-xs text-muted">
          Si tu sala ya está en el directorio, elegí{" "}
          <span className="text-ink">Sí, es esta</span> para reclamarla.
        </p>
      </form>

      {claimTarget ? (
        <GuiaReclamarModal
          open
          onClose={() => setClaimTarget(null)}
          directorioEntradaId={claimTarget.id}
          estudioName={claimTarget.name}
        />
      ) : null}
    </>
  );
}
