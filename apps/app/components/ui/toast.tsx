"use client";

import { useEffect, useState } from "react";

type Props = {
  message: string | null;
  onDismiss: () => void;
  /** ms visibles antes de auto-cerrar. Default 4s */
  durationMs?: number;
};

export function Toast({ message, onDismiss, durationMs = 4000 }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [message, durationMs, onDismiss]);

  if (!message || !visible) return null;

  return (
    <div
      role="status"
      className="fixed top-4 left-1/2 z-50 w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink shadow-xl shadow-black/40 md:left-auto md:right-4 md:translate-x-0"
    >
      <div className="flex items-start gap-3">
        <p className="flex-1 leading-snug">{message}</p>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={() => {
            setVisible(false);
            onDismiss();
          }}
          className="shrink-0 rounded-full p-1 text-muted transition hover:bg-surface-2 hover:text-ink"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
