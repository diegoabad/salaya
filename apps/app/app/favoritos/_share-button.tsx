"use client";

import { useState } from "react";

export function FavoritosShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copiá el link:", url);
        }
      }}
      className="rounded-full bg-brand px-3 py-1.5 text-sm font-semibold text-paper"
    >
      {copied ? "¡Copiado!" : "Compartir lista"}
    </button>
  );
}
