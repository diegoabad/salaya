import { auth, signOut } from "@/auth";
import {
  getFavoritosShareUrlAction,
  listMyFavoritosAction,
} from "@/app/actions/favoritos";
import { SiteHeader } from "@/components/layouts/site-header";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FavoritosShareButton } from "./_share-button";

export default async function FavoritosPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/favoritos");
  }

  const [items, shareUrl] = await Promise.all([
    listMyFavoritosAction(),
    getFavoritosShareUrlAction(),
  ]);

  return (
    <>
      <SiteHeader variant="solid" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-ink">
              Mis favoritos
            </h1>
            <p className="mt-1 text-sm text-muted">
              Estudios que guardaste. Podés compartir la lista con alguien.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {shareUrl ? <FavoritosShareButton url={shareUrl} /> : null}
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
              >
                Salir
              </button>
            </form>
          </div>
        </div>

        {!items?.length ? (
          <p className="mt-10 text-center text-muted">
            Todavía no guardaste nada.{" "}
            <Link href="/" className="text-brand underline">
              Explorar estudios
            </Link>
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
            {items.map((e) => (
              <li key={e.id}>
                <Link
                  href={e.plan === "seed" ? `/#estudio-${e.id}` : `/${e.slug}`}
                  className="flex items-center gap-4 px-4 py-3 transition hover:bg-surface-2"
                >
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-paper">
                    {e.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={e.photo}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-muted">
                        Sin foto
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{e.name}</p>
                    <p className="truncate text-sm text-muted">
                      {e.zona}
                      {e.address ? ` · ${e.address}` : ""}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
