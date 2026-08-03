export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export class SlotOcupadoError extends DomainError {
  constructor(message = "El horario no está disponible") {
    super("SLOT_OCUPADO", message);
    this.name = "SlotOcupadoError";
  }
}

export class FueraDeHorarioError extends DomainError {
  constructor(message = "Fuera del horario de atención") {
    super("FUERA_DE_HORARIO", message);
    this.name = "FueraDeHorarioError";
  }
}

export class DuracionInvalidaError extends DomainError {
  constructor(message: string) {
    super("DURACION_INVALIDA", message);
    this.name = "DuracionInvalidaError";
  }
}

export class StockAdicionalError extends DomainError {
  constructor(message = "Stock de adicional insuficiente") {
    super("STOCK_ADICIONAL", message);
    this.name = "StockAdicionalError";
  }
}

export class PrecioNoDefinidoError extends DomainError {
  constructor(message = "No hay regla de precio para ese horario") {
    super("PRECIO_NO_DEFINIDO", message);
    this.name = "PrecioNoDefinidoError";
  }
}

export class CancelacionNoPermitidaError extends DomainError {
  constructor(message: string) {
    super("CANCELACION_NO_PERMITIDA", message);
    this.name = "CancelacionNoPermitidaError";
  }
}
