"use client";

import {
  createBloqueoAction,
  deleteBloqueoAction,
  type BloqueoDto,
} from "@/app/actions/bloqueos";
import type { SalaDto } from "@/app/actions/salas";
import {
  PanelBadge,
  PanelButton,
  PanelEmpty,
  PanelPage,
} from "@/components/features/panel/panel-ui";
import { DatePicker } from "@/components/ui/date-picker";
import { Modal } from "@/components/ui/modal";
import { fechaHoyIso } from "@/lib/fechas";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = { bloqueos: BloqueoDto[]; salas: SalaDto[] };

export function PanelBloqueosView({ bloqueos, salas }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hoy = fechaHoyIso();
  const [fecha, setFecha] = useState(hoy);

  return (
    <PanelPage
      title="Bloqueos"
      description="Cerrá franjas por mantenimiento o evento privado. El picker público las muestra como ocupadas."
      actions={
        <PanelButton onClick={() => setOpen(true)}>+ Nuevo bloqueo</PanelButton>
      }
    >
      {bloqueos.length === 0 ? (
        <PanelEmpty>
          Sin bloqueos. Creá uno para sacar un horario de la agenda pública.
        </PanelEmpty>
      ) : (
        <ul className="space-y-3">
          {bloqueos.map((b) => (
            <li
              key={b.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium text-ink">
                    {b.fecha} · {b.startTime}–{b.endTime}
                  </h3>
                  <PanelBadge tone={b.scope === "sede" ? "warn" : "neutral"}>
                    {b.scope === "sede"
                      ? "Toda la sede"
                      : b.salaName ?? "Sala"}
                  </PanelBadge>
                </div>
                {b.motivo ? (
                  <p className="mt-1 text-sm text-muted">{b.motivo}</p>
                ) : null}
              </div>
              <PanelButton
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  start(async () => {
                    const res = await deleteBloqueoAction(b.id);
                    if (!res.ok) {
                      setError(res.error);
                      return;
                    }
                    router.refresh();
                  });
                }}
              >
                Quitar
              </PanelButton>
            </li>
          ))}
        </ul>
      )}

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo bloqueo"
        placement="center"
        className="sm:max-w-2xl!"
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const motivo = String(fd.get("motivo") ?? "").trim();
            if (!motivo) {
              setError("El motivo es obligatorio.");
              return;
            }
            setError(null);
            start(async () => {
              const salaRaw = String(fd.get("salaId") ?? "");
              const res = await createBloqueoAction({
                salaId: salaRaw === "" || salaRaw === "sede" ? null : salaRaw,
                fecha: String(fd.get("fecha")),
                startTime: String(fd.get("startTime")),
                endTime: String(fd.get("endTime")),
                motivo,
              });
              if (!res.ok) {
                setError(res.error);
                return;
              }
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Alcance</span>
            <select
              name="salaId"
              className="rounded-xl border border-line bg-paper px-3 py-2.5"
              defaultValue="sede"
            >
              <option value="sede">Toda la sede</option>
              {salas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Fecha</span>
            <DatePicker
              name="fecha"
              tone="paper"
              value={fecha}
              onChange={setFecha}
              aria-label="Fecha del bloqueo"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Desde</span>
              <input
                name="startTime"
                type="time"
                required
                defaultValue="14:00"
                className="rounded-xl border border-line bg-paper px-3 py-2.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Hasta</span>
              <input
                name="endTime"
                type="time"
                required
                defaultValue="16:00"
                className="rounded-xl border border-line bg-paper px-3 py-2.5"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Motivo</span>
            <input
              name="motivo"
              required
              placeholder="Mantenimiento, evento privado…"
              className="rounded-xl border border-line bg-paper px-3 py-2.5"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <PanelButton type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Crear bloqueo"}
          </PanelButton>
        </form>
      </Modal>
    </PanelPage>
  );
}
