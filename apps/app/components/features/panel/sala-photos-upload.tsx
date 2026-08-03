"use client";

import {
  deleteSalaPhotoAction,
  uploadSalaPhotosAction,
} from "@/app/actions/uploads";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

type Props = {
  /** Si no hay sala aún (crear), las fotos quedan pendientes hasta guardar */
  salaId?: string | null;
  photos: string[];
  /** Si se pasa, sincroniza el estado del padre (form de sala) */
  onPhotosChange?: (photos: string[]) => void;
  /** Archivos locales pendientes de subir al crear la sala */
  onPendingFilesChange?: (files: File[]) => void;
  max?: number;
};

type LocalItem = { key: string; url: string; file: File };

export function SalaPhotosUpload({
  salaId = null,
  photos: initial,
  onPhotosChange,
  onPendingFilesChange,
  max = 12,
}: Props) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initial);
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setPhotos(initial);
  }, [initial]);

  useEffect(() => {
    return () => {
      for (const item of localItems) URL.revokeObjectURL(item.url);
    };
    // Solo al desmontar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (next: string[]) => {
    setPhotos(next);
    onPhotosChange?.(next);
  };

  const applyLocal = (next: LocalItem[]) => {
    setLocalItems(next);
    onPendingFilesChange?.(next.map((x) => x.file));
    onPhotosChange?.(next.map((x) => x.url));
  };

  const previews = salaId ? photos : localItems.map((x) => x.url);
  const count = previews.length;

  return (
    <div className="space-y-3">
      {previews.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {previews.map((url, i) => (
            <li
              key={`${url}-${i}`}
              className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface-2"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Foto ${i + 1}`}
                className="h-full w-full object-cover"
              />
              {i === 0 ? (
                <span className="absolute top-1.5 left-1.5 rounded-md bg-brand px-1.5 py-0.5 text-[10px] font-bold text-paper">
                  Portada
                </span>
              ) : null}
              <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-black/65 p-1.5 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                {!salaId && i !== 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="flex-1 rounded-md bg-white/15 py-1 text-[10px] font-semibold text-white hover:bg-white/25"
                    onClick={() => {
                      const item = localItems[i];
                      if (!item) return;
                      applyLocal([
                        item,
                        ...localItems.filter((_, j) => j !== i),
                      ]);
                    }}
                  >
                    Portada
                  </button>
                ) : null}
                {salaId && i !== 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="flex-1 rounded-md bg-white/15 py-1 text-[10px] font-semibold text-white hover:bg-white/25"
                    onClick={() => {
                      apply([url, ...photos.filter((p) => p !== url)]);
                    }}
                  >
                    Portada
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={pending}
                  className="flex-1 rounded-md bg-red-500/80 py-1 text-[10px] font-semibold text-white hover:bg-red-500"
                  onClick={() => {
                    setErr(null);
                    if (!salaId) {
                      const item = localItems[i];
                      if (item) URL.revokeObjectURL(item.url);
                      applyLocal(localItems.filter((_, j) => j !== i));
                      return;
                    }
                    start(async () => {
                      const res = await deleteSalaPhotoAction(salaId, url);
                      if (!res.ok) {
                        setErr(res.error);
                        return;
                      }
                      apply(res.photos ?? photos.filter((p) => p !== url));
                      router.refresh();
                    });
                  }}
                >
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex aspect-[21/9] max-h-36 items-center justify-center rounded-xl border border-dashed border-line bg-surface text-sm text-muted">
          Todavía no hay fotos. Subí la primera para la portada.
        </div>
      )}

      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-brand/40 bg-brand/5 px-4 py-4 text-center transition hover:bg-brand/10">
        <span className="text-sm font-semibold text-brand">
          {pending ? "Subiendo…" : "Sumar fotos"}
        </span>
        <span className="text-xs text-muted">
          JPG, PNG o WebP · varias a la vez · {count}/{max}
          {!salaId ? " · se suben al crear la sala" : ""}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          disabled={pending || count >= max}
          className="sr-only"
          onChange={(e) => {
            const list = e.target.files;
            if (!list?.length) return;
            setErr(null);
            const files = Array.from(list).slice(0, max - count);
            if (!salaId) {
              const next = [
                ...localItems,
                ...files.map((file) => ({
                  key: `${file.name}-${file.size}-${file.lastModified}`,
                  url: URL.createObjectURL(file),
                  file,
                })),
              ];
              applyLocal(next);
              e.target.value = "";
              return;
            }
            const fd = new FormData();
            for (const f of files) fd.append("files", f);
            start(async () => {
              const res = await uploadSalaPhotosAction(salaId, fd);
              if (!res.ok) {
                setErr(res.error);
                return;
              }
              apply(res.photos ?? photos);
              e.target.value = "";
              router.refresh();
            });
          }}
        />
      </label>

      {err ? (
        <p className="text-xs text-red-600" role="alert">
          {err}
        </p>
      ) : null}
    </div>
  );
}
