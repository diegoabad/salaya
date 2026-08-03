import type { PanelNavIcon } from "./panel-nav";

export function PanelNavIconSvg({
  name,
  className,
}: {
  name: PanelNavIcon;
  className?: string;
}) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "hoy":
      /* Calendario / agenda */
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 3v4M16 3v4" />
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
        </svg>
      );
    case "estudio":
      /* Local / tienda del estudio */
      return (
        <svg {...props}>
          <path d="M3 10.5 12 4l9 6.5" />
          <path d="M5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9" />
          <path d="M9 20v-5h6v5" />
        </svg>
      );
    case "salas":
      /* Puerta / sala */
      return (
        <svg {...props}>
          <path d="M14 20V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14" />
          <path d="M14 12h6a1 1 0 0 1 1 1v7" />
          <path d="M3 20h18" />
          <path d="M10 12h.01" />
        </svg>
      );
    case "clientes":
      /* Persona */
      return (
        <svg {...props}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1-3.5 3.5-5.5 7-5.5s6 2 7 5.5" />
        </svg>
      );
    case "equipo":
      /* Varias personas */
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="3.5" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "caja":
      /* Caja registradora / billete */
      return (
        <svg {...props}>
          <rect x="2" y="7" width="20" height="13" rx="2" />
          <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
          <path d="M2 12h20" />
          <path d="M12 12v8" />
        </svg>
      );
    case "adicionales":
      /* Paquete / extra */
      return (
        <svg {...props}>
          <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" />
          <path d="M12 22V12" />
          <path d="m3.3 7 8.7 5 8.7-5" />
          <path d="m7.5 4.2 9 5.2" />
        </svg>
      );
    case "membresias":
      /* Credencial / abono */
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="12" r="2.5" />
          <path d="M14 10h5M14 14h4" />
        </svg>
      );
    case "bloqueos":
      /* Candado */
      return (
        <svg {...props}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
          <path d="M12 15v2" />
        </svg>
      );
    case "precios":
      /* Signo $ */
      return (
        <svg {...props}>
          <path d="M12 2v20" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case "promos":
      /* Etiqueta de oferta */
      return (
        <svg {...props}>
          <path d="M12.7 2.3 21.7 11.3a1 1 0 0 1 0 1.4l-8.5 8.5a1 1 0 0 1-1.4 0L2.3 11.7A2 2 0 0 1 2 10.3V4a2 2 0 0 1 2-2h6.3a2 2 0 0 1 1.4.6z" />
          <circle cx="7.5" cy="7.5" r="1.2" />
        </svg>
      );
    case "resenas":
      /* Estrella */
      return (
        <svg {...props}>
          <path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.8 7.2 18.4l.9-5.4-3.9-3.8 5.4-.8L12 3.5z" />
        </svg>
      );
    case "plan":
      /* Corona / plan */
      return (
        <svg {...props}>
          <path d="m2 8 4.5 3L9 5l3 6 3-6 2.5 6L22 8l-2 12H4L2 8z" />
          <path d="M6 20h12" />
        </svg>
      );
    case "config":
      /* Engranaje */
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
  }
}
