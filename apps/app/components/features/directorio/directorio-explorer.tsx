"use client";

import {
  buildZonaFilterOptions,
  formatDistancia,
  haversineKm,
  matchesZonaFilter,
  type DirectorioSala,
} from "@/lib/directorio-data";
import { useFavoritos } from "@/lib/use-favoritos";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import { FilterSelect } from "@/components/ui/filter-select";
import { Toast } from "@/components/ui/toast";
import { SalaCard, GuiaRow } from "./sala-card";
import { SearchHero } from "./search-hero";
import { FavoritosHint } from "./favoritos-hint";

export type UserLocation = { lat: number; lng: number } | null;

const PAGE_SIZE = 12;
/** Radio para el filtro “Cerca de mí” */
const CERCA_MAX_KM = 25;

function esCliente(plan: DirectorioSala["plan"]) {
  return plan === "cliente" || plan === "destacado";
}

export function DirectorioExplorer({
  initialZona,
  salas = [],
}: {
  initialZona?: string;
  /** Entradas del directorio = estudios (complejos), no salas sueltas */
  salas?: DirectorioSala[];
}) {
  const [query, setQuery] = useState(initialZona ?? "");
  const [zona, setZona] = useState(initialZona ?? "");
  const [soloAgendaOnline, setSoloAgendaOnline] = useState(false);
  const [cercaDeMi, setCercaDeMi] = useState(false);
  const [userLoc, setUserLoc] = useState<UserLocation>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [isFilteringNear, startNearTransition] = useTransition();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const resultsRef = useRef<HTMLElement>(null);
  const { has, toggle, loggedIn } = useFavoritos();
  const [justFav, setJustFav] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  const geoBusy = geoLoading || isFilteringNear;
  const geoBusyMessage = geoLoading
    ? "Obteniendo tu ubicación…"
    : "Buscando salas cerca tuyo…";

  const toggleFav = (id: string) => {
    const was = has(id);
    void toggle(id);
    if (!was) setJustFav(true);
  };

  const dismissGeoError = useCallback(() => setGeoError(null), []);

  const activarCercaDeMi = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("Tu navegador no soporta geolocalización");
      setCercaDeMi(false);
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setGeoLoading(false);
        startNearTransition(() => {
          setUserLoc(next);
          setCercaDeMi(true);
        });
        // scroll después de que el layout se actualice
        window.setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 80);
      },
      () => {
        setGeoError("Necesitamos permiso de ubicación para buscar cerca tuyo");
        setCercaDeMi(false);
        setUserLoc(null);
        setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  const toggleCercaDeMi = () => {
    if (geoBusy) return;
    if (cercaDeMi) {
      setCercaDeMi(false);
      setUserLoc(null);
      setGeoError(null);
      return;
    }
    activarCercaDeMi();
  };

  const zonasDisponibles = useMemo(
    () => buildZonaFilterOptions(salas),
    [salas],
  );

  const enriched = useMemo(() => {
    return salas.map((s) => {
      const distKm =
        userLoc && s.lat != null && s.lng != null
          ? haversineKm(userLoc.lat, userLoc.lng, s.lat, s.lng)
          : null;
      return { ...s, distKm };
    });
  }, [userLoc, salas]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = enriched.filter((s) => {
      if (zona && !matchesZonaFilter(s, zona)) return false;
      if (soloAgendaOnline && !esCliente(s.plan)) return false;
      if (cercaDeMi) {
        if (s.distKm == null || s.distKm > CERCA_MAX_KM) return false;
      }
      if (q) {
        const hay =
          s.name.toLowerCase().includes(q) ||
          s.zona.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q);
        if (!hay) return false;
      }
      return true;
    });

    list = [...list].sort((a, b) => {
      if (cercaDeMi && a.distKm != null && b.distKm != null) {
        return a.distKm - b.distKm;
      }
      const rank = (p: DirectorioSala["plan"]) =>
        p === "destacado" ? 0 : p === "cliente" ? 1 : 2;
      const r = rank(a.plan) - rank(b.plan);
      if (r !== 0) return r;
      if (a.distKm != null && b.distKm != null) return a.distKm - b.distKm;
      return a.precioDesde - b.precioDesde;
    });

    return list;
  }, [enriched, query, zona, soloAgendaOnline, cercaDeMi]);

  const clientes = useMemo(
    () => filtered.filter((s) => esCliente(s.plan)),
    [filtered],
  );
  const guia = useMemo(
    () => filtered.filter((s) => !esCliente(s.plan)),
    [filtered],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [zona, soloAgendaOnline, query, cercaDeMi]);

  const shownClientes = useMemo(
    () => clientes.slice(0, visibleCount),
    [clientes, visibleCount],
  );
  const hasMore = clientes.length > shownClientes.length;

  const onSearch = (value: string, maybeZona?: string) => {
    setQuery(value);
    if (maybeZona) setZona(maybeZona);
    resultsRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex flex-1 flex-col">
      <SearchHero
        query={query}
        onQueryChange={setQuery}
        onSearch={onSearch}
        zonas={zonasDisponibles.map((z) => z.label)}
        salas={salas}
      />

      <section
        ref={resultsRef}
        id="resultados"
        className="relative z-0 mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6"
      >
        {clientes.length > 0 ? (
          <h2 className="font-[family-name:var(--font-display)] text-2xl tracking-tight text-ink md:text-3xl">
            {clientes.length} estudio{clientes.length === 1 ? "" : "s"} con
            reserva
            {zona ? ` en ${zona}` : ""}
            {cercaDeMi ? " cerca tuyo" : ""}
          </h2>
        ) : null}

        <div
          className={`flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center ${filtered.length > 0 ? "mt-4" : ""}`}
        >
          <FilterSelect
            value={zona}
            onChange={setZona}
            searchable
            placeholder="Todas las zonas"
            aria-label="Zona"
            className="w-full sm:w-auto sm:min-w-[14rem] sm:max-w-sm"
            options={[
              { value: "", label: "Todas las zonas" },
              ...zonasDisponibles,
            ]}
          />

          <button
            type="button"
            onClick={() => setSoloAgendaOnline((v) => !v)}
            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition sm:w-auto sm:px-4 ${
              soloAgendaOnline
                ? "border-brand bg-brand text-paper"
                : "border-line bg-surface text-ink hover:border-brand/40"
            }`}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="shrink-0"
            >
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18M8 3v4M16 3v4" />
            </svg>
            Con agenda online
          </button>

          <button
            type="button"
            onClick={toggleCercaDeMi}
            disabled={geoBusy}
            aria-busy={geoBusy}
            className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition sm:w-auto sm:px-4 disabled:cursor-wait disabled:opacity-70 ${
              cercaDeMi
                ? "border-brand bg-brand text-paper"
                : "border-line bg-surface text-ink hover:border-brand/40"
            }`}
          >
            {geoBusy ? (
              <span
                className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
                aria-hidden
              />
            ) : (
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden
                className="shrink-0"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 4.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"
                />
              </svg>
            )}
            {geoBusy ? "Buscando…" : "Cerca de mí"}
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
            <Image
              src="/salaya-icon.png"
              alt=""
              width={72}
              height={72}
              className="opacity-80"
            />
            <p className="mt-5 font-[family-name:var(--font-display)] text-xl tracking-tight text-ink">
              No hay nada por acá
            </p>
            <p className="mt-2 max-w-sm text-sm text-muted">
              Probá ampliar la búsqueda o sacar algún filtro.
            </p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col">
            {shownClientes.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shownClientes.map((estudio) => (
                  <li key={estudio.id}>
                    <SalaCard
                      sala={estudio}
                      distancia={
                        estudio.distKm != null
                          ? formatDistancia(estudio.distKm)
                          : null
                      }
                      favorito={has(estudio.id)}
                      onToggleFavorito={() => toggleFav(estudio.id)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}

            {hasMore ? (
              <div className="mt-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink hover:border-brand/40"
                >
                  Ver más ({clientes.length - shownClientes.length} restantes)
                </button>
              </div>
            ) : null}

            {guia.length > 0 ? (
              <section
                className={
                  shownClientes.length > 0
                    ? "mt-12 border-t border-line pt-8"
                    : "mt-2"
                }
              >
                <ul className="flex flex-col gap-3">
                  {guia.map((estudio) => (
                    <GuiaRow
                      key={estudio.id}
                      sala={estudio}
                      distancia={
                        estudio.distKm != null
                          ? formatDistancia(estudio.distKm)
                          : null
                      }
                    />
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </section>

      <FavoritosHint justAdded={justFav} loggedIn={loggedIn} />
      <Toast message={geoError} onDismiss={dismissGeoError} />
      {portalReady && geoBusy
        ? createPortal(
            <div
              className="fixed inset-0 z-[210] flex items-center justify-center bg-black/55 p-4"
              role="alertdialog"
              aria-busy="true"
              aria-live="assertive"
              aria-label={geoBusyMessage}
            >
              <div className="w-full max-w-sm rounded-2xl border border-line bg-surface px-5 py-6 text-center shadow-2xl">
                <span
                  className="mx-auto mb-4 block h-9 w-9 animate-spin rounded-full border-[3px] border-brand border-r-transparent"
                  aria-hidden
                />
                <p className="font-[family-name:var(--font-display)] text-lg tracking-tight text-ink">
                  {geoBusyMessage}
                </p>
                <p className="mt-1.5 text-sm text-muted">
                  {geoLoading
                    ? "Si el navegador te pide permiso, aceptalo para continuar."
                    : "Estamos ordenando los estudios más cercanos."}
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
