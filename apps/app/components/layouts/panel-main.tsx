"use client";

import { usePathname } from "next/navigation";

type Props = {
  children: React.ReactNode;
  /** Prefijo del panel: `/panel` o `/panel-demo` */
  basePath?: string;
};

/**
 * Padding del contenido del panel. Mi estudio va full-bleed;
 * el resto (Agenda, Caja, …) necesita aire respecto a los bordes.
 * Usa pathname del cliente para que sobreviva a navegación soft.
 */
export function PanelMain({ children, basePath = "/panel" }: Props) {
  const pathname = usePathname();
  const flush =
    pathname === `${basePath}/mi-estudio` ||
    pathname.startsWith(`${basePath}/mi-estudio/`);

  return (
    <main
      className={
        flush
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:px-6 md:py-5 lg:px-8"
      }
    >
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </main>
  );
}
