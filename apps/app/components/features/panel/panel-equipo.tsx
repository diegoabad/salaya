"use client";

import {
  inviteMemberAction,
  removeMemberAction,
  revokeInviteAction,
  type ActionResult,
} from "@/app/actions/auth";
import {
  PanelBadge,
  PanelButton,
  PanelPage,
} from "@/components/features/panel/panel-ui";
import { useActionState, useState } from "react";

type TeamData = {
  members: Array<{
    userId: string;
    email: string;
    name: string;
    role: "owner" | "employee";
    createdAt: string;
    hasPassword: boolean;
  }>;
  invites: Array<{
    id: string;
    email: string;
    role: "owner" | "employee";
    expiresAt: string;
    createdAt: string;
    token: string;
  }>;
};

type InviteResult = ActionResult & { inviteUrl?: string };

export function PanelEquipoView({
  initial,
  authUrl,
}: {
  initial: TeamData;
  authUrl: string;
}) {
  const [team, setTeam] = useState(initial);
  const [lastUrl, setLastUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [inviteState, inviteAction, invitePending] = useActionState(
    async (prev: InviteResult | null, formData: FormData): Promise<InviteResult> => {
      const result = await inviteMemberAction(prev, formData);
      if (result.ok && result.inviteUrl) {
        setLastUrl(result.inviteUrl);
        setMsg("Invitación creada. Copiá el link y envialo al colaborador.");
        // refresh list optimistically
        const email = String(formData.get("email") ?? "").toLowerCase();
        setTeam((t) => ({
          ...t,
          invites: [
            {
              id: crypto.randomUUID(),
              email,
              role: "employee",
              expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(),
              createdAt: new Date().toISOString(),
              token: result.inviteUrl!.split("/").pop()!,
            },
            ...t.invites,
          ],
        }));
      }
      return result;
    },
    null,
  );

  return (
    <PanelPage
      title="Equipo"
      description="Invitá colaboradores desde acá. No se registran solos: entran con el link de invitación."
    >
      <section className="mb-8 rounded-2xl border border-line bg-surface p-4 md:p-5">
        <h2 className="font-display text-lg tracking-tight">Invitar colaborador</h2>
        <form action={inviteAction} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            name="email"
            type="email"
            required
            placeholder="email@ejemplo.com"
            className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3 py-2.5 text-sm outline-none focus:border-brand/50"
          />
          <PanelButton type="submit">
            {invitePending ? "Invitando…" : "Invitar"}
          </PanelButton>
        </form>
        {inviteState && !inviteState.ok ? (
          <p className="mt-3 text-sm text-red-300" role="alert">
            {inviteState.error}
          </p>
        ) : null}
        {msg ? <p className="mt-3 text-sm text-brand">{msg}</p> : null}
        {lastUrl ? (
          <div className="mt-3 rounded-xl border border-brand/30 bg-brand/10 p-3">
            <p className="text-xs text-muted">Link de invitación (válido 7 días)</p>
            <p className="mt-1 break-all text-sm text-ink">{lastUrl}</p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-brand underline"
              onClick={() => navigator.clipboard.writeText(lastUrl)}
            >
              Copiar link
            </button>
          </div>
        ) : null}
      </section>

      <section className="mb-8">
        <h2 className="font-display text-lg tracking-tight">Miembros</h2>
        <ul className="mt-3 space-y-2">
          {team.members.map((m) => (
            <li
              key={m.userId}
              className="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-ink">{m.name || m.email}</p>
                <p className="text-sm text-muted">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <PanelBadge tone={m.role === "owner" ? "brand" : "neutral"}>
                  {m.role === "owner" ? "Dueño" : "Colaborador"}
                </PanelBadge>
                {m.role === "employee" ? (
                  <form
                    action={async () => {
                      const r = await removeMemberAction(m.userId);
                      if (r.ok) {
                        setTeam((t) => ({
                          ...t,
                          members: t.members.filter((x) => x.userId !== m.userId),
                        }));
                      } else {
                        setMsg(r.error);
                      }
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-red-300"
                    >
                      Quitar
                    </button>
                  </form>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {team.invites.length > 0 && (
        <section>
          <h2 className="font-display text-lg tracking-tight">
            Invitaciones pendientes
          </h2>
          <ul className="mt-3 space-y-2">
            {team.invites.map((i) => {
              const url = `${authUrl}/invite/${i.token}`;
              return (
                <li
                  key={i.id}
                  className="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-ink">{i.email}</p>
                    <p className="text-xs text-muted">
                      Expira{" "}
                      {new Date(i.expiresAt).toLocaleDateString("es-AR")}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-line px-2.5 py-1 text-xs text-brand"
                      onClick={() => navigator.clipboard.writeText(url)}
                    >
                      Copiar link
                    </button>
                    <form
                      action={async () => {
                        const r = await revokeInviteAction(i.id);
                        if (r.ok) {
                          setTeam((t) => ({
                            ...t,
                            invites: t.invites.filter((x) => x.id !== i.id),
                          }));
                        }
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted hover:text-red-300"
                      >
                        Revocar
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </PanelPage>
  );
}
