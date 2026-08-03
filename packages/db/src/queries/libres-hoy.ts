import {
  AR_UTC_OFFSET_MINUTES,
  localParts,
  parseTimeToMinutes,
} from "@repo/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../client";
import { salas, sedes } from "../schema";
import { listOcupacionDia } from "./holds";
import {
  listHorariosAtencionSede,
  listHorariosEspecialesSede,
} from "./horarios";

function arDayBounds(fechaYYYYMMDD: string) {
  const [y, mo, d] = fechaYYYYMMDD.split("-").map(Number);
  const start = new Date(Date.UTC(y!, mo! - 1, d!, 3, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function rangeToHourStarts(startsAt: Date, endsAt: Date): number[] {
  const out: number[] = [];
  for (let t = startsAt.getTime(); t < endsAt.getTime(); t += 60 * 60 * 1000) {
    const parts = localParts(new Date(t), AR_UTC_OFFSET_MINUTES);
    out.push(parts.minutes);
  }
  return out;
}

function openWindowsForDay(input: {
  dayOfWeek: number;
  especial?: {
    closed: boolean;
    startTime: string | null;
    endTime: string | null;
  } | null;
  horarios: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
}): Array<{ startMin: number; endMin: number }> {
  if (input.especial) {
    if (input.especial.closed) return [];
    if (!input.especial.startTime || !input.especial.endTime) return [];
    return [
      {
        startMin: parseTimeToMinutes(input.especial.startTime),
        endMin: parseTimeToMinutes(input.especial.endTime),
      },
    ];
  }
  return input.horarios
    .filter((x) => x.dayOfWeek === input.dayOfWeek)
    .map((h) => ({
      startMin: parseTimeToMinutes(h.startTime),
      endMin: parseTimeToMinutes(h.endTime),
    }));
}

/** Cuenta slots de 1h libres hoy (desde ahora si es hoy) sumando salas activas */
export async function countLibresHoyTenant(
  db: Database,
  tenantId: string,
): Promise<number> {
  const now = new Date();
  const parts = localParts(now, AR_UTC_OFFSET_MINUTES);
  const fecha = parts.dateKey;
  const nowMin = parts.minutes;
  const dayOfWeek = parts.dayOfWeek;

  const sede = await db.query.sedes.findFirst({
    where: and(eq(sedes.tenantId, tenantId), eq(sedes.active, true)),
    orderBy: (s, { asc }) => [asc(s.createdAt)],
  });
  if (!sede) return 0;

  const [horarios, especiales, salasRows] = await Promise.all([
    listHorariosAtencionSede(db, tenantId, sede.id),
    listHorariosEspecialesSede(db, tenantId, sede.id, fecha, fecha),
    db
      .select({ id: salas.id })
      .from(salas)
      .where(
        and(
          eq(salas.tenantId, tenantId),
          eq(salas.sedeId, sede.id),
          eq(salas.active, true),
          isNull(salas.deletedAt),
        ),
      ),
  ]);

  const wins = openWindowsForDay({
    dayOfWeek,
    especial: especiales[0]
      ? {
          closed: especiales[0].closed,
          startTime: especiales[0].startTime,
          endTime: especiales[0].endTime,
        }
      : null,
    horarios,
  });
  if (wins.length === 0 || salasRows.length === 0) return 0;

  const { start, end } = arDayBounds(fecha);
  let total = 0;

  for (const sala of salasRows) {
    const ocupacion = await listOcupacionDia(db, sala.id, start, end);
    const ocupadas = new Set<number>();
    for (const r of ocupacion) {
      for (const m of rangeToHourStarts(r.startsAt, r.endsAt)) {
        ocupadas.add(m);
      }
    }
    for (const win of wins) {
      for (let m = win.startMin; m < win.endMin; m += 60) {
        if (m <= nowMin) continue;
        if (!ocupadas.has(m)) total += 1;
      }
    }
  }

  return total;
}
