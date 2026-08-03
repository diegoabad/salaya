"use client";

import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps";
import { useEffect, useRef, useState } from "react";

type Props = {
  lat: number | null;
  lng: number | null;
  address?: string;
  /** Nombre del lugar (mejora el deep-link a la ficha) */
  name?: string;
  /** Place ID de Google — abre la ficha, no solo lat/lng */
  googlePlaceId?: string | null;
  className?: string;
  /**
   * `js` = Google Maps JS (default si hay key).
   * `embed` = iframe OSM (fallback).
   * `auto` = JS si hay key, si no embed.
   */
  mode?: "auto" | "js" | "embed";
  /** Altura más chica (modales) */
  compact?: boolean;
};

function googleMapsPlaceUrl(input: {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
  googlePlaceId?: string | null;
}): string {
  const placeId = input.googlePlaceId?.trim();
  if (placeId) {
    const q = encodeURIComponent(
      input.name?.trim() || input.address?.trim() || "lugar",
    );
    return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(placeId)}`;
  }
  const label = input.name?.trim() || input.address?.trim();
  if (label) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${input.lat},${input.lng}`;
}

function MapEmbedFallback({
  lat,
  lng,
  address,
  name,
  googlePlaceId,
  className,
}: {
  lat: number;
  lng: number;
  address?: string;
  name?: string;
  googlePlaceId?: string | null;
  className: string;
}) {
  const delta = 0.01;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  const osm = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lng}`)}`;
  const mapsLink = googleMapsPlaceUrl({
    lat,
    lng,
    address,
    name,
    googlePlaceId,
  });

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-2 ${className}`}
    >
      <iframe
        title={address ? `Mapa · ${address}` : "Mapa"}
        src={osm}
        className="min-h-0 w-full flex-1 border-0"
        style={{ height: "100%", minHeight: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <a
        href={mapsLink}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 border-t border-line bg-surface px-3 py-2 text-center text-xs font-medium text-brand hover:underline"
      >
        Abrir en Google Maps
      </a>
    </div>
  );
}

/** Mini-mapa de ficha de estudio (Google Maps) */
export function EstudioMap({
  lat,
  lng,
  address,
  name,
  googlePlaceId,
  className = "",
  mode = "auto",
  compact = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [failed, setFailed] = useState(false);
  /** Evita que el scroll de la página mueva el mapa hasta un clic */
  const [mapActive, setMapActive] = useState(false);
  const wantJs = mode === "js" || (mode === "auto" && hasGoogleMapsKey());
  const useJs = wantJs && hasGoogleMapsKey() && !failed;
  const mapH = compact ? "h-[140px] md:h-[160px]" : "h-[280px] md:h-[340px]";

  useEffect(() => {
    setFailed(false);
    setMapActive(false);
  }, [lat, lng, mode]);

  useEffect(() => {
    if (!useJs || lat == null || lng == null) return;
    let cancelled = false;
    mapRef.current = null;
    void loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !ref.current) return;
        // Limpia nodos viejos al re-montar
        ref.current.replaceChildren();
        const map = new maps.Map(ref.current, {
          center: { lat, lng },
          zoom: 15,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "none",
          scrollwheel: false,
          draggable: false,
          keyboardShortcuts: false,
        });
        mapRef.current = map;
        new maps.Marker({
          map,
          position: { lat, lng },
          title: name || address,
        });
        const ping = () => {
          if (!map || !ref.current) return;
          maps.event.trigger(map, "resize");
          map.setCenter({ lat, lng });
        };
        ping();
        requestAnimationFrame(ping);
        window.setTimeout(ping, 50);
        window.setTimeout(ping, 200);
        window.setTimeout(ping, 500);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      mapRef.current = null;
    };
  }, [useJs, lat, lng, name, address]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setOptions({
      gestureHandling: mapActive ? "greedy" : "none",
      scrollwheel: mapActive,
      draggable: mapActive,
      keyboardShortcuts: mapActive,
    });
  }, [mapActive]);

  const recenter = () => {
    if (lat == null || lng == null || !mapRef.current) return;
    mapRef.current.panTo({ lat, lng });
    mapRef.current.setZoom(15);
  };

  if (lat == null || lng == null) {
    return (
      <div
        className={`flex h-[160px] items-center justify-center rounded-2xl border border-line bg-surface-2 px-4 text-center text-sm text-muted md:h-[180px] ${className}`}
      >
        {address?.trim()
          ? "Todavía no hay pin en el mapa para esta dirección."
          : "Ubicación pendiente — el estudio aún no cargó la dirección."}
      </div>
    );
  }

  const mapsLink = googleMapsPlaceUrl({
    lat,
    lng,
    address,
    name,
    googlePlaceId,
  });

  if (!useJs) {
    return (
      <MapEmbedFallback
        lat={lat}
        lng={lng}
        address={address}
        name={name}
        googlePlaceId={googlePlaceId}
        className={`${mapH} ${className}`}
      />
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-line bg-surface-2 ${className}`}
    >
      <div
        className={`relative w-full ${mapH}`}
        onPointerLeave={() => setMapActive(false)}
      >
        <div ref={ref} className="absolute inset-0 h-full w-full" />
        {!mapActive ? (
          <button
            type="button"
            aria-label="Activar mapa"
            onClick={() => setMapActive(true)}
            className="absolute inset-0 z-[5] cursor-pointer bg-transparent"
          />
        ) : null}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMapActive(true);
            recenter();
          }}
          aria-label="Centrar mapa"
          title="Centrar"
          className="absolute top-3 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink shadow-sm transition hover:border-brand/40 hover:text-brand"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
          </svg>
        </button>
      </div>
      <a
        href={mapsLink}
        target="_blank"
        rel="noreferrer"
        className="block border-t border-line bg-surface px-3 py-1.5 text-center text-xs font-medium text-brand hover:underline"
      >
        Abrir en Google Maps
      </a>
    </div>
  );
}
