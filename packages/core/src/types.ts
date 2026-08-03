import type { DiaSemana, Money } from "@repo/shared";

export type Intervalo = {
  startsAt: Date;
  endsAt: Date;
};

export type HorarioAtencion = {
  dayOfWeek: DiaSemana;
  startTime: string;
  endTime: string;
};

export type ReglaPrecio = {
  id: string;
  /** continuo = semanal; puntual = relámpago / fechas concretas */
  tipo: "continuo" | "puntual";
  nombre?: string | null;
  daysOfWeek: DiaSemana[];
  /** null = todo el día */
  startTime: string | null;
  endTime: string | null;
  /** YYYY-MM-DD local; puntual requiere rango; continuo opcional como vigencia */
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  precioPorHora: Money;
  /** Solo display; el cobro usa precioPorHora */
  descuentoPorcentaje?: Money | null;
  active: boolean;
};

export type Bloqueo = {
  salaId: string | null;
  sedeId: string;
  startsAt: Date;
  endsAt: Date;
};

export type ReservaActiva = {
  id: string;
  salaId: string;
  startsAt: Date;
  endsAt: Date;
  estado: string;
};

export type AdicionalPedido = {
  adicionalId: string;
  cantidad: number;
  stock: number | null;
};

export type UsoAdicional = {
  adicionalId: string;
  cantidad: number;
  startsAt: Date;
  endsAt: Date;
};

export type PoliticaSenaInput = {
  senaModo: "nunca" | "siempre" | "reincidentes";
  senaTipo: "porcentaje" | "fijo";
  senaValor: Money;
  clienteNoShowCount: number;
};

export type PoliticaCancelacionInput = {
  cancelacionVentanaHoras: number;
  senaDestinoCancelacion: "devolver" | "credito" | "perder";
  permiteReprogramar: boolean;
};

export type PoliticaDuracion = {
  duracionMinMinutos: number;
  /** null = sin tope máximo */
  duracionMaxMinutos: number | null;
  granularidadMinutos: number;
};

/** Override de un día puntual; si closed, la sede no atiende. */
export type HorarioEspecial = {
  /** YYYY-MM-DD en hora local de la sede */
  fecha: string;
  closed: boolean;
  startTime: string | null;
  endTime: string | null;
};
