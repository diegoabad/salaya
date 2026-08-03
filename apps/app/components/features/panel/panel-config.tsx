"use client";

import { changePasswordAction } from "@/app/actions/auth";
import {
  connectMpAction,
  disconnectMpAction,
  startMpOAuthAction,
  type MpStatusDto,
} from "@/app/actions/mp";
import { DatePicker } from "@/components/ui/date-picker";
import {
  deleteHorarioEspecialAction,
  updateHorariosAction,
  updateNegocioAction,
  upsertHorarioEspecialAction,
  type HorarioEspecialDto,
  type NegocioDto,
} from "@/app/actions/negocio";
import { AuthForm, Field } from "@/app/(auth)/_components/auth-form";
import {
  PanelBadge,
  PanelButton,
  PanelPage,
} from "@/components/features/panel/panel-ui";
import { useActionState, useState, useTransition } from "react";
import Link from "next/link";

const DIAS_SEMANA = [
  { day: 1, label: "Lunes" },
  { day: 2, label: "Martes" },
  { day: 3, label: "Miércoles" },
  { day: 4, label: "Jueves" },
  { day: 5, label: "Viernes" },
  { day: 6, label: "Sábado" },
  { day: 0, label: "Domingo" },
] as const;

type FranjaHorario = {
  startTime: string;
  endTime: string;
};

type DiaHorario = {
  dayOfWeek: number;
  closed: boolean;
  franjas: FranjaHorario[];
};

const FRANJA_DEFAULT: FranjaHorario = { startTime: "10:00", endTime: "23:00" };
const MAX_FRANJAS_DIA = 4;

function initHorarios(rows: NegocioDto["horarios"]): DiaHorario[] {
  return DIAS_SEMANA.map(({ day }) => {
    const dayRows = rows
      .filter((h) => h.dayOfWeek === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return {
      dayOfWeek: day,
      closed: dayRows.length === 0,
      franjas:
        dayRows.length > 0
          ? dayRows.map((r) => ({
              startTime: r.startTime.slice(0, 5),
              endTime: r.endTime.slice(0, 5),
            }))
          : [{ ...FRANJA_DEFAULT }],
    };
  });
}

type Props = {
  negocio: NegocioDto;
  especiales?: HorarioEspecialDto[];
  hasPassword: boolean;
  userEmail: string;
  mpStatus: MpStatusDto | null;
  mpFlash?: { linked?: boolean; error?: string | null };
  basePath?: string;
};

export function PanelConfigView({
  negocio,
  especiales: inicialesEspeciales = [],
  hasPassword,
  userEmail,
  mpStatus,
  mpFlash,
  basePath = "/panel",
}: Props) {
  const [state, formAction, pending] = useActionState(updateNegocioAction, null);
  const [mpState, mpAction, mpPending] = useActionState(connectMpAction, null);
  const [mpBusy, startMp] = useTransition();
  const [horariosBusy, startHorarios] = useTransition();
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [horarios, setHorarios] = useState(() => initHorarios(negocio.horarios));
  const [horariosMsg, setHorariosMsg] = useState<string | null>(null);
  const [horariosOk, setHorariosOk] = useState(false);
  const [especiales, setEspeciales] = useState(inicialesEspeciales);
  const [espBusy, startEsp] = useTransition();
  const [espMsg, setEspMsg] = useState<string | null>(null);
  const [espFecha, setEspFecha] = useState("");
  const [espStart, setEspStart] = useState("10:00");
  const [espEnd, setEspEnd] = useState("23:00");
  const [espClosed, setEspClosed] = useState(false);

  const amenidadesCsv = negocio.sede.amenidades.join(", ");
  const destacadosCsv = negocio.directorio.tagsDestacados.join(", ");

  return (
    <PanelPage
      title="Configuración"
      description={`Slug público: /${negocio.tenant.slug} · ${negocio.salasCount} sala${negocio.salasCount === 1 ? "" : "s"}`}
    >
      <div className="space-y-6">
        <section className="rounded-2xl border border-line bg-surface p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-lg tracking-tight">Mercado Pago</h2>
            {mpStatus?.mock ? (
              <PanelBadge tone="warn">Mock local</PanelBadge>
            ) : null}
            {mpStatus?.connected ? (
              <PanelBadge tone="ok">Listo para cobrar señas</PanelBadge>
            ) : (
              <PanelBadge>Sin conectar</PanelBadge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            Conectá la cuenta de Mercado Pago de este estudio. Las señas de las
            reservas van a tu MP. La suscripción a SalaYa es aparte y se gestiona
            en Plan.
          </p>
          {mpStatus?.marketplaceFeeEnabled ? (
            <p className="mt-2 text-sm text-ink">
              Comisión plataforma:{" "}
              <span className="font-semibold text-brand">
                {mpStatus.marketplaceFeePercent}%
              </span>{" "}
              sobre cada seña (marketplace_fee).
            </p>
          ) : null}
          {mpFlash?.linked ? (
            <p className="mt-3 text-sm text-brand">
              Mercado Pago vinculado correctamente.
            </p>
          ) : null}
          {mpFlash?.error ? (
            <p className="mt-3 text-sm text-red-600">
              No se pudo vincular ({mpFlash.error}). Intentá de nuevo.
            </p>
          ) : null}
          {mpStatus?.tenantConnected ? (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-sm text-ink">
                Cuenta vinculada
                {mpStatus.mpUserId ? ` · collector ${mpStatus.mpUserId}` : ""}.
                El dinero de las señas entra en tu Mercado Pago.
              </p>
              <PanelButton
                variant="ghost"
                disabled={mpBusy}
                onClick={() =>
                  startMp(async () => {
                    await disconnectMpAction();
                  })
                }
              >
                Desconectar
              </PanelButton>
            </div>
          ) : (
            <div className="mt-4 max-w-lg space-y-3">
              {mpStatus?.oauthAvailable !== false ? (
                <>
                  <PanelButton
                    type="button"
                    disabled={mpBusy}
                    onClick={() =>
                      startMp(async () => {
                        setOauthError(null);
                        const res = await startMpOAuthAction();
                        if (!res.ok) {
                          setOauthError(res.error);
                          return;
                        }
                        window.location.href = res.url;
                      })
                    }
                  >
                    {mpBusy ? "Redirigiendo…" : "Conectar con Mercado Pago"}
                  </PanelButton>
                  {oauthError ? (
                    <p className="text-sm text-red-600">{oauthError}</p>
                  ) : null}
                  {!mpStatus?.oauthConfigured && mpStatus?.mock ? (
                    <p className="text-xs text-muted">
                      Modo mock: la vinculación se completa en local sin app de
                      MP.
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="text-xs text-muted underline"
                    onClick={() => setShowManual((v) => !v)}
                  >
                    {showManual
                      ? "Ocultar token manual"
                      : "Usar access token manual"}
                  </button>
                </>
              ) : (
                <p className="text-sm text-muted">
                  OAuth no configurado en el servidor (MP_CLIENT_ID /
                  MP_CLIENT_SECRET). Podés pegar un token de prueba abajo.
                </p>
              )}
              {(showManual || mpStatus?.oauthAvailable === false) && (
                <form action={mpAction} className="space-y-3">
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium text-muted">
                      Access token (test o producción)
                    </span>
                    <input
                      name="accessToken"
                      type="password"
                      required
                      autoComplete="off"
                      placeholder="APP_USR-…"
                      className="rounded-xl border border-line bg-paper px-3 py-2.5 text-ink outline-none focus:border-brand/50"
                    />
                  </label>
                  {mpState && !mpState.ok ? (
                    <p className="text-sm text-red-600">{mpState.error}</p>
                  ) : null}
                  {mpState?.ok ? (
                    <p className="text-sm text-brand">Token guardado cifrado.</p>
                  ) : null}
                  <PanelButton type="submit" disabled={mpPending}>
                    {mpPending ? "Guardando…" : "Guardar token"}
                  </PanelButton>
                </form>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface p-4 md:p-5">
          <h2 className="font-display text-lg tracking-tight">Tu cuenta</h2>
          <p className="mt-1 text-sm text-muted">{userEmail}</p>
          <div className="mt-4 max-w-md">
            <h3 className="text-sm font-medium text-ink">
              {hasPassword ? "Cambiar contraseña" : "Definir contraseña"}
            </h3>
            <div className="mt-3">
              <AuthForm
                action={changePasswordAction}
                submitLabel={
                  hasPassword ? "Actualizar contraseña" : "Guardar contraseña"
                }
              >
                {hasPassword ? (
                  <Field
                    label="Contraseña actual"
                    name="currentPassword"
                    type="password"
                    required
                    autoComplete="current-password"
                  />
                ) : null}
                <Field
                  label="Nueva contraseña"
                  name="newPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                />
                <Field
                  label="Repetir contraseña"
                  name="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                />
              </AuthForm>
            </div>
          </div>
        </section>

        <form action={formAction} className="space-y-6">
          <input type="hidden" name="amenidades" value={amenidadesCsv} />
          <input type="hidden" name="tagsDestacados" value={destacadosCsv} />
          <input type="hidden" name="tenantName" value={negocio.tenant.name} />
          <input type="hidden" name="sedeName" value={negocio.sede.name} />
          <input type="hidden" name="zona" value={negocio.sede.zona ?? ""} />
          <input
            type="hidden"
            name="address"
            value={negocio.sede.address ?? ""}
          />
          <input
            type="hidden"
            name="description"
            value={negocio.sede.description ?? ""}
          />
          <input
            type="hidden"
            name="photoUrl"
            value={negocio.sede.photoUrl ?? ""}
          />
          <input
            type="hidden"
            name="telefono"
            value={negocio.directorio.telefono ?? ""}
          />
          <input
            type="hidden"
            name="instagramUrl"
            value={negocio.tenant.instagramUrl ?? ""}
          />
          <input
            type="hidden"
            name="websiteUrl"
            value={negocio.tenant.websiteUrl ?? ""}
          />
          <input
            type="hidden"
            name="whatsapp"
            value={negocio.tenant.whatsapp ?? ""}
          />
          <input
            type="hidden"
            name="youtubeUrl"
            value={negocio.tenant.youtubeUrl ?? ""}
          />
          <input
            type="hidden"
            name="tiktokUrl"
            value={negocio.tenant.tiktokUrl ?? ""}
          />
          <input
            type="hidden"
            name="linksExtra"
            value={JSON.stringify(negocio.tenant.linksExtra ?? [])}
          />
          {negocio.sede.lat != null ? (
            <input type="hidden" name="lat" value={String(negocio.sede.lat)} />
          ) : null}
          {negocio.sede.lng != null ? (
            <input type="hidden" name="lng" value={String(negocio.sede.lng)} />
          ) : null}

          <section className="rounded-2xl border border-dashed border-line bg-surface/60 p-4 md:p-5">
            <h2 className="font-display text-lg tracking-tight">
              Ficha pública
            </h2>
            <p className="mt-1 text-sm text-muted">
              Nombre, fotos, descripción, comodidades, contacto y horarios se
              editan en{" "}
              <Link
                href={`${basePath}/mi-estudio`}
                className="text-brand underline"
              >
                Mi estudio
              </Link>
              .
            </p>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-4 md:p-5">
            <h2 className="font-display text-lg tracking-tight">
              Políticas de reserva
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <TextField
                label="Hold (min)"
                name="holdMinutos"
                defaultValue={String(negocio.politica?.holdMinutos ?? 5)}
              />
              <TextField
                label="Cancelar con (hs)"
                name="cancelacionVentanaHoras"
                defaultValue={String(
                  negocio.politica?.cancelacionVentanaHoras ?? 24,
                )}
              />
              <div>
                <label className="text-xs uppercase tracking-wide text-muted">
                  Si cancela a tiempo, la seña…
                </label>
                <select
                  name="senaDestinoCancelacion"
                  defaultValue={
                    negocio.politica?.senaDestinoCancelacion ?? "perder"
                  }
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-brand/50"
                >
                  <option value="perder">Se pierde</option>
                  <option value="devolver">Se devuelve</option>
                  <option value="credito">Queda como crédito</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-ink sm:col-span-2">
                <input
                  type="checkbox"
                  name="permiteReprogramar"
                  defaultChecked={negocio.politica?.permiteReprogramar ?? true}
                  className="rounded border-line"
                />
                Permitir reprogramar (el músico puede pedir cambiar el turno)
              </label>
              <p className="text-xs text-muted sm:col-span-2 lg:col-span-4">
                Esta política se muestra al músico al reservar y al cancelar.
                SalaYa no gestiona reembolsos: el destino de la seña lo cumplís
                vos como estudio.
              </p>
              <TextField
                label="Duración mín (min)"
                name="duracionMinMinutos"
                defaultValue={String(negocio.politica?.duracionMinMinutos ?? 60)}
              />
              <TextField
                label="Duración máx (min)"
                name="duracionMaxMinutos"
                defaultValue={
                  negocio.politica?.duracionMaxMinutos != null
                    ? String(negocio.politica.duracionMaxMinutos)
                    : ""
                }
                placeholder="Vacío = sin tope"
              />
              <div>
                <label className="text-xs uppercase tracking-wide text-muted">
                  Seña
                </label>
                <select
                  name="senaModo"
                  defaultValue={negocio.politica?.senaModo ?? "siempre"}
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-brand/50"
                >
                  <option value="nunca">Nunca</option>
                  <option value="siempre">Siempre</option>
                  <option value="reincidentes">Reincidentes</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-muted">
                  Tipo seña
                </label>
                <select
                  name="senaTipo"
                  defaultValue={negocio.politica?.senaTipo ?? "porcentaje"}
                  className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-brand/50"
                >
                  <option value="porcentaje">Porcentaje</option>
                  <option value="fijo">Monto fijo</option>
                </select>
              </div>
              <TextField
                label="Valor seña"
                name="senaValor"
                defaultValue={negocio.politica?.senaValor ?? "30"}
              />
            </div>
          </section>

          {state && !state.ok ? (
            <p className="text-sm text-red-300" role="alert">
              {state.error}
            </p>
          ) : null}
          {state?.ok ? (
            <p className="text-sm text-brand" role="status">
              Negocio guardado.
            </p>
          ) : null}

          <PanelButton type="submit">
            {pending ? "Guardando…" : "Guardar políticas"}
          </PanelButton>
        </form>

        <section className="rounded-2xl border border-line bg-surface p-4 md:p-5">
          <h2 className="font-display text-lg tracking-tight">
            Horario de atención
          </h2>
          <p className="mt-1 text-sm text-muted">
            Define qué días y franjas pueden reservar los músicos. Podés sumar
            más de una franja por día. Los días cerrados no aparecen en el
            calendario público.
          </p>
          <ul className="mt-4 space-y-2">
            {DIAS_SEMANA.map(({ day, label }, idx) => {
              const row = horarios[idx]!;
              return (
                <li
                  key={day}
                  className="flex min-h-[3.25rem] flex-wrap items-center gap-3 rounded-xl border border-line bg-paper px-3 py-2"
                >
                  <label className="flex min-w-30 items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={!row.closed}
                      onChange={(e) => {
                        const open = e.target.checked;
                        setHorarios((list) =>
                          list.map((h) =>
                            h.dayOfWeek === day
                              ? {
                                  ...h,
                                  closed: !open,
                                  franjas:
                                    h.franjas.length > 0
                                      ? h.franjas
                                      : [{ ...FRANJA_DEFAULT }],
                                }
                              : h,
                          ),
                        );
                      }}
                    />
                    {label}
                  </label>
                  {row.closed ? (
                    <div className="flex min-h-[2.125rem] min-w-0 flex-1 items-center">
                      <span className="text-sm text-muted">Cerrado</span>
                    </div>
                  ) : (
                    <div className="flex min-h-[2.125rem] min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
                      {row.franjas.map((f, fi) => (
                        <div
                          key={fi}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="time"
                            value={f.startTime}
                            onChange={(e) => {
                              const v = e.target.value;
                              setHorarios((list) =>
                                list.map((h) =>
                                  h.dayOfWeek === day
                                    ? {
                                        ...h,
                                        franjas: h.franjas.map((x, i) =>
                                          i === fi
                                            ? { ...x, startTime: v }
                                            : x,
                                        ),
                                      }
                                    : h,
                                ),
                              );
                            }}
                            className="h-[2.125rem] rounded-lg border border-line bg-surface px-2 py-1.5"
                          />
                          <span className="text-xs text-muted">a</span>
                          <input
                            type="time"
                            value={f.endTime}
                            onChange={(e) => {
                              const v = e.target.value;
                              setHorarios((list) =>
                                list.map((h) =>
                                  h.dayOfWeek === day
                                    ? {
                                        ...h,
                                        franjas: h.franjas.map((x, i) =>
                                          i === fi
                                            ? { ...x, endTime: v }
                                            : x,
                                        ),
                                      }
                                    : h,
                                ),
                              );
                            }}
                            className="h-[2.125rem] rounded-lg border border-line bg-surface px-2 py-1.5"
                          />
                          {row.franjas.length > 1 ? (
                            <button
                              type="button"
                              aria-label="Quitar franja"
                              onClick={() =>
                                setHorarios((list) =>
                                  list.map((h) =>
                                    h.dayOfWeek === day
                                      ? {
                                          ...h,
                                          franjas: h.franjas.filter(
                                            (_, i) => i !== fi,
                                          ),
                                        }
                                      : h,
                                  ),
                                )
                              }
                              className="rounded-lg px-2 py-1 text-muted transition hover:bg-surface-2 hover:text-ink"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      ))}
                      {row.franjas.length < MAX_FRANJAS_DIA ? (
                        <button
                          type="button"
                          onClick={() =>
                            setHorarios((list) =>
                              list.map((h) => {
                                if (h.dayOfWeek !== day) return h;
                                const last =
                                  h.franjas[h.franjas.length - 1] ??
                                  FRANJA_DEFAULT;
                                return {
                                  ...h,
                                  franjas: [
                                    ...h.franjas,
                                    {
                                      startTime: last.endTime,
                                      endTime: "23:00",
                                    },
                                  ],
                                };
                              }),
                            )
                          }
                          className="shrink-0 text-xs font-medium text-brand hover:underline"
                        >
                          + Franja
                        </button>
                      ) : null}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          {horariosMsg ? (
            <p
              className={`mt-3 text-sm ${horariosOk ? "text-brand" : "text-red-300"}`}
              role={horariosOk ? "status" : "alert"}
            >
              {horariosMsg}
            </p>
          ) : null}
          <div className="mt-4">
            <PanelButton
              type="button"
              disabled={horariosBusy}
              onClick={() => {
                setHorariosMsg(null);
                startHorarios(async () => {
                  const res = await updateHorariosAction({
                    horarios: horarios.flatMap((h) =>
                      h.closed
                        ? [{ dayOfWeek: h.dayOfWeek, closed: true }]
                        : h.franjas.map((f) => ({
                            dayOfWeek: h.dayOfWeek,
                            closed: false,
                            startTime: f.startTime,
                            endTime: f.endTime,
                          })),
                    ),
                  });
                  if (res.ok) {
                    setHorariosOk(true);
                    setHorariosMsg("Horarios guardados.");
                  } else {
                    setHorariosOk(false);
                    setHorariosMsg(res.error);
                  }
                });
              }}
            >
              {horariosBusy ? "Guardando…" : "Guardar horarios"}
            </PanelButton>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-4 md:p-5">
          <h2 className="font-display text-lg tracking-tight">
            Horarios especiales
          </h2>
          <p className="mt-1 text-sm text-muted">
            Feriados, cierres o franjas distintas para un día concreto. Ganan
            sobre el horario semanal.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label className="text-xs uppercase tracking-wide text-muted">
                Fecha
              </label>
              <div className="mt-1">
                <DatePicker
                  compact
                  tone="paper"
                  value={espFecha}
                  onChange={setEspFecha}
                  aria-label="Fecha del horario especial"
                />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted">
                Desde
              </label>
              <input
                type="time"
                value={espStart}
                disabled={espClosed}
                onChange={(e) => setEspStart(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-brand/50 disabled:opacity-40"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-muted">
                Hasta
              </label>
              <input
                type="time"
                value={espEnd}
                disabled={espClosed}
                onChange={(e) => setEspEnd(e.target.value)}
                className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-brand/50 disabled:opacity-40"
              />
            </div>
            <label className="flex items-end gap-2 pb-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={espClosed}
                onChange={(e) => setEspClosed(e.target.checked)}
                className="rounded border-line"
              />
              Cerrado todo el día
            </label>
            <div className="flex items-end">
              <PanelButton
                type="button"
                disabled={espBusy || !espFecha}
                onClick={() => {
                  const fecha = espFecha;
                  const closed = espClosed;
                  const startTime = espStart;
                  const endTime = espEnd;
                  setEspMsg(null);
                  startEsp(async () => {
                    const res = await upsertHorarioEspecialAction({
                      fecha,
                      closed,
                      startTime: closed ? null : startTime,
                      endTime: closed ? null : endTime,
                    });
                    if (!res.ok) {
                      setEspMsg(res.error);
                      return;
                    }
                    setEspeciales((list) => {
                      const next = list.filter((x) => x.fecha !== fecha);
                      next.push({
                        fecha,
                        closed,
                        startTime: closed ? null : startTime,
                        endTime: closed ? null : endTime,
                      });
                      return next.sort((a, b) =>
                        a.fecha.localeCompare(b.fecha),
                      );
                    });
                    setEspMsg("Guardado.");
                    setEspFecha("");
                    setEspStart("10:00");
                    setEspEnd("23:00");
                    setEspClosed(false);
                  });
                }}
              >
                {espBusy ? "…" : "Agregar / actualizar"}
              </PanelButton>
            </div>
          </div>
          {espMsg ? (
            <p className="mt-2 text-sm text-muted">{espMsg}</p>
          ) : null}
          {especiales.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {especiales.map((e) => (
                <li
                  key={e.fecha}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm"
                >
                  <span>
                    {e.fecha}
                    {e.closed
                      ? " · Cerrado"
                      : ` · ${e.startTime?.slice(0, 5)}–${e.endTime?.slice(0, 5)}`}
                  </span>
                  <button
                    type="button"
                    disabled={espBusy}
                    className="text-xs text-red-400 hover:underline"
                    onClick={() => {
                      startEsp(async () => {
                        const res = await deleteHorarioEspecialAction(e.fecha);
                        if (!res.ok) {
                          setEspMsg(res.error);
                          return;
                        }
                        setEspeciales((list) =>
                          list.filter((x) => x.fecha !== e.fecha),
                        );
                      });
                    }}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Sin excepciones cargadas.</p>
          )}
        </section>
      </div>
    </PanelPage>
  );
}

function TextField({
  label,
  name,
  defaultValue,
  required,
  placeholder,
  className = "",
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="text-xs uppercase tracking-wide text-muted">{label}</label>
      <input
        name={name}
        type="text"
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
      />
    </div>
  );
}
