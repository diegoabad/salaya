import { DirectorioExplorer } from "@/components/features/directorio/directorio-explorer";
import { SiteHeader } from "@/components/layouts/site-header";
import { ZONAS, slugifyZona } from "@/lib/directorio-data";
import { loadDirectorio } from "@/lib/publico-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ zona: string }> };

export function generateStaticParams() {
  return ZONAS.map((z) => ({ zona: slugifyZona(z) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { zona: slug } = await params;
  const zona = ZONAS.find((z) => slugifyZona(z) === slug);
  if (!zona) return {};
  return {
    title: `SalaYa - Salas de ensayo en ${zona}`,
    description: `Encontrá salas de ensayo en ${zona}. Precios, equipamiento y reserva online.`,
  };
}

export default async function ZonaLandingPage({ params }: Props) {
  const { zona: slug } = await params;
  const zona = ZONAS.find((z) => slugifyZona(z) === slug);
  if (!zona) notFound();

  const salas = await loadDirectorio();
  const count = salas.filter((s) => s.zona === zona).length;

  return (
    <>
      <div className="relative border-b border-line bg-paper pb-6 pt-20 text-ink">
        <SiteHeader />
        <div className="mx-auto max-w-7xl px-4 pt-8">
          <p className="text-sm uppercase tracking-[0.2em] text-brand">
            Salas de ensayo
          </p>
          <h1 className="mt-2 font-display text-4xl tracking-tight md:text-5xl">
            {zona}
          </h1>
          <p className="mt-2 text-muted">
            {count} sala{count === 1 ? "" : "s"} en el directorio
          </p>
        </div>
      </div>
      <DirectorioExplorer initialZona={zona} salas={salas} />
    </>
  );
}
