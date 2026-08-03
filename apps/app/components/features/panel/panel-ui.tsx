import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function PanelPageHeader({
  title,
  description,
  actions,
  className = "",
}: Omit<Props, "children"> & { className?: string }) {
  return (
    <div
      className={`mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div>
        <h1 className="font-display text-2xl tracking-tight md:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function PanelPage({
  title,
  description,
  actions,
  children,
  fill = false,
}: Props & { fill?: boolean }) {
  return (
    <div
      className={
        fill
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "min-h-0 flex-1 overflow-y-auto"
      }
    >
      <PanelPageHeader
        title={title}
        description={description}
        actions={actions}
        className={fill ? "mb-3 shrink-0" : undefined}
      />
      <div
        className={
          fill ? "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" : undefined
        }
      >
        {children}
      </div>
    </div>
  );
}

export function PanelButton({
  children,
  variant = "primary",
  type = "button",
  disabled,
  onClick,
  form,
}: {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger";
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  form?: string;
}) {
  const styles =
    variant === "primary"
      ? "bg-brand text-paper hover:bg-brand-deep"
      : variant === "danger"
        ? "border border-red-500/35 bg-red-500/10 text-red-700 hover:bg-red-500/15"
        : "border border-line bg-surface-2 text-ink hover:border-brand/40";

  return (
    <button
      type={type}
      form={form}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
  );
}

export function PanelEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-surface/50 px-6 py-12 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function PanelBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "warn" | "danger" | "ok";
}) {
  const tones = {
    neutral: "border-line bg-surface-2 text-muted",
    brand: "border-brand/40 bg-brand/15 text-brand",
    warn: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    danger: "border-red-400/40 bg-red-400/10 text-red-300",
    ok: "border-teal-400/40 bg-teal-400/10 text-teal-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
