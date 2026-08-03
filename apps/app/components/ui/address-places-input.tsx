"use client";

import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/google-maps";
import { memo, useEffect, useId, useRef, useState } from "react";

type Props = {
  name?: string;
  defaultValue?: string;
  defaultLat?: number | null;
  defaultLng?: number | null;
  onResolved?: (v: {
    address: string;
    lat: number;
    lng: number;
    zona?: string | null;
  }) => void;
  /** Se llama al elegir una sugerencia o al salir del campo (no en cada tecla). */
  onChangeAddress?: (address: string) => void;
  className?: string;
};

type Prediction = {
  placeId: string;
  description: string;
  main: string;
  secondary: string;
};

function zonaFromComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined,
): string | null {
  if (!components?.length) return null;

  const find = (...types: string[]) =>
    components.find((c) => types.some((t) => c.types.includes(t)))?.long_name ??
    null;

  // Preferencia AR: barrio / sublocality → locality (CABA, Rosario…)
  return (
    find(
      "neighborhood",
      "sublocality_level_1",
      "sublocality",
      "sublocality_level_2",
    ) ||
    find("locality") ||
    find("administrative_area_level_2") ||
    null
  );
}

/**
 * Dirección con sugerencias Places en dropdown propio.
 * El texto vive 100% en estado local; el padre solo se actualiza al blur
 * o al elegir una sugerencia (evita que el mapa/preview robe el foco).
 */
function AddressPlacesInputInner({
  name = "address",
  defaultValue = "",
  defaultLat = null,
  defaultLng = null,
  onResolved,
  onChangeAddress,
  className = "",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const onResolvedRef = useRef(onResolved);
  const onChangeRef = useRef(onChangeAddress);
  const predTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serviceRef = useRef<google.maps.places.AutocompleteService | null>(
    null,
  );
  const detailsRef = useRef<google.maps.places.PlacesService | null>(null);
  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(
    null,
  );
  const mapsReadyRef = useRef(false);
  onResolvedRef.current = onResolved;
  onChangeRef.current = onChangeAddress;

  const [address, setAddress] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [hint, setHint] = useState<string | null>(
    hasGoogleMapsKey()
      ? null
      : "Configurá NEXT_PUBLIC_GOOGLE_MAPS_API_KEY para autocompletar.",
  );
  const [lat, setLat] = useState(defaultLat != null ? String(defaultLat) : "");
  const [lng, setLng] = useState(defaultLng != null ? String(defaultLng) : "");
  const uid = useId();
  const listId = `${uid}-list`;
  const hasKey = hasGoogleMapsKey();

  useEffect(() => {
    if (!hasKey) return;
    let cancelled = false;
    void loadGoogleMaps()
      .then((maps) => {
        if (cancelled) return;
        serviceRef.current = new maps.places.AutocompleteService();
        detailsRef.current = new maps.places.PlacesService(
          document.createElement("div"),
        );
        sessionRef.current = new maps.places.AutocompleteSessionToken();
        mapsReadyRef.current = true;
      })
      .catch(() => {
        if (!cancelled) {
          setHint(
            "No se pudo cargar Google Places; podés escribir la dirección.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasKey]);

  useEffect(() => {
    return () => {
      if (predTimerRef.current) clearTimeout(predTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const fetchPredictions = (input: string) => {
    const service = serviceRef.current;
    if (!service || !mapsReadyRef.current || input.trim().length < 3) {
      setPredictions((prev) => (prev.length ? [] : prev));
      setOpen(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    service.getPlacePredictions(
      {
        input: input.trim(),
        componentRestrictions: { country: "ar" },
        types: ["geocode"],
        sessionToken: sessionRef.current ?? undefined,
      },
      (results, status) => {
        setLoading(false);
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !results?.length
        ) {
          setPredictions([]);
          setOpen(false);
          return;
        }
        setPredictions(
          results.slice(0, 6).map((r) => ({
            placeId: r.place_id,
            description: r.description,
            main: r.structured_formatting.main_text,
            secondary: r.structured_formatting.secondary_text,
          })),
        );
        setActiveIdx(-1);
        setOpen(true);
        // Reasegurar foco por si algo del layout lo sacó
        if (document.activeElement !== inputRef.current) {
          inputRef.current?.focus({ preventScroll: true });
        }
      },
    );
  };

  const commitAddress = (value: string) => {
    onChangeRef.current?.(value);
  };

  const selectPrediction = (p: Prediction) => {
    const details = detailsRef.current;
    if (!details) {
      setAddress(p.description);
      commitAddress(p.description);
      setOpen(false);
      return;
    }
    details.getDetails(
      {
        placeId: p.placeId,
        fields: ["formatted_address", "geometry", "address_components"],
        sessionToken: sessionRef.current ?? undefined,
      },
      (place, status) => {
        sessionRef.current = new google.maps.places.AutocompleteSessionToken();
        if (
          status !== google.maps.places.PlacesServiceStatus.OK ||
          !place?.geometry?.location
        ) {
          setHint("No se pudo obtener la ubicación de esa dirección.");
          return;
        }
        const formatted = place.formatted_address ?? p.description;
        const nextLat = place.geometry.location.lat();
        const nextLng = place.geometry.location.lng();
        setAddress(formatted);
        setLat(String(nextLat));
        setLng(String(nextLng));
        setHint(null);
        setOpen(false);
        setPredictions([]);
        commitAddress(formatted);
        onResolvedRef.current?.({
          address: formatted,
          lat: nextLat,
          lng: nextLng,
          zona: zonaFromComponents(place.address_components),
        });
        inputRef.current?.focus({ preventScroll: true });
      },
    );
  };

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <label
        htmlFor={uid}
        className="text-xs uppercase tracking-wide text-muted"
      >
        Dirección
      </label>
      <input
        ref={inputRef}
        id={uid}
        name={name}
        type="text"
        value={address}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="Calle y número"
        className="mt-1 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
        onChange={(e) => {
          const next = e.target.value;
          setAddress(next);
          if (predTimerRef.current) clearTimeout(predTimerRef.current);
          predTimerRef.current = setTimeout(() => fetchPredictions(next), 220);
        }}
        onBlur={(e) => {
          // Delay: permitir click en sugerencia (mousedown preventDefault + click)
          const value = e.target.value;
          window.setTimeout(() => {
            if (wrapRef.current?.contains(document.activeElement)) return;
            commitAddress(value);
            setOpen(false);
          }, 150);
        }}
        onFocus={() => {
          if (predictions.length > 0) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open || predictions.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => (i + 1) % predictions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => (i <= 0 ? predictions.length - 1 : i - 1));
          } else if (e.key === "Enter" && activeIdx >= 0) {
            e.preventDefault();
            const p = predictions[activeIdx];
            if (p) selectPrediction(p);
          } else if (e.key === "Escape") {
            setOpen(false);
            setActiveIdx(-1);
          }
        }}
      />
      <input type="hidden" name="lat" value={lat} />
      <input type="hidden" name="lng" value={lng} />

      {open && (predictions.length > 0 || loading) ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl"
        >
          {loading && predictions.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-muted">Buscando…</li>
          ) : (
            predictions.map((p, i) => (
              <li key={p.placeId} role="option" aria-selected={i === activeIdx}>
                <button
                  type="button"
                  tabIndex={-1}
                  className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left text-sm transition ${
                    i === activeIdx ? "bg-surface-2" : "hover:bg-surface-2"
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => selectPrediction(p)}
                >
                  <span className="font-medium text-ink">{p.main}</span>
                  {p.secondary ? (
                    <span className="text-xs text-muted">{p.secondary}</span>
                  ) : null}
                </button>
              </li>
            ))
          )}
          <li className="border-t border-line px-3 py-1.5 text-[10px] tracking-wide text-muted/70">
            Powered by Google
          </li>
        </ul>
      ) : null}

      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {lat && lng ? (
        <p className="mt-1 text-xs text-muted">
          Ubicación: {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
        </p>
      ) : null}
    </div>
  );
}

export const AddressPlacesInput = memo(AddressPlacesInputInner);
