const CALLBACKS_KEY = "__salayaGoogleMapsCallbacks";

type GoogleMapsWindow = Window & {
  google?: typeof google;
  [CALLBACKS_KEY]?: Array<() => void>;
  __salayaGoogleMapsLoading?: boolean;
};

export function googleMapsApiKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return key || null;
}

export function hasGoogleMapsKey(): boolean {
  return Boolean(googleMapsApiKey());
}

/** Carga Maps JS + Places una sola vez */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps solo en el navegador"));
  }
  const w = window as GoogleMapsWindow;
  // Maps alcanza; Places puede demorar un tick tras el callback
  if (w.google?.maps) {
    return Promise.resolve(w.google.maps);
  }

  const key = googleMapsApiKey();
  if (!key) {
    return Promise.reject(new Error("Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  }

  return new Promise((resolve, reject) => {
    const queue = (w[CALLBACKS_KEY] ??= []);
    queue.push(() => {
      if (w.google?.maps) resolve(w.google.maps);
      else reject(new Error("Google Maps no cargó"));
    });

    if (w.__salayaGoogleMapsLoading) return;
    w.__salayaGoogleMapsLoading = true;

    const cbName = "__salayaGoogleMapsReady";
    (window as unknown as Record<string, () => void>)[cbName] = () => {
      const cbs = w[CALLBACKS_KEY] ?? [];
      w[CALLBACKS_KEY] = [];
      for (const cb of cbs) cb();
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      key,
    )}&libraries=places&language=es&region=AR&callback=${cbName}`;
    script.async = true;
    script.onerror = () => reject(new Error("No se pudo cargar Google Maps"));
    document.head.appendChild(script);
  });
}
