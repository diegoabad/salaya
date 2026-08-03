export type HoldPublic = {
  id: string;
  salaId: string;
  sessionId: string;
  fecha: string;
  horas: string[];
  expiresAt: string;
  precioTotal?: number;
  precioSala?: number;
  precioAdicionales?: number;
};

export type ReglaPublica = {
  tipo: "continuo" | "puntual";
  nombre: string | null;
  daysOfWeek: number[];
  startTime: string | null;
  endTime: string | null;
  fechaDesde: string | null;
  fechaHasta: string | null;
  precioPorHora: number;
  descuentoPorcentaje: number | null;
};

export type HorarioPublico = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type PoliticaPublica = {
  holdMinutos: number;
  senaModo: "nunca" | "siempre" | "reincidentes";
  senaTipo: "porcentaje" | "fijo";
  senaValor: string;
  precioHora: number;
  reglas: ReglaPublica[];
  horarios: HorarioPublico[];
  cancelacionVentanaHoras: number;
  senaDestinoCancelacion: "devolver" | "credito" | "perder";
  permiteReprogramar: boolean;
};

const SESSION_KEY = "salaya_hold_session";

export function getHoldSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = window.localStorage.getItem(SESSION_KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function apiBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
    "http://localhost:4000"
  );
}

export async function fetchHolds(salaId: string, fecha?: string) {
  const q = fecha ? `?fecha=${encodeURIComponent(fecha)}` : "";
  const res = await fetch(`${apiBaseUrl()}/public/salas/${encodeURIComponent(salaId)}/holds${q}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("No se pudieron cargar los holds");
  return res.json() as Promise<PoliticaPublica & { holds: HoldPublic[] }>;
}

export async function putHold(
  salaId: string,
  body: {
    fecha: string;
    horas: string[];
    adicionales?: { id: string; cantidad: number }[];
  },
): Promise<HoldPublic> {
  const res = await fetch(
    `${apiBaseUrl()}/public/salas/${encodeURIComponent(salaId)}/holds`,
    {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Hold-Session": getHoldSessionId(),
      },
      body: JSON.stringify(body),
    },
  );
  const data = (await res.json()) as {
    hold?: HoldPublic;
    error?: { code: string; message: string; details?: { horas?: string[] } };
  };
  if (!res.ok) {
    const err = new Error(data.error?.message ?? "Error al reservar horarios") as Error & {
      code?: string;
      horas?: string[];
    };
    err.code = data.error?.code;
    err.horas = data.error?.details?.horas;
    throw err;
  }
  return data.hold!;
}

export async function deleteHold(salaId: string): Promise<void> {
  await fetch(
    `${apiBaseUrl()}/public/salas/${encodeURIComponent(salaId)}/holds`,
    {
      method: "DELETE",
      credentials: "include",
      headers: { "X-Hold-Session": getHoldSessionId() },
    },
  );
}

export async function confirmHold(input: {
  salaId: string;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail?: string;
  pagoOk?: boolean;
}): Promise<{
  id: string;
  codigo: string;
  estado: string;
  precioTotal: number;
  senaMonto: number;
  senaPagada: boolean;
}> {
  const res = await fetch(
    `${apiBaseUrl()}/public/salas/${encodeURIComponent(input.salaId)}/holds/confirm`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Hold-Session": getHoldSessionId(),
      },
      body: JSON.stringify({
        clienteNombre: input.clienteNombre,
        clienteTelefono: input.clienteTelefono,
        clienteEmail: input.clienteEmail ?? null,
        pagoOk: input.pagoOk ?? true,
      }),
    },
  );
  const data = (await res.json()) as {
    id?: string;
    codigo?: string;
    estado?: string;
    precioTotal?: number;
    senaMonto?: number;
    senaPagada?: boolean;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message ?? "No se pudo confirmar la reserva");
  }
  return {
    id: data.id!,
    codigo: data.codigo!,
    estado: data.estado!,
    precioTotal: data.precioTotal!,
    senaMonto: data.senaMonto!,
    senaPagada: data.senaPagada!,
  };
}

/** Checkout MP: crea preferencia y devuelve initPoint (mock o real) */
export async function checkoutHold(input: {
  salaId: string;
  clienteNombre: string;
  clienteTelefono: string;
  clienteEmail?: string;
}): Promise<{
  pagoId: string;
  externalReference: string;
  monto: number;
  initPoint: string;
  mock: boolean;
}> {
  const res = await fetch(
    `${apiBaseUrl()}/public/salas/${encodeURIComponent(input.salaId)}/holds/checkout`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Hold-Session": getHoldSessionId(),
      },
      body: JSON.stringify({
        clienteNombre: input.clienteNombre,
        clienteTelefono: input.clienteTelefono,
        clienteEmail: input.clienteEmail ?? null,
      }),
    },
  );
  const data = (await res.json()) as {
    pagoId?: string;
    externalReference?: string;
    monto?: number;
    initPoint?: string;
    mock?: boolean;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message ?? "No se pudo iniciar el pago");
  }
  return {
    pagoId: data.pagoId!,
    externalReference: data.externalReference!,
    monto: data.monto!,
    initPoint: data.initPoint!,
    mock: Boolean(data.mock),
  };
}

export async function fetchOcupacion(salaId: string, fecha: string) {
  const res = await fetch(
    `${apiBaseUrl()}/public/salas/${encodeURIComponent(salaId)}/holds/ocupacion?fecha=${encodeURIComponent(fecha)}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("No se pudo cargar ocupación");
  return res.json() as Promise<{ fecha: string; horas: string[] }>;
}

export type AdicionalPublicoGrupo = {
  id: string;
  name: string;
  items: Array<{
    id: string;
    name: string;
    precioBase: number;
    modalidad: "por_hora" | "por_reserva";
    stock: number | null;
  }>;
};

export async function fetchAdicionalesPublicos(salaId: string) {
  const res = await fetch(
    `${apiBaseUrl()}/public/salas/${encodeURIComponent(salaId)}/holds/adicionales`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("No se pudieron cargar adicionales");
  return res.json() as Promise<{ grupos: AdicionalPublicoGrupo[] }>;
}
