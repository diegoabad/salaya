/** Iconos de comodidades — estilo Lucide, trazo consistente. */

import type { ReactNode } from "react";

function fold(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

type IconProps = { className?: string };

const stroke = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Svg({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden
      {...stroke}
    >
      {children}
    </svg>
  );
}

function IconWifi({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 20h.01" />
      <path d="M2 8.82a15 15 0 0 1 20 0" />
      <path d="M5 12.859a10 10 0 0 1 14 0" />
      <path d="M8.5 16.429a5 5 0 0 1 7 0" />
    </Svg>
  );
}

function IconAc({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10 9.5 8 15l-1.8-.9" />
      <path d="m14 9.5 2 5.5 1.8-.9" />
      <path d="M17.5 5.5 19 3" />
      <path d="m6.5 5.5-1.5-2.5" />
      <path d="M12 9V3" />
      <path d="M12 15v6" />
      <path d="M8 12H3" />
      <path d="M21 12h-5" />
    </Svg>
  );
}

function IconParking({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </Svg>
  );
}

function IconSofa({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3" />
      <path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0Z" />
      <path d="M4 18v2" />
      <path d="M20 18v2" />
    </Svg>
  );
}

function IconBath({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10 4 8 6" />
      <path d="M17 19v2" />
      <path d="M2 12h20" />
      <path d="M7 19v2" />
      <path d="M9 5 7.621 3.621A2.121 2.121 0 0 0 4 5v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
    </Svg>
  );
}

function IconMic({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </Svg>
  );
}

function IconSpeaker({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <circle cx="12" cy="14" r="4" />
      <circle cx="12" cy="6" r="1" />
    </Svg>
  );
}

function IconCoffee({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M10 2v2" />
      <path d="M14 2v2" />
      <path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1" />
      <path d="M6 2v2" />
    </Svg>
  );
}

function IconShield({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </Svg>
  );
}

/** Huella — Lucide paw-print */
function IconPaw({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="11" cy="4" r="2" />
      <circle cx="18" cy="8" r="2" />
      <circle cx="20" cy="16" r="2" />
      <path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" />
    </Svg>
  );
}

function IconHeadphones({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
    </Svg>
  );
}

function IconDrum({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m2 10 8.5-5" />
      <path d="m13.5 5 8.5 5" />
      <ellipse cx="12" cy="11" rx="10" ry="3.5" />
      <path d="M2 11v5c0 2 4.5 3.5 10 3.5s10-1.5 10-3.5v-5" />
      <path d="M7 14v4" />
      <path d="M17 14v4" />
    </Svg>
  );
}

function IconPiano({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M6 5v8" />
      <path d="M10 5v8" />
      <path d="M14 5v8" />
      <path d="M18 5v8" />
      <path d="M4 19v-2" />
      <path d="M20 19v-2" />
    </Svg>
  );
}

function IconGuitar({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m11.9 12.1 4.514-4.514" />
      <path d="M20.1 2.3a1 1 0 0 0-1.4 0l-1.114 1.114A2 2 0 0 0 17 4.828v1.344a2 2 0 0 1-.586 1.414A2 2 0 0 1 17.828 7h1.344a2 2 0 0 0 1.414-.586L21.7 5.7a1 1 0 0 0 0-1.4z" />
      <path d="m6 16 2 2" />
      <path d="M4.2 19.8a1 1 0 1 0 1.4-1.4" />
      <circle cx="11.5" cy="11.5" r="2.5" />
      <path d="M9.7 9.7a6 6 0 0 0-7.1 7.1" />
      <path d="M14.3 14.3a6 6 0 0 1 7.1 7.1" />
    </Svg>
  );
}

function IconVideo({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </Svg>
  );
}

function IconTv({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect width="20" height="15" x="2" y="7" rx="2" ry="2" />
      <polyline points="17 2 12 7 7 2" />
    </Svg>
  );
}

function IconElevator({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="m9 10 3-3 3 3" />
      <path d="m9 14 3 3 3-3" />
    </Svg>
  );
}

/** Silla de ruedas — Lucide accessibility */
function IconAccessible({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="16" cy="4" r="1" />
      <path d="m18 19 1-7-6 1" />
      <path d="m5 8 3-3 5.5 3-2.36 3.5" />
      <path d="M4.24 14.5a5 5 0 0 0 6.88 6" />
      <path d="M13.76 17.5a5 5 0 0 0-6.88-6" />
    </Svg>
  );
}

function IconLockers({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 3v18" />
      <circle cx="8" cy="12" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12" r="0.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

function IconFridge({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="5" y="2" width="14" height="20" rx="2" />
      <path d="M5 10h14" />
      <path d="M9 6v2" />
      <path d="M9 14v2" />
    </Svg>
  );
}

function IconPlug({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a6 6 0 0 1-12 0V8Z" />
    </Svg>
  );
}

function IconMirror({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <path d="M9 7h.01" />
      <path d="M9 11h6" />
    </Svg>
  );
}

function IconSun({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </Svg>
  );
}

function IconMoon({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Svg>
  );
}

/** Cigarrillo tachado */
function IconNoSmoke({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M18 12H6a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h12" />
      <path d="M18 8a2 2 0 0 0-2-2h-1" />
      <path d="M22 8a2 2 0 0 0-2-2" />
      <path d="m2 2 20 20" />
    </Svg>
  );
}

function IconUsers({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

function IconClock({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </Svg>
  );
}

function IconSoundproof({ className }: IconProps) {
  return (
    <Svg className={className}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="22" x2="16" y1="9" y2="15" />
      <line x1="16" x2="22" y1="9" y2="15" />
    </Svg>
  );
}

function IconKey({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
      <path d="m21 2-9.6 9.6" />
      <circle cx="7.5" cy="15.5" r="5.5" />
    </Svg>
  );
}

function IconThermometer({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" />
    </Svg>
  );
}

function IconDroplet({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
    </Svg>
  );
}

function IconBluetooth({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="m7 7 10 10-5 5V2l5 5L7 17" />
    </Svg>
  );
}

function IconCard({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </Svg>
  );
}

function IconBike({ className }: IconProps) {
  return (
    <Svg className={className}>
      <circle cx="18.5" cy="17.5" r="3.5" />
      <circle cx="5.5" cy="17.5" r="3.5" />
      <circle cx="15" cy="5" r="1" />
      <path d="M12 17.5V14l-3-3 4-3 2 3h3" />
    </Svg>
  );
}

function IconLamp({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M12 12v6" />
      <path d="M9 18h6" />
      <path d="M8 6a4 4 0 0 1 8 0c0 1.5-.8 2.8-2 3.5L12 12 10 9.5C8.8 8.8 8 7.5 8 6Z" />
    </Svg>
  );
}

function IconMixer({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="7" cy="10" r="1.5" />
      <circle cx="12" cy="10" r="1.5" />
      <circle cx="17" cy="10" r="1.5" />
      <path d="M7 14v2" />
      <path d="M12 13v3" />
      <path d="M17 14v2" />
    </Svg>
  );
}

function IconMetro({ className }: IconProps) {
  return (
    <Svg className={className}>
      <rect x="4" y="3" width="16" height="16" rx="2" />
      <path d="M4 11h16" />
      <path d="M12 3v8" />
      <circle cx="8" cy="15" r="1" />
      <circle cx="16" cy="15" r="1" />
      <path d="m8 19-2 2" />
      <path d="m16 19 2 2" />
    </Svg>
  );
}

function IconCheck({ className }: IconProps) {
  return (
    <Svg className={className}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

const RULES: Array<{
  test: (f: string) => boolean;
  Icon: (p: IconProps) => ReactNode;
}> = [
  { test: (f) => /wifi|wi-fi|internet/.test(f), Icon: IconWifi },
  { test: (f) => /aire|ac\b|climatiz|ventil|split/.test(f), Icon: IconAc },
  { test: (f) => /estacion|parking|cochera|garage/.test(f), Icon: IconParking },
  { test: (f) => /espera|lounge|living|sofa|sillon/.test(f), Icon: IconSofa },
  { test: (f) => /bano|toilet|wc|sanitario|ducha/.test(f), Icon: IconBath },
  { test: (f) => /grabac|recording|mic|microfono/.test(f), Icon: IconMic },
  {
    test: (f) => /equipo|backline|pa\b|ampli|cabina|monitor de piso/.test(f),
    Icon: IconSpeaker,
  },
  { test: (f) => /cafe|coffee|barra|cocina|kitchen|mate/.test(f), Icon: IconCoffee },
  { test: (f) => /seguridad|candado|vigilancia|alarma/.test(f), Icon: IconShield },
  { test: (f) => /mascota|pet|perro|gato|animal/.test(f), Icon: IconPaw },
  { test: (f) => /piano|teclado|keyboard|midi/.test(f), Icon: IconPiano },
  { test: (f) => /bateria|drum|percusion/.test(f), Icon: IconDrum },
  { test: (f) => /guitarra|bajo|guitar/.test(f), Icon: IconGuitar },
  {
    test: (f) => /auricular|headphone|monitoreo|in-?ear/.test(f),
    Icon: IconHeadphones,
  },
  { test: (f) => /mezclador|mixer|consola|interfaz|interface/.test(f), Icon: IconMixer },
  { test: (f) => /video|film|streaming|camara/.test(f), Icon: IconVideo },
  { test: (f) => /\btv\b|televisor|pantalla|smart tv|proyector/.test(f), Icon: IconTv },
  { test: (f) => /ascensor|elevador|elevator/.test(f), Icon: IconElevator },
  {
    test: (f) => /accesib|rueda|discapacidad|silla de rueda/.test(f),
    Icon: IconAccessible,
  },
  { test: (f) => /locker|vestuario|guardarropa|casillero/.test(f), Icon: IconLockers },
  { test: (f) => /heladera|fridge|refriger|freezer/.test(f), Icon: IconFridge },
  { test: (f) => /agua|dispenser|bidon|hidrat/.test(f), Icon: IconDroplet },
  { test: (f) => /enchufe|corriente|toma|electri|220|potencia/.test(f), Icon: IconPlug },
  { test: (f) => /espejo|mirror|danza|baile/.test(f), Icon: IconMirror },
  {
    test: (f) => /terraza|patio|exterior|jardin|luz natural|ventana/.test(f),
    Icon: IconSun,
  },
  { test: (f) => /noche|nocturn|24\s*hs|24h|madrugada/.test(f), Icon: IconMoon },
  {
    test: (f) => /no\s*fumar|sin\s*humo|smoke|prohibido fumar/.test(f),
    Icon: IconNoSmoke,
  },
  { test: (f) => /banda|grupo|varios|capacidad|ensamble/.test(f), Icon: IconUsers },
  { test: (f) => /horario|flexible|turno|por hora/.test(f), Icon: IconClock },
  {
    test: (f) => /aislam|acustic|insonor|soundproof|silencio|tratamient/.test(f),
    Icon: IconSoundproof,
  },
  {
    test: (f) => /llave|acceso independ|entrada propia|key/.test(f),
    Icon: IconKey,
  },
  { test: (f) => /calefac|calenton|estufa|heating|termo/.test(f), Icon: IconThermometer },
  { test: (f) => /bluetooth|inalambr|wireless/.test(f), Icon: IconBluetooth },
  {
    test: (f) => /tarjeta|mercadopago|mp\b|debito|credito|pago/.test(f),
    Icon: IconCard,
  },
  { test: (f) => /bici|bicicleta|bike/.test(f), Icon: IconBike },
  {
    test: (f) => /luz|ilumin|led|lampara|focos/.test(f),
    Icon: IconLamp,
  },
  {
    test: (f) => /subte|colectivo|metro|transporte|bondi|tren/.test(f),
    Icon: IconMetro,
  },
];

/** Presets para el editor: el `label` hace match con el icono en la ficha pública. */
export const AMENIDAD_ICON_PRESETS = [
  { id: "wifi", label: "WiFi", Icon: IconWifi },
  { id: "aire", label: "Aire acondicionado", Icon: IconAc },
  { id: "calefaccion", label: "Calefacción", Icon: IconThermometer },
  { id: "estacionamiento", label: "Estacionamiento", Icon: IconParking },
  { id: "bici", label: "Bicicletero", Icon: IconBike },
  { id: "espera", label: "Sala de espera", Icon: IconSofa },
  { id: "bano", label: "Baño", Icon: IconBath },
  { id: "grabacion", label: "Grabación", Icon: IconMic },
  { id: "equipo", label: "Equipamiento / PA", Icon: IconSpeaker },
  { id: "mixer", label: "Consola / mixer", Icon: IconMixer },
  { id: "guitarra", label: "Guitarra / bajo", Icon: IconGuitar },
  { id: "piano", label: "Piano / teclado", Icon: IconPiano },
  { id: "bateria", label: "Batería", Icon: IconDrum },
  { id: "auriculares", label: "Auriculares / monitoreo", Icon: IconHeadphones },
  { id: "aislamiento", label: "Aislamiento acústico", Icon: IconSoundproof },
  { id: "video", label: "Video / streaming", Icon: IconVideo },
  { id: "tv", label: "TV / pantalla", Icon: IconTv },
  { id: "iluminacion", label: "Iluminación", Icon: IconLamp },
  { id: "cafe", label: "Café / cocina", Icon: IconCoffee },
  { id: "heladera", label: "Heladera", Icon: IconFridge },
  { id: "agua", label: "Agua / dispenser", Icon: IconDroplet },
  { id: "seguridad", label: "Seguridad", Icon: IconShield },
  { id: "llave", label: "Acceso independiente", Icon: IconKey },
  { id: "mascotas", label: "Pet friendly", Icon: IconPaw },
  { id: "ascensor", label: "Ascensor", Icon: IconElevator },
  { id: "accesible", label: "Accesible", Icon: IconAccessible },
  { id: "lockers", label: "Lockers / vestuario", Icon: IconLockers },
  { id: "enchufes", label: "Enchufes / potencia", Icon: IconPlug },
  { id: "bluetooth", label: "Bluetooth", Icon: IconBluetooth },
  { id: "espejos", label: "Espejos", Icon: IconMirror },
  { id: "terraza", label: "Terraza / exterior", Icon: IconSun },
  { id: "transporte", label: "Cerca del transporte", Icon: IconMetro },
  { id: "nocturno", label: "Horario nocturno", Icon: IconMoon },
  { id: "flexible", label: "Horario flexible", Icon: IconClock },
  { id: "nofumar", label: "No fumar", Icon: IconNoSmoke },
  { id: "grupos", label: "Ideal para bandas", Icon: IconUsers },
  { id: "pago", label: "Pago con tarjeta", Icon: IconCard },
] as const;

export type AmenidadIconPresetId = (typeof AMENIDAD_ICON_PRESETS)[number]["id"];

export function AmenidadIcon({
  name,
  className = "shrink-0",
}: {
  name: string;
  className?: string;
}) {
  const f = fold(name);
  const match = RULES.find((r) => r.test(f));
  const Icon = match?.Icon ?? IconCheck;
  return <Icon className={className} />;
}
