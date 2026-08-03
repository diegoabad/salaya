"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/app/actions/auth";

type Props = {
  action: (
    prev: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel: string;
};

export function AuthForm({ action, children, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex w-full flex-col gap-4">
      {children}
      {state && !state.ok ? (
        <p
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p
          className="rounded-md border border-brand/30 bg-brand/10 px-3 py-2 text-sm text-brand"
          role="status"
        >
          Listo.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-paper transition hover:bg-brand-deep disabled:opacity-60"
      >
        {pending ? "Esperá…" : submitLabel}
      </button>
    </form>
  );
}

export function Field({
  label,
  name,
  type = "text",
  required,
  autoComplete,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-muted">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="rounded-xl border border-line bg-surface px-3 py-2.5 text-ink outline-none ring-brand/40 placeholder:text-muted/60 focus:ring-2"
      />
    </label>
  );
}
