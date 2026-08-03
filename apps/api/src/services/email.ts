import { getLogger } from "../config/logger";
import { getEnv } from "../config/env";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

/** Últimos envíos mock (smoke / debug local) */
const mockSent: EmailMessage[] = [];

export function getMockSentEmails() {
  return [...mockSent];
}

export function clearMockSentEmails() {
  mockSent.length = 0;
}

function str(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.trim() ? v : null;
}

function reservaDetalleLines(payload: Record<string, unknown>): string[] {
  const sala = str(payload, "salaNombre");
  const fecha = str(payload, "fecha");
  const horaInicio = str(payload, "horaInicio");
  const horaFin = str(payload, "horaFin");
  const codigo = str(payload, "codigo");
  const sede = str(payload, "sedeNombre");
  const lines: string[] = [];
  if (sala) lines.push(`Sala: ${sala}`);
  if (sede) lines.push(`Estudio: ${sede}`);
  if (fecha && horaInicio && horaFin) {
    lines.push(`Turno: ${fecha} · ${horaInicio}–${horaFin}`);
  } else if (fecha) {
    lines.push(`Fecha: ${fecha}`);
  }
  if (codigo) lines.push(`Código: ${codigo}`);
  return lines;
}

function reservaDetalleHtml(payload: Record<string, unknown>): string {
  return reservaDetalleLines(payload)
    .map((l) => `<p>${l}</p>`)
    .join("");
}

export function buildEmailFromOutbox(input: {
  eventType: string;
  payload: Record<string, unknown>;
}): EmailMessage | null {
  const email = typeof input.payload.email === "string" ? input.payload.email : "";
  if (!email.includes("@")) return null;

  const nombre =
    typeof input.payload.clienteNombre === "string"
      ? input.payload.clienteNombre
      : "Hola";

  if (input.eventType === "reserva.cancelada") {
    const destino =
      typeof input.payload.destinoSena === "string"
        ? input.payload.destinoSena
        : null;
    const motivo =
      typeof input.payload.motivo === "string" ? input.payload.motivo : null;
    const text = [
      `${nombre},`,
      "",
      "Tu reserva fue cancelada.",
      destino ? `Seña: ${destino}.` : null,
      motivo ? `Motivo: ${motivo}` : null,
      "",
      "— SalaYa",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      to: email,
      subject: "Reserva cancelada",
      text,
      html: `<p>${nombre},</p><p>Tu reserva fue cancelada.</p>${
        destino ? `<p>Seña: ${destino}.</p>` : ""
      }${motivo ? `<p>Motivo: ${motivo}</p>` : ""}<p>— SalaYa</p>`,
    };
  }

  if (input.eventType === "reserva.senada" || input.eventType === "sena.pagada") {
    const monto =
      input.payload.monto != null ? String(input.payload.monto) : null;
    const detalle = reservaDetalleLines(input.payload);
    const cancelUrl = str(input.payload, "cancelUrl");
    const reprogramUrl = str(input.payload, "reprogramUrl");
    const text = [
      `${nombre},`,
      "",
      "Recibimos el pago de tu seña. La reserva quedó confirmada.",
      monto ? `Monto: $${monto}` : null,
      ...detalle,
      "",
      reprogramUrl
        ? `Si necesitás cambiar el turno (si el estudio lo permite): ${reprogramUrl}`
        : null,
      cancelUrl
        ? `Si necesitás cancelar (según la política del estudio): ${cancelUrl}`
        : null,
      "",
      "La política de cancelación y el destino de la seña los define el estudio. SalaYa no gestiona reembolsos ni se hace responsable de disputas entre el músico y la sala.",
      "",
      "— SalaYa",
    ]
      .filter((x) => x != null)
      .join("\n");
    return {
      to: email,
      subject: "Seña recibida — reserva confirmada",
      text,
      html: `<p>${nombre},</p><p>Recibimos el pago de tu seña. La reserva quedó confirmada.</p>${
        monto ? `<p>Monto: $${monto}</p>` : ""
      }${reservaDetalleHtml(input.payload)}${
        reprogramUrl
          ? `<p><a href="${reprogramUrl}">Reprogramar turno</a> (si el estudio lo permite)</p>`
          : ""
      }${
        cancelUrl
          ? `<p><a href="${cancelUrl}">Cancelar reserva</a> (sujeto a la política del estudio)</p>`
          : ""
      }<p style="color:#666;font-size:13px">La política de cancelación y el destino de la seña los define el estudio. SalaYa no gestiona reembolsos ni se hace responsable de disputas entre el músico y la sala.</p><p>— SalaYa</p>`,
    };
  }

  if (input.eventType === "reserva.confirmada") {
    const detalle = reservaDetalleLines(input.payload);
    const cancelUrl = str(input.payload, "cancelUrl");
    const reprogramUrl = str(input.payload, "reprogramUrl");
    const text = [
      `${nombre},`,
      "",
      "Tu reserva está confirmada.",
      ...detalle,
      "",
      reprogramUrl
        ? `Si necesitás cambiar el turno (si el estudio lo permite): ${reprogramUrl}`
        : null,
      cancelUrl
        ? `Si necesitás cancelar (según la política del estudio): ${cancelUrl}`
        : "Si necesitás cancelar, contactá al estudio.",
      "",
      "La política de cancelación y el destino de la seña los define el estudio. SalaYa no gestiona reembolsos ni se hace responsable de disputas entre el músico y la sala.",
      "",
      "— SalaYa",
    ]
      .filter((x) => x != null)
      .join("\n");
    return {
      to: email,
      subject: "Reserva confirmada",
      text,
      html: `<p>${nombre},</p><p>Tu reserva está confirmada.</p>${reservaDetalleHtml(
        input.payload,
      )}${
        reprogramUrl
          ? `<p><a href="${reprogramUrl}">Reprogramar turno</a> (si el estudio lo permite)</p>`
          : ""
      }${
        cancelUrl
          ? `<p><a href="${cancelUrl}">Cancelar reserva</a> (sujeto a la política del estudio)</p>`
          : "<p>Si necesitás cancelar, contactá al estudio.</p>"
      }<p style="color:#666;font-size:13px">La política de cancelación y el destino de la seña los define el estudio. SalaYa no gestiona reembolsos ni se hace responsable de disputas entre el músico y la sala.</p><p>— SalaYa</p>`,
    };
  }

  if (input.eventType === "reserva.recordatorio") {
    const detalle = reservaDetalleLines(input.payload);
    const cancelUrl = str(input.payload, "cancelUrl");
    const reprogramUrl = str(input.payload, "reprogramUrl");
    const text = [
      `${nombre},`,
      "",
      "Recordatorio: tenés una reserva próxima.",
      ...detalle,
      "",
      reprogramUrl ? `Reprogramar: ${reprogramUrl}` : null,
      cancelUrl ? `Cancelar: ${cancelUrl}` : null,
      "",
      "— SalaYa",
    ]
      .filter((x) => x != null)
      .join("\n");
    return {
      to: email,
      subject: "Recordatorio de tu reserva",
      text,
      html: `<p>${nombre},</p><p>Recordatorio: tenés una reserva próxima.</p>${reservaDetalleHtml(
        input.payload,
      )}${
        reprogramUrl
          ? `<p><a href="${reprogramUrl}">Reprogramar turno</a></p>`
          : ""
      }${
        cancelUrl ? `<p><a href="${cancelUrl}">Cancelar reserva</a></p>` : ""
      }<p>— SalaYa</p>`,
    };
  }

  if (input.eventType === "resena.invitar") {
    const sede =
      typeof input.payload.sedeNombre === "string"
        ? input.payload.sedeNombre
        : "el estudio";
    const inviteUrl = str(input.payload, "inviteUrl");
    const text = [
      `${nombre},`,
      "",
      `Te invitaron a dejar una reseña de ${sede}.`,
      inviteUrl ? `Dejá tu opinión acá: ${inviteUrl}` : null,
      "",
      "— SalaYa",
    ]
      .filter(Boolean)
      .join("\n");
    return {
      to: email,
      subject: `Contanos cómo te fue en ${sede}`,
      text,
      html: `<p>${nombre},</p><p>Te invitaron a dejar una reseña de <strong>${sede}</strong>.</p>${
        inviteUrl
          ? `<p><a href="${inviteUrl}">Escribir reseña</a></p>`
          : ""
      }<p>— SalaYa</p>`,
    };
  }

  // Genérico
  return {
    to: email,
    subject: `SalaYa · ${input.eventType}`,
    text: `${nombre},\n\nEvento: ${input.eventType}\n\n— SalaYa`,
  };
}

export async function sendEmail(message: EmailMessage): Promise<{
  provider: "mock" | "resend";
  id?: string;
}> {
  const env = getEnv();
  const from = env.emailFrom;

  if (env.emailMock || !env.RESEND_API_KEY) {
    mockSent.push(message);
    if (mockSent.length > 50) mockSent.shift();
    getLogger().info(
      { to: message.to, subject: message.subject },
      "email mock sent",
    );
    return { provider: "mock", id: `mock-${Date.now()}` };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html ?? message.text,
      ...(env.emailReplyTo ? { reply_to: env.emailReplyTo } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = (await res.json()) as { id?: string };
  return { provider: "resend", id: body.id };
}
