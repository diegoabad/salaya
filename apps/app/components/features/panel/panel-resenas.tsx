"use client";

import type { ClienteDto } from "@/app/actions/clientes";
import {
  invitarResenaAction,
  toggleResenaAction,
  type ResenasBundleDto,
} from "@/app/actions/resenas";
import {
  PanelBadge,
  PanelButton,
  PanelEmpty,
  PanelPage,
} from "@/components/features/panel/panel-ui";
import { Modal } from "@/components/ui/modal";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

function formatFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${iso}T12:00:00`));
}

type Props = {
  data: ResenasBundleDto;
  clientes?: ClienteDto[];
  isDemo?: boolean;
};

export function PanelResenasView({
  data,
  clientes = [],
  isDemo = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [emailEdit, setEmailEdit] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = [...clientes].sort((a, b) =>
      a.nombre.localeCompare(b.nombre, "es"),
    );
    if (!needle) return list.slice(0, 40);
    return list
      .filter(
        (c) =>
          c.nombre.toLowerCase().includes(needle) ||
          (c.email?.toLowerCase().includes(needle) ?? false) ||
          (c.banda?.toLowerCase().includes(needle) ?? false) ||
          c.telefono.replace(/\s/g, "").includes(needle.replace(/\s/g, "")),
      )
      .slice(0, 40);
  }, [clientes, q]);

  const selected = clientes.find((c) => c.id === selectedId) ?? null;

  const openInvite = () => {
    setError(null);
    setOkMsg(null);
    setQ("");
    setSelectedId(null);
    setEmailEdit("");
    setOpen(true);
  };

  const pickCliente = (c: ClienteDto) => {
    setSelectedId(c.id);
    setEmailEdit(c.email ?? "");
    setError(null);
  };

  const enviarInvite = () => {
    if (!selected) {
      setError("Elegí un cliente de la lista.");
      return;
    }
    const email = emailEdit.trim();
    if (!email.includes("@")) {
      setError("Necesitás un email válido para invitar.");
      return;
    }
    setError(null);
    start(async () => {
      if (isDemo) {
        setOkMsg(`Invitación lista para ${selected.nombre} (${email}).`);
        setOpen(false);
        return;
      }
      const res = await invitarResenaAction({
        clienteId: selected.id,
        email,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOkMsg(`Invitación enviada a ${res.clienteNombre} (${res.email}).`);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <PanelPage
      title="Reseñas"
      description="Las publicadas aparecen en la ficha del estudio y abajo de cada sala."
      actions={
        <PanelButton onClick={openInvite}>Invitar a reseñar</PanelButton>
      }
    >
      {okMsg ? (
        <p className="mb-4 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-sm text-ink">
          {okMsg}
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {data.ratingAvg != null && (
          <p className="text-sm">
            Promedio{" "}
            <span className="font-semibold text-brand">
              {data.ratingAvg.toFixed(1)}
            </span>{" "}
            · {data.ratingCount} reseñas publicadas
          </p>
        )}
      </div>

      {data.resenas.length === 0 ? (
        <PanelEmpty>
          Todavía no hay reseñas. Invitá a un cliente para que deje la suya.
        </PanelEmpty>
      ) : (
        <ul className="space-y-3">
          {data.resenas.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-line bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{r.authorName}</p>
                  <p className="text-xs text-muted">
                    {formatFecha(r.publishedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PanelBadge tone="brand">{r.rating} ★</PanelBadge>
                  {r.published ? (
                    <PanelBadge tone="ok">Publicada</PanelBadge>
                  ) : (
                    <PanelBadge>Oculta</PanelBadge>
                  )}
                </div>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink/85">{r.body}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={pending || isDemo}
                  onClick={() =>
                    start(async () => {
                      await toggleResenaAction(r.id, !r.published);
                      router.refresh();
                    })
                  }
                  className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted hover:text-ink disabled:opacity-40"
                >
                  {r.published ? "Ocultar" : "Publicar"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invitar a reseñar"
        placement="center"
        className="sm:max-w-lg!"
        footer={
          <div className="flex justify-end gap-2">
            <PanelButton variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </PanelButton>
            <PanelButton
              disabled={pending || !selected}
              onClick={enviarInvite}
            >
              {pending ? "Enviando…" : "Enviar invitación"}
            </PanelButton>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Buscá un cliente. Le mandamos un mail con el link para dejar la
            reseña.
          </p>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Buscar cliente</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Nombre, email, teléfono…"
              autoFocus
              className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
            />
          </label>

          <ul className="max-h-52 space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-line bg-paper p-1.5">
            {clientes.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-muted">
                No hay clientes cargados todavía.
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-sm text-muted">
                Ningún cliente coincide.
              </li>
            ) : (
              filtered.map((c) => {
                const active = c.id === selectedId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => pickCliente(c)}
                      className={`flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                        active
                          ? "bg-brand/10 text-ink"
                          : "hover:bg-surface-2"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.nombre}</p>
                        <p className="truncate text-xs text-muted">
                          {c.telefono}
                          {c.email ? ` · ${c.email}` : " · sin email"}
                        </p>
                      </div>
                      {active ? (
                        <span className="shrink-0 text-xs font-semibold text-brand">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          {selected ? (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">
                Email de {selected.nombre}
              </span>
              <input
                type="email"
                value={emailEdit}
                onChange={(e) => setEmailEdit(e.target.value)}
                placeholder="nombre@mail.com"
                className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
              />
              {!selected.email ? (
                <span className="text-[11px] text-muted">
                  Este cliente no tenía email: se guardará en su ficha.
                </span>
              ) : null}
            </label>
          ) : null}

          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>
    </PanelPage>
  );
}
