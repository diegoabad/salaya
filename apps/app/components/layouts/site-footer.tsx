import { BrandLogo } from "@/components/layouts/brand-logo";
import Link from "next/link";

const year = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-10 md:py-14">
        <div className="flex flex-col gap-8 md:flex-row md:gap-16 lg:gap-24">
          <div className="flex flex-col items-center text-center md:max-w-xs md:items-start md:text-left lg:max-w-sm">
            <BrandLogo height={36} />
            <p className="mt-3 text-sm leading-relaxed text-muted md:mt-4">
              Encontrá salas de ensayo cerca tuyo y reservá online. Hecho para
              músicos y estudios de Argentina.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:gap-12 md:gap-16">
            <div className="flex flex-col gap-2.5">
              <p className="font-[family-name:var(--font-display)] text-sm tracking-tight text-ink">
                Músicos
              </p>
              <Link
                href="/#resultados"
                className="text-sm text-muted transition hover:text-brand"
              >
                Buscar salas
              </Link>
              <Link
                href="/favoritos"
                className="text-sm text-muted transition hover:text-brand"
              >
                Favoritos
              </Link>
              <Link
                href="/login?callbackUrl=/favoritos"
                className="text-sm text-muted transition hover:text-brand"
              >
                Entrar
              </Link>
            </div>

            <div className="flex flex-col gap-2.5">
              <p className="font-[family-name:var(--font-display)] text-sm tracking-tight text-ink">
                Estudios
              </p>
              <Link
                href="/soy-dueno"
                className="text-sm text-muted transition hover:text-brand"
              >
                Soy dueño
              </Link>
              <Link
                href="/register"
                className="text-sm text-muted transition hover:text-brand"
              >
                Publicá tu sala
              </Link>
              <Link
                href="/login?callbackUrl=/panel"
                className="text-sm text-muted transition hover:text-brand"
              >
                Soy dueño
              </Link>
              <Link
                href="/panel"
                className="text-sm text-muted transition hover:text-brand"
              >
                Ir al panel
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-1 px-4 py-4 text-center text-xs leading-normal text-muted sm:flex-row sm:justify-between sm:py-5 sm:text-left">
          <p>© {year} SalaYa</p>
          <p>Reservá tu sala de ensayo sin vueltas</p>
        </div>
      </div>
    </footer>
  );
}
