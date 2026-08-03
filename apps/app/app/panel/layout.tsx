import { auth, signOut } from "@/auth";
import { fetchSuscripcion } from "@/app/actions/suscripcion";
import { PanelMain } from "@/components/layouts/panel-main";
import { PanelSidebar } from "@/components/layouts/panel-sidebar";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!session.user.tenantId) {
    redirect("/onboarding");
  }

  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const onPlanPage =
    pathname === "/panel/plan" || pathname.startsWith("/panel/plan/");

  // Solo redirigir si conocemos el path (middleware) y no es la página de plan
  if (pathname && !onPlanPage) {
    const sub = await fetchSuscripcion();
    if (sub && !sub.canAccessPanel) {
      redirect("/panel/plan");
    }
  }

  const estudioName = session.user.tenantName ?? "Mi estudio";
  const userLabel = session.user.name ?? session.user.email ?? "Usuario";

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-paper text-ink">
      <PanelSidebar
        estudioName={estudioName}
        userLabel={userLabel}
        role={session.user.role}
        signOutAction={signOutAction}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <PanelMain basePath="/panel">{children}</PanelMain>
      </div>
    </div>
  );
}
