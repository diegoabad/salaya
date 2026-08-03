"use client";

import { uploadSedePhotoAction } from "@/app/actions/uploads";
import { PanelButton } from "@/components/features/panel/panel-ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  currentUrl: string | null;
  /** Actualiza preview en vivo (panel Mi estudio) sin depender del form */
  onUploaded?: (photoUrl: string) => void;
};

export function SedePhotoUpload({ currentUrl, onUploaded }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState(currentUrl);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="sm:col-span-2">
      <p className="text-xs uppercase tracking-wide text-muted">
        Foto del estudio
      </p>
      <div className="mt-2 flex flex-wrap items-start gap-4">
        <div className="h-28 w-40 overflow-hidden rounded-xl border border-line bg-surface-2">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Foto sede"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted">
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
              if (!file) return;
              setErr(null);
              setMsg(null);
              const fd = new FormData();
              fd.append("file", file);
              start(async () => {
                const res = await uploadSedePhotoAction(fd);
                if (!res.ok) {
                  setErr(res.error);
                  return;
                }
                const url = res.photoUrl ?? preview ?? "";
                setPreview(url || preview);
                if (url) onUploaded?.(url);
                setMsg("Foto subida y optimizada (WebP).");
                router.refresh();
              });
            }}
          />
          <p className="text-xs text-muted">
            JPG/PNG/WebP · máx 8 MB · se redimensiona a 1600px y convierte a
            WebP. Organización:{" "}
            <code className="text-[10px]">uploads/&#123;estudio&#125;/sede/</code>
          </p>
          {msg ? <p className="text-xs text-brand">{msg}</p> : null}
          {err ? (
            <p className="text-xs text-red-400" role="alert">
              {err}
            </p>
          ) : null}
          {pending ? (
            <PanelButton type="button" disabled>
              Subiendo…
            </PanelButton>
          ) : null}
        </div>
      </div>
      {/* Mantener valor en el form de negocio si ya hay URL */}
      <input type="hidden" name="photoUrl" value={preview ?? ""} />
    </div>
  );
}
