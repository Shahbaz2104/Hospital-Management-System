"use client";

import * as React from "react";

/** Registers the PWA service worker (no-op in dev; only secure contexts). */
export function PwaRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: app works without offline support
    });
  }, []);

  return null;
}
