import { PanelMain } from "@/components/layouts/panel-main";
import { PanelSidebar } from "@/components/layouts/panel-sidebar";
import { PanelDemoGuard } from "@/components/features/panel/panel-demo-guard";
import { loadPanelDemoBundle } from "@/lib/panel-demo-data";
import Link from "next/link";

export default async function PanelDemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const demo = await loadPanelDemoBundle();

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      <PanelSidebar
        estudioName={demo.estudioName}
        userLabel="Vista de prueba"
        role="owner"
        basePath="/panel-demo"
        homeHref="/panel-demo"
        exitHref="/soy-dueno"
        exitLabel="Salir del demo"
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-brand/30 bg-brand/10 px-4 py-2.5 text-center text-sm text-ink md:px-6">
          Panel de prueba con los datos de{" "}
          <Link
            href="/estudio-demo"
            className="font-semibold text-brand underline-offset-2 hover:underline"
          >
            Estudio de prueba
          </Link>
          . Los cambios no se guardan.{" "}
          <Link
            href="/register"
            className="font-semibold text-brand underline-offset-2 hover:underline"
          >
            Creá tu cuenta
          </Link>
        </div>
        <PanelMain basePath="/panel-demo">
          <PanelDemoGuard>{children}</PanelDemoGuard>
        </PanelMain>
      </div>
    </div>
  );
}
