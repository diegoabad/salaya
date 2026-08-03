import { SiteHeader } from "@/components/layouts/site-header";
import { getAppDb } from "@/lib/db";
import { parseFavoritosShareToken } from "@/lib/favoritos-share";
import { listFavoritosPublicosByUserId } from "@repo/db/queries";
import Link from "next/link";
import { notFound } from "next/navigation";

type Props = { params: Promise<{ token: string }> };

export default async function FavoritosCompartidosPage({ params }: Props) {
  const { token: raw } = await params;
  const token = decodeURIComponent(raw);
  const userId = parseFavoritosShareToken(token);
  if (!userId) notFound();

  const rows = await listFavoritosPublicosByUserId(getAppDb(), userId);

  return (
    <>
      <SiteHeader variant="solid" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-ink">
          Lista compartida
        </h1>
        <p className="mt-1 text-sm text-muted">
          Estudios favoritos que alguien compartió con vos.
        </p>

        {!rows.length ? (
          <p className="mt-10 text-center text-muted">Esta lista está vacía.</p>
        ) : (
          <ul className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface">
            {rows.map((e) => {
              const slug = e.slug ?? e.id;
              const href =
                e.plan === "seed" ? `/#` : `/${slug}`;
              return (
                <li key={e.id}>
                  <Link
                    href={href}
                    className="flex items-center gap-4 px-4 py-3 transition hover:bg-surface-2"
                  >
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-paper">
                      {e.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={e.photoUrl}
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
                        {e.zona ?? ""}
                        {e.address ? ` · ${e.address}` : ""}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-8 text-center text-sm text-muted">
          <Link href="/login?callbackUrl=/favoritos" className="text-brand underline">
            Creá tu lista
          </Link>{" "}
          guardando favoritos en SalaYa.
        </p>
      </main>
    </>
  );
}
