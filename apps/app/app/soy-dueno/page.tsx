import { SiteFooter } from "@/components/layouts/site-footer";
import { SiteHeader } from "@/components/layouts/site-header";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Soy dueño",
  description:
    "Reclamá tu estudio en SalaYa gratis: página propia, salas, fotos y horarios. Sumá reservas online, gestión y destacados cuando quieras.",
};

const IMG = {
  hero: "https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=2000&q=80",
  gratis:
    "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1400&q=80",
  salas:
    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1200&q=80",
  pago: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1400&q=80",
} as const;

const GRATIS = [
  {
    title: "Tu página propia",
    body: "Pasás de una ficha suelta del directorio a tu propia dirección en SalaYa — fácil de compartir en Instagram, WhatsApp o Google.",
  },
  {
    title: "Un apartado por cada sala",
    body: "Si tenés más de una, cada una tiene su espacio: el músico entiende qué está mirando y qué puede reservar.",
  },
  {
    title: "Fotos, comodidades, precios y horarios",
    body: "Mostrá cómo es tu estudio, qué incluye, cuánto sale y cuándo abrís. Todo visible en tu página.",
  },
] as const;

const PAGO = [
  {
    title: "Reservas online",
    body: "Eligen día y horario, dejan seña por Mercado Pago y vos recibís la reserva sin ir y venir por chat.",
  },
  {
    title: "Gestión del estudio",
    body: "Agenda, clientes, caja, bloqueos, precios y equipo: el día a día del estudio en un solo panel.",
  },
  {
    title: "Destacados por zona",
    body: "Aparecé primero cuando buscan en tu zona, con una presencia que se diferencia del resto del listado.",
  },
] as const;

export default function SoyDuenoPage() {
  return (
    <>
      <SiteHeader variant="overlay" />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative min-h-[min(92vh,880px)] overflow-hidden border-b border-line">
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(105deg, rgba(10,11,14,0.92) 0%, rgba(10,11,14,0.72) 42%, rgba(10,11,14,0.35) 100%),
                url(${IMG.hero})
              `,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-paper to-transparent"
          />

          <div className="relative mx-auto flex min-h-[min(92vh,880px)] max-w-7xl flex-col justify-end px-4 pb-14 pt-28 md:pb-20 md:pt-36">
            <h1 className="animate-rise max-w-2xl font-display text-3xl leading-[1.05] tracking-tight text-white md:text-5xl">
              Tu estudio, con página propia
            </h1>
            <p className="animate-rise-delay mt-3 max-w-lg text-base text-white/80 md:text-lg">
              Reclamá tu ficha y armá tu presencia gratis. Las reservas online,
              la gestión y los destacados son opcionales, cuando quieras crecer.
            </p>
            <div className="animate-rise-delay mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-paper transition hover:bg-brand-deep"
              >
                Crear cuenta
              </Link>
              <Link
                href="/#resultados"
                className="inline-flex items-center justify-center rounded-xl border border-white/25 bg-white/5 px-5 py-3 text-sm font-medium text-white backdrop-blur transition hover:border-brand/50 hover:text-brand"
              >
                Buscar mi estudio
              </Link>
            </div>
          </div>
        </section>

        {/* Gratis */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-14 md:py-24">
            <div className="order-2 md:order-1">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">
                Gratis
              </p>
              <h2 className="mt-2 font-display text-3xl tracking-tight text-ink md:text-4xl">
                Empezá sin pagar
              </h2>
              <p className="mt-3 text-muted">
                Al reclamar tu estudio activás tu página y la completás vos.
              </p>

              <ul className="mt-8 space-y-6">
                {GRATIS.map((item, i) => (
                  <li
                    key={item.title}
                    className="border-l-2 border-brand/50 pl-4"
                    style={{ animationDelay: `${0.08 * i}s` }}
                  >
                    <h3 className="font-display text-lg tracking-tight text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted md:text-base">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>

              <p className="mt-8 text-sm font-medium text-brand">
                Eso es todo gratis: URL, salas, fotos, comodidades, precios y
                horarios.
              </p>
            </div>

            <div className="order-1 md:order-2">
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl md:aspect-[5/6]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={IMG.gratis}
                  alt="Músicos ensayando en un estudio"
                  className="h-full w-full object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-t from-paper/80 via-transparent to-transparent"
                />
                <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-line/80 bg-paper/85 px-4 py-3 backdrop-blur">
                  <p className="font-display text-sm tracking-tight text-ink">
                    salaya.com/tu-estudio
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Tu link para compartir
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Salas strip */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-[1.1fr_0.9fr] md:items-center md:gap-12 md:py-16">
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={IMG.salas}
                alt="Escenario y equipo de un estudio"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h2 className="font-display text-2xl tracking-tight text-ink md:text-3xl">
                Cada sala, clara y completa
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted md:text-base">
                Fotos, comodidades, precios y horarios por sala. El músico ve lo
                que necesita antes de escribirte — y vos controlás cómo se
                muestra tu estudio.
              </p>
            </div>
          </div>
        </section>

        {/* De pago */}
        <section className="relative overflow-hidden">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:gap-14 md:py-24">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl md:aspect-[5/6]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={IMG.pago}
                alt="Show en vivo — tu estudio en movimiento"
                className="h-full w-full object-cover"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-tr from-paper/70 via-transparent to-transparent"
              />
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">
                De pago
              </p>
              <h2 className="mt-2 font-display text-3xl tracking-tight text-ink md:text-4xl">
                También tenemos estos servicios
              </h2>
              <p className="mt-3 text-muted">
                Cuando quieras automatizar o destacar, sumás lo que necesites.
              </p>

              <ul className="mt-8 space-y-6">
                {PAGO.map((item) => (
                  <li key={item.title} className="border-l-2 border-line pl-4">
                    <h3 className="font-display text-lg tracking-tight text-ink">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted md:text-base">
                      {item.body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Preview estudio + panel demo */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-14 md:py-20">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand">
                Vista previa
              </p>
              <h2 className="mt-2 font-display text-3xl tracking-tight text-ink md:text-4xl">
                Así se ve tu estudio
              </h2>
              <p className="mt-3 text-muted">
                Mirá la página pública y el panel de gestión con los mismos
                datos de prueba. Sin registrarte. No aparecen en el directorio.
              </p>
              <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/estudio-demo"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-paper transition hover:bg-brand-deep sm:w-auto"
                >
                  Ver página pública
                </Link>
                <Link
                  href="/panel-demo"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-line bg-paper px-5 py-3 text-sm font-semibold text-ink transition hover:border-brand/40 sm:w-auto"
                >
                  Probar el panel
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative overflow-hidden border-t border-line">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(204,255,0,0.1),_transparent_55%)]"
          />
          <div className="relative mx-auto max-w-3xl px-4 py-16 text-center md:py-24">
            <h2 className="font-display text-3xl tracking-tight text-ink md:text-4xl">
              ¿Tu estudio ya está en el directorio?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-muted">
              Buscalo y reclama la ficha, o creá tu cuenta si todavía no estás.
              Empezar con la presencia gratis es el primer paso.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/"
                className="inline-flex w-full items-center justify-center rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-paper transition hover:bg-brand-deep sm:w-auto"
              >
                Buscar mi estudio
              </Link>
              <Link
                href="/register"
                className="inline-flex w-full items-center justify-center rounded-xl border border-line bg-surface px-5 py-3 text-sm font-medium text-ink transition hover:border-brand/40 sm:w-auto"
              >
                Crear cuenta
              </Link>
              <Link
                href="/login?callbackUrl=/panel"
                className="inline-flex w-full items-center justify-center rounded-xl px-5 py-3 text-sm font-medium text-muted underline-offset-2 hover:text-brand hover:underline sm:w-auto"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
