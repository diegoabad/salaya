"use client";

import {
  createSalaAction,
  deleteSalaAction,
  toggleSalaAction,
  updateSalaAction,
  type CreateSalaResult,
  type SalaDto,
} from "@/app/actions/salas";
import {
  PanelBadge,
  PanelButton,
  PanelEmpty,
  PanelPage,
} from "@/components/features/panel/panel-ui";
import { SalaPhotosUpload } from "@/components/features/panel/sala-photos-upload";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { formatPrecio } from "@/lib/directorio-data";
import { SALA_CATEGORIAS } from "@repo/shared";
import Link from "next/link";
import { useActionState, useState } from "react";

type Props = {
  initialSalas: SalaDto[];
  isOwner: boolean;
  basePath?: string;
};

export function PanelSalasView({
  initialSalas,
  isOwner,
  basePath = "/panel",
}: Props) {
  const [salas, setSalas] = useState(initialSalas);
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SalaDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const editing = salas.find((s) => s.id === editingId) ?? null;
  const formOpen = openForm || Boolean(editing);

  const closeForm = () => {
    setOpenForm(false);
    setEditingId(null);
  };

  const [createState, createAction, creating] = useActionState(
    async (_prev: CreateSalaResult | null, fd: FormData) => {
      const result = await createSalaAction(null, fd);
      if (result.ok) {
        setSalas((list) => [...list, result.sala]);
        setOpenForm(false);
        setEditingId(null);
        setMsg(
          result.sala.photos.length > 0
            ? "Sala creada."
            : "Sala creada. Podés editarla para sumar fotos cuando quieras.",
        );
      }
      return result;
    },
    null,
  );

  const [updateState, updateAction, updating] = useActionState(
    async (
      prev: { ok: true } | { ok: false; error: string } | null,
      fd: FormData,
    ) => {
      if (!editingId) return { ok: false, error: "Sin sala" };
      const result = await updateSalaAction(editingId, fd);
      if (result.ok) {
        setMsg("Sala actualizada. Los cambios se ven en la ficha pública.");
        window.location.reload();
      }
      return result;
    },
    null,
  );

  return (
    <PanelPage
      title="Salas"
      description="Cada sala es una ficha en tu web: fotos, precio, medidas, equipo incluido y lo que no trae."
      actions={
        isOwner ? (
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              setOpenForm(true);
              setMsg(null);
            }}
            className="inline-flex items-center justify-center rounded-xl bg-brand px-3.5 py-2 text-sm font-semibold text-paper transition hover:bg-brand-deep"
          >
            + Nueva sala
          </button>
        ) : null
      }
    >
      {msg ? <p className="mb-4 text-sm text-brand">{msg}</p> : null}

      {salas.length === 0 ? (
        <PanelEmpty>
          Todavía no hay salas. Creá la primera: es lo que ven los músicos en
          tu web.
        </PanelEmpty>
      ) : (
        <ul className="space-y-3">
          {salas.map((sala) => {
            const medidas =
              sala.anchoMetros && sala.largoMetros
                ? `${sala.anchoMetros}x${sala.largoMetros}m`.replace(".", ",")
                : null;
            const precio = sala.precioHora
              ? formatPrecio(Number(sala.precioHora))
              : "—";
            return (
              <li
                key={sala.id}
                className={`overflow-hidden rounded-2xl border bg-surface transition ${
                  sala.active ? "border-line" : "border-line opacity-70"
                }`}
              >
                <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4">
                  {sala.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sala.photos[0]}
                      alt=""
                      className="h-24 w-full shrink-0 rounded-xl object-cover sm:h-20 sm:w-32"
                    />
                  ) : (
                    <div className="flex h-24 w-full shrink-0 items-center justify-center rounded-xl bg-surface-2 text-xs text-muted sm:h-20 sm:w-32">
                      Sin foto
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-lg tracking-tight">
                        {sala.name}
                      </h2>
                      <PanelBadge>{sala.categoria}</PanelBadge>
                      {sala.popular && (
                        <PanelBadge tone="warn">Popular</PanelBadge>
                      )}
                      {sala.nueva && <PanelBadge tone="brand">Nueva</PanelBadge>}
                      {!sala.active && <PanelBadge>Oculta</PanelBadge>}
                    </div>
                    <p className="mt-1 text-sm text-muted">
                      {sala.capacity ? `${sala.capacity} pers.` : "Cap. —"}
                      {medidas ? ` · ${medidas}` : ""} · desde{" "}
                      <span className="text-brand">{precio}</span>/h
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {sala.slug ? `/${sala.slug}` : ""}
                      {sala.equipamiento.length
                        ? ` · ${sala.equipamiento.length} ítems equipo`
                        : " · Sin equipamiento"}
                    </p>
                  </div>

                  {isOwner ? (
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={sala.active}
                        title={
                          sala.active
                            ? "Visible en la web"
                            : "Oculta en la web"
                        }
                        onClick={async () => {
                          const next = !sala.active;
                          const r = await toggleSalaAction(sala.id, next);
                          if (r.ok) {
                            setSalas((list) =>
                              list.map((s) =>
                                s.id === sala.id ? { ...s, active: next } : s,
                              ),
                            );
                          } else setMsg(r.error);
                        }}
                        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                          sala.active ? "bg-brand" : "bg-surface-2"
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-paper transition ${
                            sala.active ? "translate-x-5" : ""
                          }`}
                        />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:border-brand/40"
                        onClick={() => {
                          setOpenForm(false);
                          setEditingId(sala.id);
                          setMsg(null);
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-line px-2.5 py-1.5 text-xs text-muted hover:border-red-400/40 hover:text-red-600"
                        onClick={() => setDeleteTarget(sala)}
                      >
                        Eliminar
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-6 text-sm text-muted">
        La ficha del estudio (comodidades, foto de portada) está en{" "}
        <Link href={`${basePath}/mi-estudio`} className="text-brand underline">
          Mi estudio
        </Link>
        .
      </p>

      {isOwner ? (
        <Modal
          open={formOpen}
          onClose={closeForm}
          title={editing ? `Editar: ${editing.name}` : "Nueva sala"}
          placement="center"
          className="max-h-[min(96vh,960px)]! sm:max-w-5xl!"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <PanelButton variant="ghost" onClick={closeForm}>
                Cancelar
              </PanelButton>
              <PanelButton
                type="submit"
                form="sala-form"
                disabled={editing ? updating : creating}
              >
                {editing
                  ? updating
                    ? "Guardando…"
                    : "Guardar ficha"
                  : creating
                    ? "Guardando…"
                    : "Crear sala"}
              </PanelButton>
            </div>
          }
        >
          <SalaForm
            key={editing?.id ?? "new"}
            formId="sala-form"
            mode={editing ? "edit" : "create"}
            sala={editing}
            categoriaSuggestions={Array.from(
              new Set([
                ...SALA_CATEGORIAS,
                ...salas.map((s) => s.categoria).filter(Boolean),
              ]),
            )}
            action={editing ? updateAction : createAction}
            state={
              editing
                ? updateState
                : createState && !createState.ok
                  ? createState
                  : createState?.ok
                    ? { ok: true }
                    : null
            }
          />
        </Modal>
      ) : null}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Eliminar sala"
        description={
          deleteTarget
            ? `Se va a eliminar “${deleteTarget.name}”. Esta acción no se puede deshacer.`
            : undefined
        }
        confirmLabel="Eliminar"
        danger
        pending={deleting}
        onConfirm={() => {
          if (!deleteTarget) return;
          void (async () => {
            setDeleting(true);
            const r = await deleteSalaAction(deleteTarget.id);
            setDeleting(false);
            if (r.ok) {
              setSalas((list) =>
                list.filter((s) => s.id !== deleteTarget.id),
              );
              if (editingId === deleteTarget.id) setEditingId(null);
              setDeleteTarget(null);
            } else {
              setMsg(r.error);
              setDeleteTarget(null);
            }
          })();
        }}
      />
    </PanelPage>
  );
}

function SalaForm({
  formId,
  mode,
  sala,
  categoriaSuggestions,
  action,
  state,
}: {
  formId: string;
  mode: "create" | "edit";
  sala: SalaDto | null;
  categoriaSuggestions: string[];
  action: (payload: FormData) => void;
  state: { ok: true } | { ok: false; error: string } | null;
}) {
  const [name, setName] = useState(sala?.name ?? "");
  const [categoria, setCategoria] = useState(sala?.categoria ?? "Música");
  const [description, setDescription] = useState(sala?.description ?? "");
  const [capacity, setCapacity] = useState(
    sala?.capacity != null ? String(sala.capacity) : "",
  );
  const [ancho, setAncho] = useState(sala?.anchoMetros ?? "");
  const [largo, setLargo] = useState(sala?.largoMetros ?? "");
  const [acustica, setAcustica] = useState(sala?.acustica ?? "");
  const [duracionMax, setDuracionMax] = useState(
    sala?.duracionMaxMinutos != null ? String(sala.duracionMaxMinutos) : "",
  );
  const [tags, setTags] = useState(sala?.tags ?? []);
  const [caracteristicas, setCaracteristicas] = useState(
    sala?.caracteristicas ?? [],
  );
  const [equipamiento, setEquipamiento] = useState(sala?.equipamiento ?? []);
  const [noIncluido, setNoIncluido] = useState(sala?.noIncluido ?? []);
  const [photos, setPhotos] = useState(sala?.photos ?? []);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const previewPrecio = sala?.precioHora
    ? formatPrecio(Number(sala.precioHora))
    : "—";

  const previewMedidas =
    ancho && largo ? `${ancho}x${largo}m`.replace(".", ",") : "—";

  return (
    <form
      id={formId}
      action={(fd) => {
        for (const f of pendingFiles) fd.append("files", f);
        action(fd);
      }}
      className="space-y-5"
    >
      <input type="hidden" name="tags" value={tags.join(", ")} />
      <input
        type="hidden"
        name="caracteristicas"
        value={caracteristicas.join(", ")}
      />
      <input
        type="hidden"
        name="equipamiento"
        value={equipamiento
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ")}
      />
      <input
        type="hidden"
        name="noIncluido"
        value={noIncluido
          .map((s) => s.trim())
          .filter(Boolean)
          .join(", ")}
      />
      <input type="hidden" name="photos" value={photos.join(", ")} />

      <p className="text-sm text-muted">
        Completá lo mismo que se ve en la web pública. El precio se define en
        Precios; la URL se genera sola del nombre.
      </p>

      {/* Vista previa tipo ficha pública */}
      <div className="overflow-hidden rounded-2xl border border-line bg-paper">
        <div className="relative aspect-[21/9] min-h-36 bg-surface-2">
          {photos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photos[0]}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              Sin fotos todavía
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 py-4">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <span className="rounded-full border border-brand/50 bg-brand/20 px-2.5 py-0.5 text-[11px] font-semibold text-brand">
                  {categoria || "Categoría"}
                </span>
                <p className="mt-1 truncate font-display text-xl text-white sm:text-2xl">
                  {name || "Nombre de la sala"}
                </p>
                {description ? (
                  <p className="mt-1 line-clamp-2 text-xs text-white/80 sm:text-sm">
                    {description}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-right text-sm text-white/85">
                Desde{" "}
                <span className="text-xl font-semibold text-brand sm:text-2xl">
                  {previewPrecio}
                </span>
                <span className="text-white/60">/h</span>
              </p>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-line p-3 sm:grid-cols-4">
          {[
            { label: "Dimensiones", value: previewMedidas },
            {
              label: "Capacidad",
              value: capacity ? `${capacity} pers.` : "—",
            },
            { label: "Acústica", value: acustica || "—" },
            {
              label: "Equipo",
              value: (() => {
                const n = equipamiento.map((s) => s.trim()).filter(Boolean)
                  .length;
                return n > 0 ? `${n} ítems` : "—";
              })(),
            },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-line bg-surface px-3 py-2"
            >
              <p className="text-[10px] uppercase tracking-wide text-muted">
                {s.label}
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-ink">
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Galería */}
      <section className="rounded-xl border border-line bg-paper p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-ink">Galería de fotos</h3>
        <p className="mt-0.5 text-xs text-muted">
          Es lo primero que se ve en la ficha de la sala.
        </p>
        <div className="mt-3">
          <SalaPhotosUpload
            salaId={mode === "edit" ? sala?.id : null}
            photos={photos}
            onPhotosChange={setPhotos}
            onPendingFilesChange={
              mode === "create" ? setPendingFiles : undefined
            }
          />
        </div>
      </section>

      {/* Identidad */}
      <section className="rounded-xl border border-line bg-paper p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-ink">
          Nombre, categoría y descripción
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted">
              Nombre
            </label>
            <input
              name="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sala A — Rock"
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted">
              Categoría
            </label>
            <input
              name="categoria"
              list="sala-categorias"
              required
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Música, Danza, o la que quieras…"
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
            <datalist id="sala-categorias">
              {categoriaSuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <p className="mt-1 text-[11px] text-muted">
              Escribí una nueva o elegí una sugerida
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs uppercase tracking-wide text-muted">
              Descripción (hero de la web)
            </label>
            <textarea
              name="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="La sala más pedida del complejo. Acústica tratada…"
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
          </div>
        </div>
      </section>

      {/* Specs */}
      <section className="rounded-xl border border-line bg-paper p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-ink">
          Dimensiones, capacidad, acústica y equipo
        </h3>
        <p className="mt-0.5 text-xs text-muted">
          Escribí acá lo que se muestra en la ficha pública.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <FieldCtrl
            label="Ancho (m)"
            name="anchoMetros"
            value={ancho}
            onChange={setAncho}
            placeholder="6"
          />
          <FieldCtrl
            label="Largo (m)"
            name="largoMetros"
            value={largo}
            onChange={setLargo}
            placeholder="4"
          />
          <FieldCtrl
            label="Capacidad (personas)"
            name="capacity"
            value={capacity}
            onChange={setCapacity}
            placeholder="5"
          />
          <FieldCtrl
            label="Acústica"
            name="acustica"
            value={acustica}
            onChange={setAcustica}
            placeholder="Profesional / tratada"
          />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <FieldCtrl
            label="Duración máx (min)"
            name="duracionMaxMinutos"
            value={duracionMax}
            onChange={setDuracionMax}
            placeholder="Vacío = hereda sede / sin tope"
          />
        </div>
        <label className="mt-4 flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted">
            Equipamiento incluido
          </span>
          <textarea
            rows={4}
            value={equipamiento.join("\n")}
            onChange={(e) => setEquipamiento(e.target.value.split("\n"))}
            placeholder={"Marshall 100W\nBatería Mapex\nMics SM58"}
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50"
          />
          <span className="text-[11px] text-muted">
            Un ítem por línea. Sale con ✓ en la web.
          </span>
        </label>
      </section>

      <ChipListEditor
        title="Tags / géneros"
        hint="Chips debajo del hero (Rock, Metal…)."
        items={tags}
        onChange={setTags}
        placeholder="Ej. Rock"
      />

      <details className="rounded-xl border border-dashed border-line bg-paper/60 px-3 py-2.5 sm:px-4">
        <summary className="cursor-pointer text-sm font-medium text-muted hover:text-ink">
          Más detalle (opcional)
        </summary>
        <div className="mt-3 space-y-4 border-t border-line pt-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-muted">
              No incluido
            </span>
            <textarea
              rows={3}
              value={noIncluido.join("\n")}
              onChange={(e) => setNoIncluido(e.target.value.split("\n"))}
              placeholder={"Platos\nCables\nPedales"}
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50"
            />
            <span className="text-[11px] text-muted">
              Un ítem por línea. Sale con ✕ en la web.
            </span>
          </label>
          <ChipListEditor
            title="Características (card)"
            hint="Resumen corto en las cards del estudio."
            items={caracteristicas}
            onChange={setCaracteristicas}
            placeholder="Ej. Batería Mapex"
          />
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="popular"
                defaultChecked={sala?.popular}
                className="accent-[var(--brand)]"
              />
              Badge Popular
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                name="nueva"
                defaultChecked={sala?.nueva}
                className="accent-[var(--brand)]"
              />
              Badge Nueva
            </label>
          </div>
          <Field
            label="Orden en la web"
            name="sortOrder"
            defaultValue={String(sala?.sortOrder ?? 0)}
            placeholder="0"
            className="max-w-40"
          />
        </div>
      </details>

      {state && !state.ok ? (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

function ChipListEditor({
  title,
  hint,
  items,
  onChange,
  placeholder,
  tone = "brand",
}: {
  title: string;
  hint: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  tone?: "brand" | "danger";
}) {
  return (
    <section className="rounded-xl border border-line bg-paper p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onChange(items.filter((x) => x !== item))}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              tone === "danger"
                ? "border-red-400/40 bg-red-500/10 text-red-700 hover:bg-red-500/15"
                : "border-brand/40 bg-brand/15 text-brand hover:bg-brand/20"
            }`}
            title="Quitar"
          >
            {item} ×
          </button>
        ))}
        {items.length === 0 ? (
          <span className="text-xs text-muted">Ninguno todavía</span>
        ) : null}
      </div>
      <input
        type="text"
        placeholder={placeholder}
        className="mt-3 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50"
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          const v = (e.target as HTMLInputElement).value.trim();
          if (!v || items.includes(v)) return;
          onChange([...items, v]);
          (e.target as HTMLInputElement).value = "";
        }}
      />
      <p className="mt-1 text-[11px] text-muted">Enter para agregar</p>
    </section>
  );
}

function FieldCtrl({
  label,
  name,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs uppercase tracking-wide text-muted">{label}</label>
      <input
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-brand/50"
      />
    </div>
  );
}

function Field({
  label,
  name,
  required,
  placeholder,
  defaultValue,
  className = "",
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs uppercase tracking-wide text-muted">{label}</label>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none placeholder:text-muted/50 focus:border-brand/50"
      />
    </div>
  );
}
