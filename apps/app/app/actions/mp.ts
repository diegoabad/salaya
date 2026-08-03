"use server";

import { panelApiFetch } from "@/lib/panel-api";
import { revalidatePath } from "next/cache";

export type MpStatusDto = {
  mock: boolean;
  oauthConfigured: boolean;
  oauthAvailable: boolean;
  connected: boolean;
  tenantConnected: boolean;
  mpUserId: string | null;
  expiresAt: string | null;
  marketplaceFeePercent: number;
  marketplaceFeeEnabled: boolean;
};

export async function fetchMpStatus() {
  const res = await panelApiFetch<MpStatusDto>("/mp/status");
  return res.ok ? res.data : null;
}

export async function startMpOAuthAction(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const res = await panelApiFetch<{ url: string }>("/mp/oauth/link", {
    method: "POST",
    body: JSON.stringify({
      returnTo: `${process.env.AUTH_URL ?? "http://localhost:3000"}/panel/configuracion`,
    }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, url: res.data.url };
}

export async function connectMpAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const accessToken = String(formData.get("accessToken") ?? "").trim();
  if (accessToken.length < 10) {
    return { ok: false, error: "Pegá un access token válido de MP" };
  }
  const res = await panelApiFetch("/mp/connect", {
    method: "POST",
    body: JSON.stringify({ accessToken }),
  });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/configuracion");
  return { ok: true };
}

export async function disconnectMpAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const res = await panelApiFetch("/mp/connect", { method: "DELETE" });
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/panel/configuracion");
  return { ok: true };
}
