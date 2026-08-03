"use client";

import {
  syncFavoritosAction,
  toggleFavoritoAction,
} from "@/app/actions/favoritos";
import { useCallback, useEffect, useState } from "react";

const KEY = "salas:favoritos";

function readLocal(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids));
}

export function useFavoritos() {
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const local = readLocal();
      const res = await syncFavoritosAction(local);
      if (cancelled) return;
      setIds(res.ids);
      writeLocal(res.ids);
      setLoggedIn(res.loggedIn);
      setReady(true);
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(async (id: string) => {
    const res = await toggleFavoritoAction(id);
    if (res.ok) {
      setIds(res.ids);
      writeLocal(res.ids);
      setLoggedIn(true);
      return;
    }
    setIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      writeLocal(next);
      return next;
    });
  }, []);

  const has = useCallback((id: string) => ids.includes(id), [ids]);

  return { ids, has, toggle, ready, loggedIn };
}
