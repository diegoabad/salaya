/**
 * Formato de domicilio para directorio:
 *   "Calle Nro, Localidad, CABA|Provincia"
 * Siempre prioriza calle + número.
 */

export type AddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

export type AddressDetails = {
  formattedAddress?: string | null;
  barrio?: string | null;
  addressComponents?: AddressComponent[] | null;
};

export type AddressRegion = "caba" | "zonas" | "interior";

export function compText(
  components: AddressComponent[] | null | undefined,
  ...types: string[]
): string | null {
  if (!components?.length) return null;
  for (const t of types) {
    const c = components.find((x) => x.types?.includes(t));
    const text = c?.longText?.trim() || c?.shortText?.trim();
    if (text) return text;
  }
  return null;
}

export function compShort(
  components: AddressComponent[] | null | undefined,
  ...types: string[]
): string | null {
  if (!components?.length) return null;
  for (const t of types) {
    const c = components.find((x) => x.types?.includes(t));
    const text = c?.shortText?.trim() || c?.longText?.trim();
    if (text) return text;
  }
  return null;
}

/** Solo dígitos(+letra) del street_number (Google a veces mete CP: "3522, C1192AAF") */
export function cleanStreetNumber(raw: string | null): string | null {
  if (!raw) return null;
  const m = raw.trim().match(/^\d+[A-Za-z]?/);
  return m?.[0] ?? null;
}

function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function isCabaAdmin(
  admin1: string | null,
  localityShort: string | null,
): boolean {
  if (admin1 && /ciudad aut[oó]noma|caba/i.test(admin1)) return true;
  if (localityShort && /^caba$/i.test(localityShort)) return true;
  return false;
}

/**
 * Localidad visible:
 * - CABA → barrio (sublocality)
 * - GBA/interior → locality (ciudad)
 */
function placeLabel(
  comps: AddressComponent[] | null | undefined,
  barrioHint: string | null,
  caba: boolean,
): string | null {
  if (barrioHint?.trim()) return barrioHint.trim();
  if (caba) {
    const b = compText(
      comps,
      "sublocality_level_1",
      "sublocality",
      "neighborhood",
    );
    if (b) return b;
    const loc = compText(comps, "locality");
    if (loc && !/^[A-Z]?\d{4}/i.test(loc) && !/^caba$/i.test(loc)) return loc;
    return null;
  }
  const locality = compText(comps, "locality");
  if (locality && !/^[A-Z]?\d{4}/i.test(locality)) return locality;
  return (
    compText(comps, "administrative_area_level_2") ||
    compText(comps, "sublocality_level_1", "sublocality", "neighborhood")
  );
}

function regionLabel(
  comps: AddressComponent[] | null | undefined,
  region: AddressRegion,
  caba: boolean,
): string {
  if (caba) return "CABA";
  const admin1 = compText(comps, "administrative_area_level_1");
  if (admin1) {
    if (/ciudad aut[oó]noma/i.test(admin1)) return "CABA";
    return admin1.replace(/^Provincia de\s+/i, "").trim() || admin1;
  }
  if (region === "caba") return "CABA";
  if (region === "zonas") return "Buenos Aires";
  return "Argentina";
}

/**
 * Extrae "Calle Nro" desde components o, si falta el nro, desde formattedAddress.
 */
export function streetAndNumber(
  d: AddressDetails | null | undefined,
): string | null {
  const comps = d?.addressComponents ?? null;
  const route = compText(comps, "route");
  const nro = cleanStreetNumber(compText(comps, "street_number"));
  const raw = d?.formattedAddress ?? "";

  if (route && nro) return `${route} ${nro}`;

  if (route && raw) {
    // Buscar "Route 1234" o "Route 1234," en el formatted
    const esc = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = raw.match(new RegExp(`${esc}\\s+(\\d+[A-Za-z]?)`, "i"));
    if (m?.[1]) return `${route} ${m[1]}`;
  }

  if (route) return route; // sin número disponible

  // Sin route: primer tramo tipo "Calle 123" o "Av. Foo 45"
  const first = raw.split(",")[0]?.trim() ?? "";
  const m = first.match(
    /^((?:Av\.?|Avenida|Calle|Pasaje|Pje\.?|Diagonal|Dr\.?|Gral\.?|General)\s+)?(.+?)\s+(\d+[A-Za-z]?)\s*$/i,
  );
  if (m) {
    const prefix = (m[1] ?? "").trim();
    const name = (m[2] ?? "").trim();
    const num = m[3]!;
    if (name && !/^[A-Z]?\d{4}/i.test(name)) {
      return `${prefix ? prefix + " " : ""}${name} ${num}`.replace(/\s+/g, " ");
    }
  }
  // "Lezica 4268"
  const m2 = first.match(/^([A-Za-zÁÉÍÓÚÑáéíóúñ .'-]+?)\s+(\d+[A-Za-z]?)$/);
  if (m2 && m2[1]!.trim().length > 2) {
    return `${m2[1]!.trim()} ${m2[2]}`;
  }

  return null;
}

/**
 * Calle Nro, Localidad, CABA|Provincia
 */
export function formatAddressClean(
  d: AddressDetails | null | undefined,
  opts: {
    region: AddressRegion;
    barrioHint?: string | null;
  },
): string | null {
  const comps = d?.addressComponents ?? null;
  const admin1 = compText(comps, "administrative_area_level_1");
  const localityShort = compShort(comps, "locality");
  const caba =
    isCabaAdmin(admin1, localityShort) ||
    (opts.region === "caba" && !admin1);

  const street = streetAndNumber(d);
  const place = placeLabel(comps, opts.barrioHint ?? d?.barrio ?? null, caba);
  const region = regionLabel(comps, opts.region, caba);

  if (street) {
    const parts: string[] = [street];
    if (place && fold(place) !== fold(region)) parts.push(place);
    if (region && (!place || fold(place) !== fold(region))) parts.push(region);
    else if (region && place && fold(place) === fold(region)) {
      return `${street}, ${region}`;
    }
    return parts.join(", ");
  }

  if (place && region && fold(place) !== fold(region)) {
    return `${place}, ${region}`;
  }
  if (place) return place;
  if (region && region !== "Argentina") return region;

  return scrubFormatted(d?.formattedAddress ?? null, region);
}

function scrubFormatted(
  raw: string | null,
  regionFallback: string,
): string | null {
  if (!raw?.trim()) return null;
  let s = raw.trim();
  s = s.replace(/,?\s*Argentina\s*$/i, "");
  s = s.replace(/\b[A-Z]?\d{4}[A-Z]{0,3}\b/gi, "");
  s = s.replace(/Cdad\.\s*Aut[oó]noma de Buenos Aires/gi, "CABA");
  s = s.replace(/Ciudad Aut[oó]noma de Buenos Aires/gi, "CABA");
  s = s.replace(/,\s*,+/g, ",").replace(/\s+,/g, ",").replace(/,\s*$/g, "");
  s = s.replace(/\s{2,}/g, " ").trim();
  if (!s) return regionFallback !== "Argentina" ? regionFallback : null;
  return s;
}
