import { DirectorioExplorer } from "@/components/features/directorio/directorio-explorer";
import { SiteFooter } from "@/components/layouts/site-footer";
import { SiteHeader } from "@/components/layouts/site-header";
import { loadDirectorio } from "@/lib/publico-data";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const salas = await loadDirectorio();

  return (
    <>
      <SiteHeader />
      <DirectorioExplorer salas={salas} />
      <SiteFooter />
    </>
  );
}
