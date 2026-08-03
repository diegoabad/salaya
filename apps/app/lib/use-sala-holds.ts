"use client";

import {
  apiBaseUrl,
  deleteHold,
  fetchHolds,
  getHoldSessionId,
  putHold,
  type HoldPublic,
  type PoliticaPublica,
} from "@/lib/holds-api";
import { POLITICA_DEFAULTS } from "@repo/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type Options = {
  salaId: string;
  fecha: string;
  selectedHoras: string[];
  onOwnHoldExpired: () => void;
  onConflict?: (horas: string[]) => void;
};

function horaToMinutes(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h! * 60 + m!;
}

function hayHuecos(horas: string[]): boolean {
  if (horas.length < 2) return false;
  const sorted = [...horas].sort(
    (a, b) => horaToMinutes(a) - horaToMinutes(b),
  );
  for (let i = 1; i < sorted.length; i++) {
    if (horaToMinutes(sorted[i]!) - horaToMinutes(sorted[i - 1]!) !== 60) {
      return true;
    }
  }
  return false;
}

const POLITICA_FALLBACK: PoliticaPublica = {
  holdMinutos: POLITICA_DEFAULTS.holdMinutos,
  senaModo: POLITICA_DEFAULTS.senaModo,
  senaTipo: POLITICA_DEFAULTS.senaTipo,
  senaValor: String(POLITICA_DEFAULTS.senaValor),
  precioHora: 0,
  reglas: [],
  horarios: [],
  cancelacionVentanaHoras: POLITICA_DEFAULTS.cancelacionVentanaHoras,
  senaDestinoCancelacion: POLITICA_DEFAULTS.senaDestinoCancelacion,
  permiteReprogramar: POLITICA_DEFAULTS.permiteReprogramar,
};

export function useSalaHolds({
  salaId,
  fecha,
  selectedHoras,
  onOwnHoldExpired,
  onConflict,
}: Options) {
  const sessionId = useMemo(() => getHoldSessionId(), []);
  const [holds, setHolds] = useState<HoldPublic[]>([]);
  const [politica, setPolitica] = useState<PoliticaPublica>(POLITICA_FALLBACK);
  const [connected, setConnected] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const ownHoldIdRef = useRef<string | null>(null);
  const onExpiredRef = useRef(onOwnHoldExpired);
  const onConflictRef = useRef(onConflict);
  onExpiredRef.current = onOwnHoldExpired;
  onConflictRef.current = onConflict;

  const upsertLocal = useCallback((hold: HoldPublic) => {
    setHolds((prev) => {
      const rest = prev.filter((h) => h.id !== hold.id);
      const cleaned = rest.filter(
        (h) => !(h.salaId === hold.salaId && h.sessionId === hold.sessionId),
      );
      return [...cleaned, hold];
    });
  }, []);

  const removeLocal = useCallback((id: string) => {
    setHolds((prev) => prev.filter((h) => h.id !== id));
  }, []);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;

    const load = (attempt = 0) => {
      void fetchHolds(salaId)
        .then((data) => {
          if (cancelled) return;
          setHolds(data.holds);
          setPolitica({
            holdMinutos: data.holdMinutos,
            senaModo: data.senaModo,
            senaTipo: data.senaTipo,
            senaValor: data.senaValor,
            precioHora: data.precioHora ?? 0,
            reglas: data.reglas ?? [],
            horarios: data.horarios ?? [],
            cancelacionVentanaHoras:
              data.cancelacionVentanaHoras ??
              POLITICA_DEFAULTS.cancelacionVentanaHoras,
            senaDestinoCancelacion:
              data.senaDestinoCancelacion ??
              POLITICA_DEFAULTS.senaDestinoCancelacion,
            permiteReprogramar:
              data.permiteReprogramar ?? POLITICA_DEFAULTS.permiteReprogramar,
          });
          setSyncError(null);
        })
        .catch(() => {
          if (cancelled) return;
          if (attempt < 8) {
            setSyncError("Conectando con el servidor de reservas…");
            retryTimer = window.setTimeout(() => load(attempt + 1), 1500);
          } else {
            setSyncError(
              "No se pudo conectar con la API (puerto 4000). Corré `pnpm dev:api` o `pnpm dev`.",
            );
          }
        });
    };
    load();

    const socket = io(apiBaseUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setSyncError(null);
      socket.emit("sala:join", { salaId }, (snapshot: HoldPublic[]) => {
        if (!cancelled && Array.isArray(snapshot)) setHolds(snapshot);
      });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("holds:snapshot", (payload: { salaId: string; holds: HoldPublic[] }) => {
      if (payload.salaId === salaId) setHolds(payload.holds);
    });
    socket.on("hold:upsert", (hold: HoldPublic) => {
      if (hold.salaId === salaId) upsertLocal(hold);
    });
    socket.on("hold:remove", (payload: { id: string; salaId: string }) => {
      if (payload.salaId !== salaId) return;
      removeLocal(payload.id);
      if (payload.id === ownHoldIdRef.current) {
        ownHoldIdRef.current = null;
        onExpiredRef.current();
      }
    });

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      socket.emit("sala:leave", { salaId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [salaId, upsertLocal, removeLocal]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          if (selectedHoras.length === 0) {
            if (ownHoldIdRef.current) {
              await deleteHold(salaId);
              ownHoldIdRef.current = null;
            }
            return;
          }
          if (hayHuecos(selectedHoras)) {
            return;
          }
          const hold = await putHold(salaId, {
            fecha,
            horas: selectedHoras,
          });
          ownHoldIdRef.current = hold.id;
          upsertLocal(hold);
          setSyncError(null);
        } catch (e) {
          const err = e as Error & { code?: string; horas?: string[] };
          if (err.code === "HOLD_CONFLICT" && err.horas?.length) {
            onConflictRef.current?.(err.horas);
          } else if (err.code !== "HOLD_NOT_CONTIGUOUS") {
            setSyncError(err.message || "No se pudo bloquear el horario");
          }
        }
      })();
    }, 350);
    return () => window.clearTimeout(t);
  }, [salaId, fecha, selectedHoras, upsertLocal]);

  const ownHold = useMemo(
    () => holds.find((h) => h.sessionId === sessionId) ?? null,
    [holds, sessionId],
  );

  useEffect(() => {
    if (!ownHold) return;
    const expires = new Date(ownHold.expiresAt).getTime();
    const left = expires - Date.now();
    if (left <= 0) {
      onExpiredRef.current();
      return;
    }
    const id = window.setTimeout(() => onExpiredRef.current(), left + 50);
    return () => window.clearTimeout(id);
  }, [ownHold]);

  const foreignByHora = useMemo(() => {
    const map = new Map<string, HoldPublic>();
    const now = Date.now();
    for (const h of holds) {
      if (h.sessionId === sessionId) continue;
      if (h.fecha !== fecha) continue;
      if (new Date(h.expiresAt).getTime() <= now) continue;
      for (const hora of h.horas) {
        map.set(hora, h);
      }
    }
    return map;
  }, [holds, sessionId, fecha]);

  return {
    connected,
    syncError,
    ownHold,
    foreignByHora,
    sessionId,
    politica,
  };
}
