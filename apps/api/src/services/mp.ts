import { randomUUID } from "node:crypto";
import { calcularMarketplaceFee, calcularMontoSena } from "@repo/core";
import { getDb } from "@repo/db";
import {
  deleteMpConexion,
  findHoldBySession,
  findSalaPublicaById,
  getMpConexion,
  getNegocioBundle,
  getPagoByExternalRef,
  getPoliticaBySede,
  insertMovimiento,
  insertPago,
  markWebhookProcessed,
  tryInsertWebhookEvent,
  updateHoldReserva,
  updatePago,
  upsertClienteByTelefono,
  upsertMpConexion,
} from "@repo/db/queries";
import { POLITICA_DEFAULTS } from "@repo/shared";
import { z } from "zod";
import { getEnv } from "../config/env";
import { verifyMpWebhookSignature } from "../crypto/mpWebhook";
import { decryptSecret, encryptSecret, getTokenKey } from "../crypto/secretBox";
import { HttpError } from "../middlewares/errorHandler";
import { emitHoldRemovePublic } from "./holds";
import {
  buildMpAuthorizationUrl,
  exchangeMpCode,
  isMpOAuthConfigured,
  refreshMpAccessToken,
  resolveMpOAuthRedirectUri,
  verifyMpOAuthState,
} from "./mpOAuth";
import {
  applySuscripcionPagoAprobado,
  isSuscripcionExternalRef,
} from "./suscripcion";
import { cancelUrlForReserva, reprogramUrlForReserva } from "../crypto/cancelToken";
import { enqueueNotification } from "./notifications";

function tokenKey() {
  return getTokenKey(getEnv().tokenKeySource);
}

const REFRESH_MARGIN_MS = 7 * 24 * 60 * 60 * 1000;

function shouldRefresh(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() - Date.now() < REFRESH_MARGIN_MS;
}

async function resolveAccessToken(tenantId: string): Promise<{
  token: string;
  source: "tenant" | "platform" | "mock";
}> {
  const env = getEnv();
  if (env.mpMock) {
    const conexion = await getMpConexion(getDb(), tenantId);
    if (conexion) {
      const key = tokenKey();
      if (shouldRefresh(conexion.expiresAt)) {
        try {
          const refreshToken = decryptSecret(
            conexion.refreshTokenEncrypted,
            key,
          );
          const renewed = await refreshMpAccessToken(refreshToken);
          await upsertMpConexion(getDb(), tenantId, {
            mpUserId: renewed.userId ?? conexion.mpUserId,
            accessTokenEncrypted: encryptSecret(renewed.accessToken, key),
            refreshTokenEncrypted: encryptSecret(renewed.refreshToken, key),
            expiresAt: new Date(Date.now() + renewed.expiresIn * 1000),
          });
          return { token: renewed.accessToken, source: "tenant" };
        } catch {
          /* usar access token guardado */
        }
      }
      return {
        token: decryptSecret(conexion.accessTokenEncrypted, key),
        source: "tenant",
      };
    }
    return { token: "MOCK", source: "mock" };
  }

  const conexion = await getMpConexion(getDb(), tenantId);
  if (conexion) {
    const key = tokenKey();
    if (shouldRefresh(conexion.expiresAt) && isMpOAuthConfigured()) {
      try {
        const refreshToken = decryptSecret(
          conexion.refreshTokenEncrypted,
          key,
        );
        const renewed = await refreshMpAccessToken(refreshToken);
        await upsertMpConexion(getDb(), tenantId, {
          mpUserId: renewed.userId ?? conexion.mpUserId,
          accessTokenEncrypted: encryptSecret(renewed.accessToken, key),
          refreshTokenEncrypted: encryptSecret(renewed.refreshToken, key),
          expiresAt: new Date(Date.now() + renewed.expiresIn * 1000),
        });
        return { token: renewed.accessToken, source: "tenant" };
      } catch {
        /* usar access token guardado si el refresh falla */
      }
    }
    return {
      token: decryptSecret(conexion.accessTokenEncrypted, key),
      source: "tenant",
    };
  }
  if (env.MP_ACCESS_TOKEN) {
    return { token: env.MP_ACCESS_TOKEN, source: "platform" };
  }
  throw new HttpError(
    400,
    "MP_NOT_CONNECTED",
    "Conectá Mercado Pago en Configuración o configurá MP_ACCESS_TOKEN",
  );
}

export async function getMpStatus(tenantId: string) {
  const env = getEnv();
  const conexion = await getMpConexion(getDb(), tenantId);
  const oauthConfigured = isMpOAuthConfigured();
  const feePercent = env.MP_MARKETPLACE_FEE_PERCENT;
  return {
    mock: env.mpMock,
    oauthConfigured,
    /** En mock se puede vincular sin client id (callback smoke) */
    oauthAvailable: oauthConfigured || env.mpMock,
    connected: Boolean(conexion) || Boolean(env.MP_ACCESS_TOKEN) || env.mpMock,
    tenantConnected: Boolean(conexion),
    mpUserId: conexion?.mpUserId ?? null,
    expiresAt: conexion?.expiresAt?.toISOString() ?? null,
    marketplaceFeePercent: feePercent,
    marketplaceFeeEnabled: feePercent > 0,
  };
}

export async function startMpOAuthLink(
  tenantId: string,
  userId: string,
  appReturnUrl?: string,
) {
  const env = getEnv();
  const returnTo =
    appReturnUrl?.trim() || `${env.APP_URL}/panel/configuracion`;
  const { url } = await buildMpAuthorizationUrl({
    tenantId,
    userId,
    appReturnUrl: returnTo,
  });
  return { url, oauthConfigured: isMpOAuthConfigured() };
}

export async function handleMpOAuthCallback(input: {
  code?: string;
  state?: string;
  error?: string;
}): Promise<{ redirectUrl: string }> {
  const env = getEnv();
  const fallback = `${env.APP_URL}/panel/configuracion`;

  if (input.error) {
    return {
      redirectUrl: `${fallback}?mp_error=${encodeURIComponent(input.error)}`,
    };
  }
  if (!input.code || !input.state) {
    return { redirectUrl: `${fallback}?mp_error=missing_params` };
  }

  try {
    const oauthState = await verifyMpOAuthState(input.state);
    if (oauthState.redirectUri !== resolveMpOAuthRedirectUri()) {
      return { redirectUrl: `${fallback}?mp_error=redirect_mismatch` };
    }
    const tokens = await exchangeMpCode(input.code, oauthState.redirectUri);
    const key = tokenKey();
    await upsertMpConexion(getDb(), oauthState.tenantId, {
      mpUserId: tokens.userId,
      accessTokenEncrypted: encryptSecret(tokens.accessToken, key),
      refreshTokenEncrypted: encryptSecret(tokens.refreshToken, key),
      expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
    });
    const dest = oauthState.appReturnUrl ?? fallback;
    const sep = dest.includes("?") ? "&" : "?";
    return { redirectUrl: `${dest}${sep}mp_linked=1` };
  } catch (err) {
    const msg = err instanceof HttpError ? err.code : "oauth_failed";
    return {
      redirectUrl: `${fallback}?mp_error=${encodeURIComponent(msg)}`,
    };
  }
}

export const connectMpSchema = z.object({
  accessToken: z.string().trim().min(10).max(500),
  refreshToken: z.string().trim().min(1).max(500).optional(),
  mpUserId: z.string().trim().max(80).optional().nullable(),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

export async function connectMp(
  tenantId: string,
  input: z.infer<typeof connectMpSchema>,
) {
  const key = tokenKey();
  const expiresAt = new Date(
    Date.now() + (input.expiresInDays ?? 365) * 24 * 3600_000,
  );
  await upsertMpConexion(getDb(), tenantId, {
    mpUserId: input.mpUserId ?? null,
    accessTokenEncrypted: encryptSecret(input.accessToken, key),
    refreshTokenEncrypted: encryptSecret(
      input.refreshToken ?? input.accessToken,
      key,
    ),
    expiresAt,
  });
  return getMpStatus(tenantId);
}

export async function disconnectMp(tenantId: string) {
  await deleteMpConexion(getDb(), tenantId);
  return getMpStatus(tenantId);
}

async function createMpPreference(input: {
  accessToken: string;
  title: string;
  amount: number;
  externalReference: string;
  notificationUrl: string;
  successUrl: string;
  failureUrl: string;
  /** Monto fijo ARS de comisión plataforma (Checkout Pro marketplace_fee) */
  marketplaceFee?: number;
}) {
  const env = getEnv();
  const fee =
    input.marketplaceFee != null && input.marketplaceFee > 0
      ? Math.round(input.marketplaceFee * 100) / 100
      : 0;

  if (env.mpMock || input.accessToken.startsWith("MOCK")) {
    const prefId = `MOCK-PREF-${input.externalReference.slice(0, 8)}`;
    const initPoint = `${env.apiPublicUrl}/public/pagos/mock-pay?ref=${encodeURIComponent(input.externalReference)}`;
    return { id: prefId, initPoint, marketplaceFee: fee };
  }

  const bodyPayload: Record<string, unknown> = {
    items: [
      {
        title: input.title,
        quantity: 1,
        currency_id: "ARS",
        unit_price: input.amount,
      },
    ],
    external_reference: input.externalReference,
    notification_url: input.notificationUrl,
    back_urls: {
      success: input.successUrl,
      failure: input.failureUrl,
      pending: input.failureUrl,
    },
    auto_return: "approved",
  };
  if (fee > 0) {
    bodyPayload.marketplace_fee = fee;
  }

  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(bodyPayload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new HttpError(
      502,
      "MP_PREFERENCE_FAILED",
      `MP preference: ${text.slice(0, 200)}`,
    );
  }
  const body = (await res.json()) as {
    id: string;
    init_point?: string;
    sandbox_init_point?: string;
  };
  return {
    id: body.id,
    initPoint: body.init_point ?? body.sandbox_init_point ?? "",
    marketplaceFee: fee,
  };
}

export const checkoutHoldSchema = z.object({
  clienteNombre: z.string().trim().min(2).max(120),
  clienteTelefono: z.string().trim().min(6).max(40),
  clienteEmail: z.string().trim().email().optional().nullable(),
});

/**
 * Crea pago pendiente + preferencia MP (o mock).
 * El hold sigue vigente hasta el webhook / mock-pay.
 */
export async function createCheckoutFromHold(
  salaId: string,
  sessionId: string,
  input: z.infer<typeof checkoutHoldSchema>,
) {
  const db = getDb();
  const env = getEnv();
  const now = new Date();
  const sala = await findSalaPublicaById(db, salaId);
  if (!sala) throw new HttpError(404, "NOT_FOUND", "Sala no encontrada");

  const hold = await findHoldBySession(db, salaId, sessionId, now);
  if (!hold) {
    throw new HttpError(404, "HOLD_GONE", "El hold expiró o no existe");
  }

  const politica = await getPoliticaBySede(db, sala.sedeId);
  const cliente = await upsertClienteByTelefono(db, sala.tenantId, {
    telefono: input.clienteTelefono,
    nombre: input.clienteNombre,
    email: input.clienteEmail,
  });

  await updateHoldReserva(db, hold.id, { clienteId: cliente.id });

  const precioTotal = String(hold.precioTotal);
  const senaPolitica = {
    senaModo: (politica?.senaModo ?? POLITICA_DEFAULTS.senaModo) as
      | "nunca"
      | "siempre"
      | "reincidentes",
    senaTipo: (politica?.senaTipo ?? POLITICA_DEFAULTS.senaTipo) as
      | "porcentaje"
      | "fijo",
    senaValor: String(politica?.senaValor ?? POLITICA_DEFAULTS.senaValor),
    clienteNoShowCount: cliente.noShowCount,
  };
  const senaMonto = calcularMontoSena(precioTotal, senaPolitica);
  const aPagar =
    Number(senaMonto) > 0 ? Number(senaMonto) : Number(precioTotal);
  if (!(aPagar > 0)) {
    throw new HttpError(400, "MONTO_CERO", "No hay monto a cobrar");
  }

  await updateHoldReserva(db, hold.id, {
    senaMonto: Number(senaMonto) > 0 ? senaMonto : "0",
  });

  const externalReference = `sy-${randomUUID()}`;
  const { token, source } = await resolveAccessToken(sala.tenantId);

  const feePercent = env.MP_MARKETPLACE_FEE_PERCENT;
  // Fee solo con cuenta del estudio (OAuth/tenant). En mock también si hay %.
  const applyFee =
    feePercent > 0 && (source === "tenant" || (env.mpMock && source === "mock"));
  const marketplaceFee = applyFee
    ? calcularMarketplaceFee(aPagar, feePercent)
    : 0;

  const bundle = await getNegocioBundle(db, sala.tenantId);
  const slug = bundle?.tenant.slug ?? "estudio";

  const pago = await insertPago(db, {
    tenantId: sala.tenantId,
    reservaId: hold.id,
    externalReference,
    estado: "pendiente",
    monto: aPagar.toFixed(2),
    marketplaceFee: marketplaceFee > 0 ? marketplaceFee.toFixed(2) : null,
    expiresAt: hold.holdExpiresAt,
  });

  const notificationUrl = `${env.apiPublicUrl}/webhooks/mercadopago`;
  const successUrl = `${env.APP_URL}/${slug}/sala/${sala.slug}?pago=ok&ref=${externalReference}`;
  const failureUrl = `${env.APP_URL}/${slug}/sala/${sala.slug}?pago=fail&ref=${externalReference}`;

  const pref = await createMpPreference({
    accessToken: token,
    title: `Seña · ${sala.name}`,
    amount: aPagar,
    externalReference,
    notificationUrl,
    successUrl,
    failureUrl,
    marketplaceFee,
  });

  await updatePago(db, pago.id, { mpPreferenceId: pref.id });

  return {
    pagoId: pago.id,
    externalReference,
    monto: aPagar,
    senaMonto: Number(senaMonto),
    marketplaceFee: pref.marketplaceFee,
    marketplaceFeePercent: applyFee ? feePercent : 0,
    initPoint: pref.initPoint,
    mock: env.mpMock,
  };
}

export async function applyPagoAprobado(input: {
  externalReference: string;
  mpPaymentId?: string | null;
}) {
  const db = getDb();
  const pago = await getPagoByExternalRef(db, input.externalReference);
  if (!pago) throw new HttpError(404, "PAGO_NOT_FOUND", "Pago no encontrado");
  if (pago.estado === "aprobado") {
    return {
      already: true as const,
      pagoId: pago.id,
      reservaId: pago.reservaId,
    };
  }

  await updatePago(db, pago.id, {
    estado: "aprobado",
    mpPaymentId: input.mpPaymentId ?? pago.mpPaymentId,
    paidAt: new Date(),
  });

  const reserva = await db.query.reservas.findFirst({
    where: (r, { eq }) => eq(r.id, pago.reservaId),
  });
  if (!reserva) {
    return {
      already: false as const,
      pagoId: pago.id,
      reservaId: pago.reservaId,
    };
  }

  const sessionId = reserva.holdSessionId;
  const senaMonto =
    Number(reserva.senaMonto) > 0 ? reserva.senaMonto : pago.monto;
  const esSena = Number(reserva.senaMonto) > 0 || Number(senaMonto) > 0;

  await updateHoldReserva(db, reserva.id, {
    estado: esSena ? "senada" : "confirmada",
    senaPagada: true,
    senaMonto: String(senaMonto),
    holdExpiresAt: null,
    holdSessionId: null,
  });

  await insertMovimiento(db, pago.tenantId, {
    tipo: esSena ? "sena" : "saldo",
    medioPago: "mercadopago",
    monto: String(pago.monto),
    reservaId: reserva.id,
    descripcion: `MP pago ${input.mpPaymentId ?? pago.id}`,
  });

  emitHoldRemovePublic({
    id: reserva.id,
    salaId: reserva.salaId,
    sessionId: sessionId ?? undefined,
  });

  if (reserva.clienteId) {
    const cliente = await db.query.clientes.findFirst({
      where: (c, { eq }) => eq(c.id, reserva.clienteId!),
      columns: { email: true, nombre: true },
    });
    if (cliente?.email) {
      await enqueueNotification({
        tenantId: pago.tenantId,
        eventType: esSena ? "sena.pagada" : "reserva.senada",
        payload: {
          reservaId: reserva.id,
          email: cliente.email,
          clienteNombre: cliente.nombre,
          monto: pago.monto,
          cancelUrl: cancelUrlForReserva(reserva.id),
          reprogramUrl: reprogramUrlForReserva(reserva.id),
        },
      });
    }
  }

  return {
    already: false as const,
    pagoId: pago.id,
    reservaId: pago.reservaId,
  };
}

export async function simulateMockPay(externalReference: string) {
  const env = getEnv();
  if (!env.mpMock) {
    throw new HttpError(403, "MOCK_DISABLED", "Simulación solo en MP_MOCK");
  }
  if (isSuscripcionExternalRef(externalReference)) {
    return applySuscripcionPagoAprobado({
      externalReference,
      mpPaymentId: `MOCK-SUB-PAY-${Date.now()}`,
    });
  }
  return applyPagoAprobado({
    externalReference,
    mpPaymentId: `MOCK-PAY-${Date.now()}`,
  });
}

export async function handleMpWebhook(input: {
  xSignature?: string;
  xRequestId?: string;
  dataId?: string;
  body: unknown;
}) {
  const env = getEnv();
  const body = input.body as {
    id?: string | number;
    type?: string;
    action?: string;
    data?: { id?: string };
    external_reference?: string;
  };

  const dataId =
    input.dataId ??
    (body.data?.id != null ? String(body.data.id) : undefined) ??
    (body.id != null ? String(body.id) : undefined);

  const eventId =
    (body.id != null ? String(body.id) : undefined) ??
    dataId ??
    `body-${JSON.stringify(body).slice(0, 80)}`;

  if (!env.mpMock) {
    if (!env.MP_WEBHOOK_SECRET) {
      throw new HttpError(500, "MP_WEBHOOK_SECRET", "Falta MP_WEBHOOK_SECRET");
    }
    const ok = verifyMpWebhookSignature({
      xSignature: input.xSignature,
      xRequestId: input.xRequestId,
      dataId,
      secret: env.MP_WEBHOOK_SECRET,
    });
    if (!ok) {
      throw new HttpError(401, "INVALID_SIGNATURE", "Firma webhook inválida");
    }
  }

  const db = getDb();
  const inserted = await tryInsertWebhookEvent(
    db,
    "mercadopago",
    eventId,
    JSON.stringify(body),
  );
  if (!inserted.inserted) {
    return { ok: true, duplicate: true };
  }

  if (body.external_reference) {
    if (isSuscripcionExternalRef(body.external_reference)) {
      await applySuscripcionPagoAprobado({
        externalReference: body.external_reference,
        mpPaymentId: dataId ?? null,
      });
    } else {
      await applyPagoAprobado({
        externalReference: body.external_reference,
        mpPaymentId: dataId ?? null,
      });
    }
    if (inserted.row) await markWebhookProcessed(db, inserted.row.id);
    return { ok: true, duplicate: false };
  }

  if (dataId && !env.mpMock && env.MP_ACCESS_TOKEN) {
    const payRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${dataId}`,
      { headers: { Authorization: `Bearer ${env.MP_ACCESS_TOKEN}` } },
    );
    if (payRes.ok) {
      const pay = (await payRes.json()) as {
        status?: string;
        external_reference?: string;
        id?: number;
      };
        if (pay.status === "approved" && pay.external_reference) {
          if (isSuscripcionExternalRef(pay.external_reference)) {
            await applySuscripcionPagoAprobado({
              externalReference: pay.external_reference,
              mpPaymentId: String(pay.id ?? dataId),
            });
            if (inserted.row) await markWebhookProcessed(db, inserted.row.id);
            return { ok: true, duplicate: false };
          }
          const pagoRow = await getPagoByExternalRef(db, pay.external_reference);
        if (pagoRow) {
          try {
            const { token } = await resolveAccessToken(pagoRow.tenantId);
            if (!token.startsWith("MOCK") && token !== env.MP_ACCESS_TOKEN) {
              const tenantPayRes = await fetch(
                `https://api.mercadopago.com/v1/payments/${dataId}`,
                { headers: { Authorization: `Bearer ${token}` } },
              );
              if (tenantPayRes.ok) {
                const tenantPay = (await tenantPayRes.json()) as {
                  status?: string;
                  external_reference?: string;
                  id?: number;
                };
                if (
                  tenantPay.status === "approved" &&
                  tenantPay.external_reference
                ) {
                  await applyPagoAprobado({
                    externalReference: tenantPay.external_reference,
                    mpPaymentId: String(tenantPay.id ?? dataId),
                  });
                  if (inserted.row)
                    await markWebhookProcessed(db, inserted.row.id);
                  return { ok: true, duplicate: false };
                }
              }
            }
          } catch {
            /* seguir con platform fetch */
          }
        }
        await applyPagoAprobado({
          externalReference: pay.external_reference,
          mpPaymentId: String(pay.id ?? dataId),
        });
      }
    }
  }

  if (inserted.row) await markWebhookProcessed(db, inserted.row.id);
  return { ok: true, duplicate: false };
}
