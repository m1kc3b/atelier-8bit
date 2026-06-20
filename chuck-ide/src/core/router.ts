/* ─────────────────────────────────────────────────────────────
   Chuck IDE — core/router.ts
   Routeur minimal pour les 3 sections du funnel :
   Atelier (mode libre/IDE) · Challenges · Coder Pong.
   ───────────────────────────────────────────────────────────── */

import { bus } from "./bus.js";

export type ViewName = "atelier" | "challenges" | "pong";

const VALID_VIEWS: ViewName[] = ["atelier", "challenges", "pong"];

export function getViewFromUrl(): ViewName {
  const v = new URLSearchParams(window.location.search).get("view");
  return (VALID_VIEWS as string[]).includes(v ?? "") ? (v as ViewName) : "atelier";
}

export function setView(view: ViewName, push = true): void {
  const url = new URL(window.location.href);
  if (view === "atelier") {
    url.searchParams.delete("view");
  } else {
    url.searchParams.set("view", view);
  }
  if (push) {
    window.history.pushState({}, "", url.toString());
  } else {
    window.history.replaceState({}, "", url.toString());
  }
  bus.emit("chuck:view-changed", { view });
}

export function initRouter(): void {
  bus.emit("chuck:view-changed", { view: getViewFromUrl() });
  window.addEventListener("popstate", () => {
    bus.emit("chuck:view-changed", { view: getViewFromUrl() });
  });
}