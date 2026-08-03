"use client";

import { PanelButton } from "@/components/features/panel/panel-ui";
import { Modal } from "@/components/ui/modal";

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Estilo destructivo (eliminar, cancelar reserva) */
  danger?: boolean;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  pending = false,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      placement="center"
      className="sm:max-w-md!"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <PanelButton variant="ghost" onClick={onClose} disabled={pending}>
            {cancelLabel}
          </PanelButton>
          {danger ? (
            <button
              type="button"
              disabled={pending}
              onClick={onConfirm}
              className="inline-flex items-center justify-center rounded-xl border border-red-500/35 bg-red-500/10 px-3.5 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Esperá…" : confirmLabel}
            </button>
          ) : (
            <PanelButton onClick={onConfirm} disabled={pending}>
              {pending ? "Esperá…" : confirmLabel}
            </PanelButton>
          )}
        </div>
      }
    >
      {description ? (
        <p className="text-sm leading-relaxed text-muted">{description}</p>
      ) : (
        <p className="text-sm text-muted">¿Confirmás esta acción?</p>
      )}
    </Modal>
  );
}
