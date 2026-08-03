import { EstudioDetalleView } from "@/components/features/estudio/estudio-detalle";
import { loadEstudioBySlug } from "@/lib/publico-data";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ slug: string }> };

const RESERVED = new Set([
  "login",
  "register",
  "panel",
  "panel-demo",
  "onboarding",
  "api",
  "salas-de-ensayo",
  "invite",
  "favoritos",
  "cancelar",
  "reprogramar",
  "f",
  "soy-dueno",
  "que-incluye",
]);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const estudio = await loadEstudioBySlug(slug);
  if (!estudio) return {};
  return {
    title: `SalaYa - ${estudio.name}`,
    description: estudio.description,
  };
}

export default async function EstudioPage({ params }: Props) {
  const { slug } = await params;
  if (RESERVED.has(slug)) notFound();

  const estudio = await loadEstudioBySlug(slug);
  if (!estudio) notFound();

  const esDemo = slug === "estudio-demo";

  return (
    <EstudioDetalleView
      estudio={estudio}
      backHref={esDemo ? "/soy-dueno" : "/"}
      backLabel={esDemo ? "Volver a Soy dueño" : "Volver"}
    />
  );
}
