"use client";

import type { DirectorioSala } from "@/lib/directorio-data";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps";
import { useEffect, useRef, useState } from "react";
import type { UserLocation } from "./directorio-explorer";

type Props = {
  salas: (DirectorioSala & { distKm?: number | null })[];
  userLoc: UserLocation;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
};

const CABA = { lat: -34.6037, lng: -58.3816 };

function pinColor(plan: DirectorioSala["plan"]) {
  if (plan === "seed") return "#94a3b8";
  if (plan === "destacado") return "#e85d04";
  return "#16a34a";
}

/** Mapa Google (si hay key) o fallback demo CABA */
export function DirectorioMap(props: Props) {
  if (!hasGoogleMapsKey()) {
    return <DirectorioMapDemo {...props} />;
  }
  return <DirectorioMapGoogle {...props} />;
}

function DirectorioMapGoogle({
  salas,
  userLoc,
  hoveredId,
  onHover,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const userMarkerRef = useRef<google.maps.Marker | null>(null);
  const onHoverRef = useRef(onHover);
  onHoverRef.current = onHover;
  const [mapActive, setMapActive] = useState(false);

  const withCoords = salas.filter(
    (s) =>
      s.lat != null &&
      s.lng != null &&
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lng),
  );

  useEffect(() => {
    let cancelled = false;
    void loadGoogleMaps().then((maps) => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      const map = new maps.Map(containerRef.current, {
        center: CABA,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: "none",
        scrollwheel: false,
        draggable: false,
        keyboardShortcuts: false,
        styles: [
          { elementType: "geometry", stylers: [{ color: "#1a1d24" }] },
          { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
          { elementType: "labels.text.stroke", stylers: [{ color: "#1a1d24" }] },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ color: "#2a2e38" }],
          },
          {
            featureType: "water",
            elementType: "geometry",
            stylers: [{ color: "#0f1218" }],
          },
        ],
      });
      mapRef.current = map;
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;

    const markers = markersRef.current;
    const keep = new Set(withCoords.map((s) => s.id));
    for (const [id, marker] of markers) {
      if (!keep.has(id)) {
        marker.setMap(null);
        markers.delete(id);
      }
    }

    const bounds = new google.maps.LatLngBounds();
    let hasBound = false;

    for (const sala of withCoords) {
      let marker = markers.get(sala.id);
      const position = { lat: sala.lat!, lng: sala.lng! };
      if (!marker) {
        marker = new google.maps.Marker({
          map,
          position,
          title: sala.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: pinColor(sala.plan),
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        });
        marker.addListener("mouseover", () => onHoverRef.current(sala.id));
        marker.addListener("mouseout", () => onHoverRef.current(null));
        marker.addListener("click", () => {
          window.location.href = `/${sala.slug}`;
        });
        markers.set(sala.id, marker);
      } else {
        marker.setPosition(position);
      }
      bounds.extend(position);
      hasBound = true;
    }

    if (userLoc) {
      if (!userMarkerRef.current) {
        userMarkerRef.current = new google.maps.Marker({
          map,
          position: userLoc,
          title: "Tu ubicación",
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 7,
            fillColor: "#3b82f6",
            fillOpacity: 1,
            strokeColor: "#fff",
            strokeWeight: 2,
          },
        });
      } else {
        userMarkerRef.current.setPosition(userLoc);
      }
      bounds.extend(userLoc);
      hasBound = true;
    } else if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null);
      userMarkerRef.current = null;
    }

    if (hasBound) {
      map.fitBounds(bounds, 48);
      const z = map.getZoom();
      if (z != null && z > 15) map.setZoom(15);
    }
  }, [withCoords, userLoc]);

  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      const active = id === hoveredId;
      const sala = withCoords.find((s) => s.id === id);
      marker.setIcon({
        path: google.maps.SymbolPath.CIRCLE,
        scale: active ? 12 : 9,
        fillColor: pinColor(sala?.plan ?? "cliente"),
        fillOpacity: 1,
        strokeColor: "#fff",
        strokeWeight: active ? 3 : 2,
      });
      if (active) marker.setZIndex(1000);
    }
  }, [hoveredId, withCoords]);

  return (
    <div
      className="relative h-full min-h-[320px] w-full overflow-hidden bg-[#0f1218]"
      onPointerLeave={() => setMapActive(false)}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {!mapActive ? (
        <button
          type="button"
          aria-label="Activar mapa"
          onClick={() => setMapActive(true)}
          className="absolute inset-0 z-[5] cursor-pointer bg-transparent"
        />
      ) : null}
      {withCoords.length === 0 ? (
        <p className="absolute inset-x-3 top-3 z-10 rounded-lg bg-surface/95 px-3 py-2 text-xs text-muted shadow">
          Todavía no hay estudios con ubicación en el mapa. Pediles que
          completen la dirección en el panel.
        </p>
      ) : null}
    </div>
  );
}

/** Fallback sin API key: proyección simple CABA */
function DirectorioMapDemo({ salas, userLoc, hoveredId, onHover }: Props) {
  const bounds = {
    minLat: -34.65,
    maxLat: -34.55,
    minLng: -58.5,
    maxLng: -58.35,
  };

  const toXY = (lat: number, lng: number) => {
    const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
    const y = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 100;
    return {
      left: `${Math.min(98, Math.max(2, x))}%`,
      top: `${Math.min(98, Math.max(2, y))}%`,
    };
  };

  const withCoords = salas.filter(
    (s) => s.lat != null && s.lng != null && Number.isFinite(s.lat),
  );

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden bg-[#0f1218]">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(#2a2e38 1px, transparent 1px),
            linear-gradient(90deg, #2a2e38 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />
      <p className="absolute left-3 top-3 z-10 rounded-full bg-surface/90 px-3 py-1 text-xs font-medium text-muted shadow">
        Mapa demo · agregá NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      </p>

      {userLoc && (
        <span
          className="absolute z-20 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 ring-4 ring-blue-500/30"
          style={toXY(userLoc.lat, userLoc.lng)}
          title="Tu ubicación"
        />
      )}

      {withCoords.map((sala) => {
        const pos = toXY(sala.lat!, sala.lng!);
        const active = hoveredId === sala.id;
        const color =
          sala.plan === "seed"
            ? "bg-seed"
            : sala.plan === "destacado"
              ? "bg-[var(--brand)] text-paper"
              : "bg-online";
        return (
          <button
            key={sala.id}
            type="button"
            title={sala.name}
            onMouseEnter={() => onHover(sala.id)}
            onMouseLeave={() => onHover(null)}
            className={`absolute z-10 flex -translate-x-1/2 -translate-y-full flex-col items-center ${
              active ? "pin-active z-30" : ""
            }`}
            style={pos}
          >
            <span
              className={`rounded-full px-2 py-1 text-[10px] font-semibold shadow ${color} ${
                sala.plan === "destacado" ? "text-paper" : "text-white"
              } ${active ? "scale-110" : ""}`}
            >
              {sala.name.split(" ")[0]}
            </span>
            <span className={`mt-0.5 h-2 w-2 rotate-45 ${color}`} />
          </button>
        );
      })}
    </div>
  );
}
