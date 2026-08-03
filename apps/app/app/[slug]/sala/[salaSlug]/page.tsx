import { SalaDetalleView } from "@/components/features/estudio/sala-detalle";
import { loadSalaDetalle } from "@/lib/publico-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ slug: string; salaSlug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, salaSlug } = await params;
  const data = await loadSalaDetalle(slug, salaSlug);
  if (!data) return {};
  return {
    title: `SalaYa - ${data.estudio.name} - ${data.sala.name}`,
    description: data.sala.description,
  };
}

export default async function SalaPage({ params }: Props) {
  const { slug, salaSlug } = await params;
  const data = await loadSalaDetalle(slug, salaSlug);
  if (!data) notFound();

  return <SalaDetalleView data={data} />;
}
