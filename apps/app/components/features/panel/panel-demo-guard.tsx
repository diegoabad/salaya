"use client";

import { Toast } from "@/components/ui/toast";
import { useCallback, useState, type ReactNode } from "react";

const MSG =
  "Esto es una vista de prueba. Para guardar cambios, registrá tu estudio.";

/**
 * Bloquea envíos de formularios en el panel demo (sin mutar).
 * Los botones de UI (abrir modales, filtros) siguen funcionando.
 */
export function PanelDemoGuard({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null);
  const dismiss = useCallback(() => setToast(null), []);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onSubmitCapture={(e) => {
        const form = e.target;
        if (
          form instanceof HTMLFormElement &&
          form.dataset.demoAllow === "true"
        ) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        setToast(MSG);
      }}
    >
      {children}
      <Toast message={toast} onDismiss={dismiss} />
    </div>
  );
}
