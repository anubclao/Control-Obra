"use client";

/**
 * lib/use-ensure-loaded.ts
 *
 * Carga (una vez) las colecciones del data-store que una página necesita.
 * Uso: useEnsureLoaded("projects", "budgets", "aius");
 *
 * SPEC: docs/specs/bug-presupuestos-persistencia.md (AC-7)
 */

import { useEffect } from "react";
import { useDataStore } from "./data-store";

export function useEnsureLoaded(...keys: string[]) {
  const signature = keys.join(",");
  useEffect(() => {
    const state = useDataStore.getState() as any;
    for (const key of signature.split(",")) {
      const collection = state[key];
      if (collection && !collection.loaded && !collection.loading) {
        void collection.load();
      }
    }
  }, [signature]);
}
