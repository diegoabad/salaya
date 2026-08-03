"use client";

import {
  deleteSedePhotoAction,
  uploadSedePhotosAction,
} from "@/app/actions/uploads";
import { useState, useTransition } from "react";

type Props = {
  photos: string[];
  onChange: (photos: string[]) => void;
  /** Solo preview local (panel demo): no llama a la API */
  localOnly?: boolean;
  max?: number;
};

/**
 * Galería del estudio: ver todas, subir varias, quitar, marcar portada (primera).
 */
export function EstudioPhotosUpload({
  photos,
  onChange,
  localOnly = false,
  max = 12,
}: Props) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink">Fotos del estudio</p>
        <p className="mt-0.5 text-xs text-muted">
          La primera es la portada del hero. Subí varias a la vez y mirá todas
          acá (máx. {max}).
        </p>
      </div>

      {photos.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((url, i) => (
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
                {i !== 0 ? (
                  <button
                    type="button"
                    disabled={pending}
                    className="flex-1 rounded-md bg-white/15 py-1 text-[10px] font-semibold text-white hover:bg-white/25"
                    onClick={() => {
                      onChange([url, ...photos.filter((p) => p !== url)]);
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
                    if (localOnly) {
                      onChange(photos.filter((p) => p !== url));
                      return;
                    }
                    start(async () => {
                      const res = await deleteSedePhotoAction(url);
                      if (!res.ok) {
                        setErr(res.error);
                        return;
                      }
                      onChange(res.photos ?? photos.filter((p) => p !== url));
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
        <div className="flex aspect-[21/9] max-h-40 items-center justify-center rounded-xl border border-dashed border-line bg-paper text-sm text-muted">
          Todavía no hay fotos. Subí la primera para el hero.
        </div>
      )}

      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-brand/40 bg-brand/5 px-4 py-5 text-center transition hover:bg-brand/10">
        <span className="text-sm font-semibold text-brand">
          {pending ? "Subiendo…" : "Sumar fotos"}
        </span>
        <span className="text-xs text-muted">
          JPG, PNG o WebP · varias a la vez · {photos.length}/{max}
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          disabled={pending || photos.length >= max}
          className="sr-only"
          onChange={(e) => {
            const list = e.target.files;
            if (!list?.length) return;
            setErr(null);
            const files = Array.from(list).slice(0, max - photos.length);
            if (localOnly) {
              start(async () => {
                const urls = await Promise.all(
                  files.map(
                    (f) =>
                      new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () =>
                          resolve(String(reader.result ?? ""));
                        reader.onerror = () => reject(reader.error);
                        reader.readAsDataURL(f);
                      }),
                  ),
                );
                onChange([...photos, ...urls.filter(Boolean)]);
                e.target.value = "";
              });
              return;
            }
            const fd = new FormData();
            for (const f of files) fd.append("files", f);
            start(async () => {
              const res = await uploadSedePhotosAction(fd);
              if (!res.ok) {
                setErr(res.error);
                return;
              }
              onChange(res.photos ?? photos);
              e.target.value = "";
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
