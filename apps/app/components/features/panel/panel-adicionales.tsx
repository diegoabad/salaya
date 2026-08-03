"use client";

import {
  createAdicionalAction,
  createGrupoAction,
  deleteAdicionalAction,
  updateAdicionalAction,
  type AdicionalDto,
  type AdicionalGrupoDto,
} from "@/app/actions/adicionales";
import {
  deleteAdicionalPhotoAction,
  uploadAdicionalPhotoAction,
} from "@/app/actions/uploads";
import {
  PanelBadge,
  PanelButton,
  PanelEmpty,
  PanelPage,
} from "@/components/features/panel/panel-ui";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { formatPrecio } from "@/lib/directorio-data";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

type Props = {
  adicionales: AdicionalDto[];
  grupos?: AdicionalGrupoDto[];
  readOnly?: boolean;
};

type Draft = {
  id?: string;
  name: string;
  grupoName: string;
  precioBase: string;
  modalidad: "por_hora" | "por_reserva";
  stock: string;
  caracteristicas: string[];
  photoUrl: string | null;
};

function emptyDraft(grupoName = "General"): Draft {
  return {
    name: "",
    grupoName,
    precioBase: "",
    modalidad: "por_reserva",
    stock: "",
    caracteristicas: [],
    photoUrl: null,
  };
}

export function PanelAdicionalesView({
  adicionales,
  grupos: gruposProp = [],
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [grupoOpen, setGrupoOpen] = useState(false);
  const [grupoName, setGrupoName] = useState("");
  const [chipInput, setChipInput] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AdicionalDto | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  const clearPhotoDraft = () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
    setPendingFile(null);
  };

  const gruposNombres = useMemo(() => {
    const fromProp = gruposProp.map((g) => g.name);
    const fromItems = adicionales.map((i) => i.grupo);
    return [...new Set([...fromProp, ...fromItems])].sort((a, b) =>
      a.localeCompare(b, "es"),
    );
  }, [gruposProp, adicionales]);

  const byGrupo = useMemo(() => {
    const map = new Map<string, AdicionalDto[]>();
    for (const name of gruposNombres) map.set(name, []);
    for (const item of adicionales) {
      const list = map.get(item.grupo) ?? [];
      list.push(item);
      map.set(item.grupo, list);
    }
    // Incluir grupos vacíos creados
    for (const g of gruposProp) {
      if (!map.has(g.name)) map.set(g.name, []);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "es"));
  }, [adicionales, gruposNombres, gruposProp]);

  const closeDraft = () => {
    setDraft(null);
    setChipInput("");
    setError(null);
    clearPhotoDraft();
  };

  const addChip = () => {
    if (!draft) return;
    const t = chipInput.trim();
    if (!t) return;
    if (draft.caracteristicas.includes(t)) {
      setChipInput("");
      return;
    }
    if (draft.caracteristicas.length >= 20) return;
    setDraft({ ...draft, caracteristicas: [...draft.caracteristicas, t] });
    setChipInput("");
  };

  const saveDraft = () => {
    if (!draft || readOnly) return;
    const precioNum = Number(draft.precioBase.replace(",", "."));
    if (Number.isNaN(precioNum) || precioNum < 0) {
      setError("Precio inválido");
      return;
    }
    if (draft.name.trim().length < 2) {
      setError("Nombre demasiado corto");
      return;
    }
    const stockRaw = draft.stock.trim();
    const stock =
      stockRaw === ""
        ? null
        : Number.isFinite(Number(stockRaw))
          ? Math.max(0, Math.floor(Number(stockRaw)))
          : null;

    start(async () => {
      if (draft.id) {
        const res = await updateAdicionalAction(draft.id, {
          name: draft.name.trim(),
          grupoName: draft.grupoName.trim() || "General",
          precioBase: precioNum.toFixed(2),
          modalidad: draft.modalidad,
          stock,
          caracteristicas: draft.caracteristicas,
          photoUrl: draft.photoUrl,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (pendingFile) {
          const fd = new FormData();
          fd.append("file", pendingFile);
          const up = await uploadAdicionalPhotoAction(draft.id, fd);
          if (!up.ok) {
            setError(up.error);
            return;
          }
        }
      } else {
        const res = await createAdicionalAction({
          name: draft.name.trim(),
          grupoName: draft.grupoName.trim() || "General",
          precioBase: precioNum.toFixed(2),
          modalidad: draft.modalidad,
          stock,
          caracteristicas: draft.caracteristicas,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (pendingFile) {
          const fd = new FormData();
          fd.append("file", pendingFile);
          const up = await uploadAdicionalPhotoAction(res.id, fd);
          if (!up.ok) {
            setError(up.error);
            return;
          }
        }
      }
      closeDraft();
      router.refresh();
    });
  };

  return (
    <PanelPage
      title="Adicionales"
      description="Extras que el músico suma al reservar. Organizalos en grupos y agregá características."
      actions={
        !readOnly ? (
          <div className="flex flex-wrap gap-2">
            <PanelButton
              variant="ghost"
              onClick={() => {
                setGrupoName("");
                setError(null);
                setGrupoOpen(true);
              }}
            >
              + Grupo
            </PanelButton>
            <PanelButton
              onClick={() => {
                setError(null);
                clearPhotoDraft();
                setDraft(emptyDraft(gruposNombres[0] ?? "General"));
              }}
            >
              + Adicional
            </PanelButton>
          </div>
        ) : null
      }
    >
      {byGrupo.length === 0 ? (
        <PanelEmpty>
          Creá un grupo (Backline, Bebidas…) y después sumá adicionales.
        </PanelEmpty>
      ) : (
        <div className="space-y-8">
          {byGrupo.map(([grupo, items]) => (
            <section key={grupo}>
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h2 className="font-display text-lg tracking-tight">{grupo}</h2>
                {!readOnly ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand underline"
                    onClick={() => {
                      setError(null);
                      clearPhotoDraft();
                      setDraft(emptyDraft(grupo));
                    }}
                  >
                    + En este grupo
                  </button>
                ) : null}
              </div>
              {items.length === 0 ? (
                <p className="mt-2 text-sm text-muted">
                  Grupo vacío — agregá el primer adicional.
                </p>
              ) : (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="overflow-hidden rounded-2xl border border-line bg-surface"
                    >
                      <div className="flex gap-3 p-3 sm:p-4">
                        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2 sm:h-24 sm:w-24">
                          {item.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.photoUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] text-muted">
                              Sin foto
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-medium text-ink">
                                {item.name}
                              </h3>
                              <p className="mt-0.5 text-xs text-muted">
                                {item.modalidad === "por_hora"
                                  ? "Por hora"
                                  : "Por reserva"}
                                {!item.active ? " · inactivo" : ""}
                              </p>
                            </div>
                            <p className="shrink-0 font-semibold text-brand">
                              {formatPrecio(item.precio)}
                            </p>
                          </div>
                          {(item.caracteristicas?.length ?? 0) > 0 ? (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {item.caracteristicas.map((c) => (
                                <li key={c}>
                                  <span className="inline-flex rounded-md border border-line bg-paper px-2 py-0.5 text-[11px] text-muted">
                                    {c}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          <div className="mt-3 flex items-center justify-between gap-2">
                            {item.stock != null ? (
                              <PanelBadge tone="neutral">
                                Stock {item.stock}
                              </PanelBadge>
                            ) : (
                              <PanelBadge tone="ok">Sin límite</PanelBadge>
                            )}
                            {!readOnly ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="text-xs font-semibold text-brand underline"
                                  onClick={() => {
                                    setError(null);
                                    clearPhotoDraft();
                                    setDraft({
                                      id: item.id,
                                      name: item.name,
                                      grupoName: item.grupo,
                                      precioBase: String(item.precio),
                                      modalidad:
                                        item.modalidad === "por_hora"
                                          ? "por_hora"
                                          : "por_reserva",
                                      stock:
                                        item.stock != null
                                          ? String(item.stock)
                                          : "",
                                      caracteristicas: [
                                        ...(item.caracteristicas ?? []),
                                      ],
                                      photoUrl: item.photoUrl,
                                    });
                                  }}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="text-xs text-muted hover:text-red-600"
                                  onClick={() => setDeleteTarget(item)}
                                >
                                  Eliminar
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      {error && !draft && !grupoOpen ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar adicional"
        description={
          deleteTarget
            ? `Se va a eliminar “${deleteTarget.name}”. Los músicos ya no lo van a ver en el checkout.`
            : undefined
        }
        confirmLabel="Eliminar"
        danger
        pending={pending}
        onConfirm={() => {
          if (!deleteTarget) return;
          start(async () => {
            const res = await deleteAdicionalAction(deleteTarget.id);
            if (!res.ok) {
              setError(res.error);
              setDeleteTarget(null);
              return;
            }
            setDeleteTarget(null);
            router.refresh();
          });
        }}
      />

      <Modal
        open={grupoOpen}
        onClose={() => setGrupoOpen(false)}
        title="Nuevo grupo"
        placement="center"
        className="sm:max-w-md!"
        footer={
          <div className="flex justify-end gap-2">
            <PanelButton variant="ghost" onClick={() => setGrupoOpen(false)}>
              Cancelar
            </PanelButton>
            <PanelButton
              disabled={pending || grupoName.trim().length < 2}
              onClick={() => {
                start(async () => {
                  const res = await createGrupoAction({
                    name: grupoName.trim(),
                  });
                  if (!res.ok) {
                    setError(res.error);
                    return;
                  }
                  setGrupoOpen(false);
                  router.refresh();
                });
              }}
            >
              {pending ? "Guardando…" : "Crear grupo"}
            </PanelButton>
          </div>
        }
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted">Nombre del grupo</span>
          <input
            autoFocus
            value={grupoName}
            onChange={(e) => setGrupoName(e.target.value)}
            placeholder="Backline, Bebidas, Servicios…"
            className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
          />
        </label>
        {error && grupoOpen ? (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(draft)}
        onClose={closeDraft}
        title={draft?.id ? "Editar adicional" : "Nuevo adicional"}
        placement="center"
        className="sm:max-w-lg!"
        footer={
          <div className="flex justify-end gap-2">
            <PanelButton variant="ghost" onClick={closeDraft}>
              Cancelar
            </PanelButton>
            <PanelButton disabled={pending} onClick={saveDraft}>
              {pending ? "Guardando…" : draft?.id ? "Guardar" : "Crear"}
            </PanelButton>
          </div>
        }
      >
        {draft ? (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Nombre</span>
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Micrófono SM58"
                className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
              />
            </label>

            <div>
              <p className="text-sm font-medium text-muted">Foto</p>
              <p className="mt-0.5 text-xs text-muted">
                Se ve en agenda, caja y al reservar.
              </p>
              <div className="mt-2 flex flex-wrap items-start gap-3">
                <div className="h-24 w-24 overflow-hidden rounded-xl border border-line bg-surface-2">
                  {localPreview || draft.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={localPreview ?? draft.photoUrl ?? ""}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[10px] text-muted">
                      Sin foto
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    disabled={pending}
                    className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-brand/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      if (localPreview) URL.revokeObjectURL(localPreview);
                      setLocalPreview(URL.createObjectURL(file));
                      setPendingFile(file);
                    }}
                  />
                  {localPreview || draft.photoUrl ? (
                    <button
                      type="button"
                      disabled={pending}
                      className="text-xs text-muted hover:text-red-600"
                      onClick={() => {
                        start(async () => {
                          if (draft.id && draft.photoUrl && !pendingFile) {
                            const res = await deleteAdicionalPhotoAction(
                              draft.id,
                            );
                            if (!res.ok) {
                              setError(res.error);
                              return;
                            }
                          }
                          clearPhotoDraft();
                          setDraft({ ...draft, photoUrl: null });
                        });
                      }}
                    >
                      Quitar foto
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">Grupo</span>
              <input
                value={draft.grupoName}
                onChange={(e) =>
                  setDraft({ ...draft, grupoName: e.target.value })
                }
                list="grupos-adicionales"
                placeholder="General"
                className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
              />
              <datalist id="grupos-adicionales">
                {gruposNombres.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Precio</span>
                <input
                  inputMode="decimal"
                  value={draft.precioBase}
                  onChange={(e) =>
                    setDraft({ ...draft, precioBase: e.target.value })
                  }
                  placeholder="2500"
                  className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-muted">Modalidad</span>
                <select
                  value={draft.modalidad}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      modalidad: e.target.value as Draft["modalidad"],
                    })
                  }
                  className="rounded-xl border border-line bg-paper px-3 py-2.5"
                >
                  <option value="por_reserva">Por reserva</option>
                  <option value="por_hora">Por hora</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-muted">
                Stock (vacío = sin límite)
              </span>
              <input
                inputMode="numeric"
                value={draft.stock}
                onChange={(e) => setDraft({ ...draft, stock: e.target.value })}
                placeholder="—"
                className="rounded-xl border border-line bg-paper px-3 py-2.5 outline-none focus:border-brand/50"
              />
            </label>

            <div>
              <p className="text-sm font-medium text-muted">Características</p>
              <p className="mt-0.5 text-xs text-muted">
                Ej. XLR, inalámbrico, incluye pie…
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {draft.caracteristicas.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        caracteristicas: draft.caracteristicas.filter(
                          (x) => x !== c,
                        ),
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-line bg-paper px-2 py-1 text-xs text-ink hover:border-red-400/50"
                  >
                    {c}
                    <span className="text-muted">×</span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={chipInput}
                  onChange={(e) => setChipInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addChip();
                    }
                  }}
                  placeholder="Agregar…"
                  className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-brand/50"
                />
                <PanelButton variant="ghost" onClick={addChip}>
                  Sumar
                </PanelButton>
              </div>
            </div>

            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </PanelPage>
  );
}
