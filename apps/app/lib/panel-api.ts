import { auth } from "@/auth";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type PanelApiError = { ok: false; error: string; status: number };
export type PanelApiOk<T> = { ok: true; data: T };

export async function panelApiFetch<T>(
  path: string,
  init?: RequestInit & { requireTenant?: boolean },
): Promise<PanelApiOk<T> | PanelApiError> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "Tenés que iniciar sesión", status: 401 };
  }

  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    return { ok: false, error: "Falta INTERNAL_API_SECRET", status: 500 };
  }

  const requireTenant = init?.requireTenant !== false;
  if (requireTenant && !session.user.tenantId) {
    return { ok: false, error: "Sesión sin estudio", status: 403 };
  }

  const headers = new Headers(init?.headers);
  headers.set("x-internal-secret", secret);
  headers.set("x-user-id", session.user.id);
  if (session.user.tenantId) {
    headers.set("x-tenant-id", session.user.tenantId);
  }
  if (init?.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    return {
      ok: false,
      error: body?.error?.message ?? `Error ${res.status}`,
      status: res.status,
    };
  }

  if (res.status === 204) {
    return { ok: true, data: undefined as T };
  }

  const data = (await res.json()) as T;
  return { ok: true, data };
}
