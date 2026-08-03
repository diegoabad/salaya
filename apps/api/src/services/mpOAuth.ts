import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { getEnv } from "../config/env";
import { HttpError } from "../middlewares/errorHandler";

const MP_AUTH_URL = "https://auth.mercadopago.com.ar/authorization";
const MP_TOKEN_URL = "https://api.mercadopago.com/oauth/token";

export type MpOAuthState = {
  nonce: string;
  tenantId: string;
  userId: string;
  redirectUri: string;
  appReturnUrl?: string;
};

export type MpOAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string | null;
  liveMode: boolean;
};

function secretKey() {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export function isMpOAuthConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.MP_CLIENT_ID?.trim() && env.MP_CLIENT_SECRET?.trim());
}

export function resolveMpOAuthRedirectUri(): string {
  const env = getEnv();
  if (env.MP_OAUTH_REDIRECT_URI?.trim()) {
    return env.MP_OAUTH_REDIRECT_URI.trim();
  }
  return `${env.apiPublicUrl}/mp/oauth/callback`;
}

export async function signMpOAuthState(payload: MpOAuthState): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secretKey());
}

export async function verifyMpOAuthState(state: string): Promise<MpOAuthState> {
  try {
    const { payload } = await jwtVerify(state, secretKey(), {
      algorithms: ["HS256"],
    });
    const nonce = payload.nonce;
    const tenantId = payload.tenantId;
    const userId = payload.userId;
    const redirectUri = payload.redirectUri;
    if (
      typeof nonce !== "string" ||
      typeof tenantId !== "string" ||
      typeof userId !== "string" ||
      typeof redirectUri !== "string"
    ) {
      throw new HttpError(400, "OAUTH_STATE", "Estado OAuth inválido");
    }
    return {
      nonce,
      tenantId,
      userId,
      redirectUri,
      appReturnUrl:
        typeof payload.appReturnUrl === "string"
          ? payload.appReturnUrl
          : undefined,
    };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(
      400,
      "OAUTH_STATE_EXPIRED",
      "El enlace de Mercado Pago expiró. Intentá de nuevo.",
    );
  }
}

export async function buildMpAuthorizationUrl(input: {
  tenantId: string;
  userId: string;
  appReturnUrl?: string;
}): Promise<{ url: string; redirectUri: string }> {
  const env = getEnv();
  const redirectUri = resolveMpOAuthRedirectUri();
  const state = await signMpOAuthState({
    nonce: randomUUID(),
    tenantId: input.tenantId,
    userId: input.userId,
    redirectUri,
    ...(input.appReturnUrl ? { appReturnUrl: input.appReturnUrl } : {}),
  });

  // Dev sin app MP: el callback mock completa la vinculación sin ir a MP.
  if (!isMpOAuthConfigured()) {
    if (!env.mpMock) {
      throw new HttpError(
        503,
        "MP_OAUTH_NOT_CONFIGURED",
        "Faltan MP_CLIENT_ID / MP_CLIENT_SECRET en el servidor",
      );
    }
    const url = new URL(`${env.apiPublicUrl}/mp/oauth/callback`);
    url.searchParams.set("code", "smoke-dev");
    url.searchParams.set("state", state);
    return { url: url.toString(), redirectUri };
  }

  const params = new URLSearchParams({
    client_id: env.MP_CLIENT_ID!,
    response_type: "code",
    platform_id: "mp",
    redirect_uri: redirectUri,
    state,
  });
  return {
    url: `${MP_AUTH_URL}?${params.toString()}`,
    redirectUri,
  };
}

export async function exchangeMpCode(
  code: string,
  redirectUri: string,
): Promise<MpOAuthTokens> {
  const env = getEnv();

  if (env.mpMock && (code === "smoke-dev" || code.startsWith("smoke-"))) {
    return {
      accessToken: `MOCK-OAUTH-AT-${code}`,
      refreshToken: `MOCK-OAUTH-RT-${code}`,
      expiresIn: 3600 * 24 * 30,
      userId: "mock-mp-user",
      liveMode: false,
    };
  }

  if (!isMpOAuthConfigured()) {
    throw new HttpError(
      503,
      "MP_OAUTH_NOT_CONFIGURED",
      "Faltan MP_CLIENT_ID / MP_CLIENT_SECRET",
    );
  }

  const body = new URLSearchParams({
    client_id: env.MP_CLIENT_ID!,
    client_secret: env.MP_CLIENT_SECRET!,
    grant_type: "authorization_code",
    code: code.trim(),
    redirect_uri: redirectUri,
  });

  const res = await fetch(MP_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user_id?: string | number;
    live_mode?: boolean;
    message?: string;
    error?: string;
  };

  if (!res.ok || !data.access_token || !data.refresh_token) {
    throw new HttpError(
      502,
      "MP_OAUTH_EXCHANGE",
      data.message || data.error || "Mercado Pago no devolvió credenciales",
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 15_552_000,
    userId: data.user_id != null ? String(data.user_id) : null,
    liveMode: data.live_mode === true,
  };
}

export async function refreshMpAccessToken(
  refreshToken: string,
): Promise<MpOAuthTokens> {
  const env = getEnv();

  if (env.mpMock && refreshToken.startsWith("MOCK-OAUTH-RT-")) {
    return {
      accessToken: `MOCK-OAUTH-AT-refreshed-${Date.now()}`,
      refreshToken,
      expiresIn: 3600 * 24 * 30,
      userId: "mock-mp-user",
      liveMode: false,
    };
  }

  if (!isMpOAuthConfigured()) {
    throw new HttpError(
      503,
      "MP_OAUTH_NOT_CONFIGURED",
      "Faltan MP_CLIENT_ID / MP_CLIENT_SECRET",
    );
  }

  const body = new URLSearchParams({
    client_id: env.MP_CLIENT_ID!,
    client_secret: env.MP_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: refreshToken.trim(),
  });

  const res = await fetch(MP_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user_id?: string | number;
    live_mode?: boolean;
    message?: string;
    error?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new HttpError(
      502,
      "MP_OAUTH_REFRESH",
      data.message || data.error || "No se pudo renovar el acceso a Mercado Pago",
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresIn: data.expires_in ?? 15_552_000,
    userId: data.user_id != null ? String(data.user_id) : null,
    liveMode: data.live_mode === true,
  };
}
