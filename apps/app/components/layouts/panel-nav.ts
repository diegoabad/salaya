export type PanelNavItem = {
  href: string;
  label: string;
  icon: PanelNavIcon;
};

export type PanelNavIcon =
  | "hoy"
  | "estudio"
  | "salas"
  | "clientes"
  | "equipo"
  | "caja"
  | "adicionales"
  | "membresias"
  | "bloqueos"
  | "precios"
  | "promos"
  | "resenas"
  | "plan"
  | "config";

export type PanelNavGroup = {
  id: string;
  label: string;
  items: PanelNavItem[];
};

/**
 * Menú del panel agrupado por uso:
 * - Día a día → operación diaria
 * - Tu espacio → ficha pública, salas, precios
 * - Cuenta → equipo, plan, ajustes (slug, MP, etc.)
 */
export const PANEL_NAV_GROUPS: PanelNavGroup[] = [
  {
    id: "diario",
    label: "Día a día",
    items: [
      { href: "/panel", label: "Agenda", icon: "hoy" },
      { href: "/panel/caja", label: "Caja", icon: "caja" },
      { href: "/panel/clientes", label: "Clientes", icon: "clientes" },
    ],
  },
  {
    id: "espacio",
    label: "Tu espacio",
    items: [
      { href: "/panel/mi-estudio", label: "Mi estudio", icon: "estudio" },
      { href: "/panel/salas", label: "Salas", icon: "salas" },
      { href: "/panel/precios", label: "Precios", icon: "precios" },
      { href: "/panel/promociones", label: "Promociones", icon: "promos" },
      { href: "/panel/adicionales", label: "Adicionales", icon: "adicionales" },
      { href: "/panel/membresias", label: "Membresías", icon: "membresias" },
      { href: "/panel/resenas", label: "Reseñas", icon: "resenas" },
    ],
  },
  {
    id: "cuenta",
    label: "Cuenta",
    items: [
      { href: "/panel/equipo", label: "Equipo", icon: "equipo" },
      { href: "/panel/plan", label: "Plan", icon: "plan" },
      { href: "/panel/configuracion", label: "Configuración", icon: "config" },
    ],
  },
];

export const PANEL_NAV: PanelNavItem[] = PANEL_NAV_GROUPS.flatMap(
  (g) => g.items,
);
