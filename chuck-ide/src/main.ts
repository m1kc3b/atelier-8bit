/* ─────────────────────────────────────────────────────────────
   Chuck IDE — main.ts
   Point d'entrée. Enregistre les Web Components, instancie
   le bridge émulateur, câble les contrôles globaux.
   ───────────────────────────────────────────────────────────── */

import "./styles/global.css";

// ── Enregistrement des Web Components ────────────────────────
import "./components/chuck-toolbar.js";
import "./components/chuck-editor.js";
import "./components/chuck-display.js";
import "./components/chuck-registers.js";
// import "./components/chuck-memory-dump.js";
import "./components/chuck-side-panel.js";
import "./components/chuck-help-modal.js";
import "./components/chuck-learn-modal.js";
import "./components/chuck-auth-gate.js";
import "./components/chuck-account-modal.js";
import "./components/chuck-welcome-modal.js";
import "./components/chuck-onboarding-tour.js";
import { setView, getViewFromUrl, initRouter } from "./core/router.js";

import { authService } from "./core/auth/auth-service.js";

import { bus } from "./core/bus.js";
import { Emulator } from "./core/emulator.js";
import { ChallengeManager } from "./core/challenge-manager.js";
import { storage } from "./core/storage/storage-service.js";

document.addEventListener("DOMContentLoaded", async () => {
  // ── Émulateur WASM ───────────────────────────────────────
  // Chargement async du module Rust/WASM
  const displayEl = document.getElementById("modal-display") as
    | (HTMLElement & { show(): void; toggle(): void })
    | null;

  // ── Titlebar — toggles modales flottantes ────────────────
  const registersEl = document.getElementById("modal-registers") as
    | (HTMLElement & { toggle(): void })
    | null;
  const memoryEl = document.getElementById("modal-memory") as
    | (HTMLElement & { toggle(): void })
    | null;
  const sidePanel = document.getElementById("side-panel") as HTMLElement | null;

  document
    .getElementById("btn-show-display")
    ?.addEventListener("click", () => displayEl?.toggle());
  document
    .getElementById("btn-show-registers")
    ?.addEventListener("click", () => registersEl?.toggle());
  document
    .getElementById("btn-show-memory")
    ?.addEventListener("click", () => memoryEl?.toggle());
  document.getElementById("btn-show-help")?.addEventListener("click", () => {
    const help = document.getElementById("modal-help") as
      | (HTMLElement & { toggle(): void })
      | null;
    help?.toggle();
  });

  function openSidePanel(): void {
    sidePanel?.classList.add("panel-open");
  }
  function closeSidePanel(): void {
    sidePanel?.classList.remove("panel-open");
  }

  const titlebarFile = document.getElementById("titlebar-file")!;

  // ── Navigation 3 sections (Atelier / Challenges / Pong) ───
  const viewWorkspace  = document.getElementById("workspace") as HTMLElement | null;
  const viewChallenges = document.getElementById("view-challenges") as HTMLElement | null;
  const viewPong       = document.getElementById("view-pong") as HTMLElement | null;
  const navButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("#main-nav .nav-btn"),
  );

  function applyView(view: "atelier" | "challenges" | "pong"): void {
    viewWorkspace?.classList.toggle("view-hidden", view !== "atelier");
    viewChallenges?.classList.toggle("view-hidden", view !== "challenges");
    viewPong?.classList.toggle("view-hidden", view !== "pong");
    navButtons.forEach((btn) =>
      btn.classList.toggle("active", btn.dataset.view === view),
    );
  }

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      setView(btn.dataset.view as "atelier" | "challenges" | "pong");
    });
  });

  bus.on("chuck:view-changed", ({ view }) => applyView(view));
  initRouter();

  // Lien profond (?challenge= / ?lesson=) → forcer l'affichage Atelier
  const deepLinkParams = new URLSearchParams(window.location.search);
  if (deepLinkParams.has("challenge") || deepLinkParams.has("lesson")) {
    applyView("atelier");
  }

  // ── Email gate — défis verrouillés (4+) ─────────────────────
  const gateEl = document.getElementById("modal-auth-gate") as
    | (HTMLElement & { open(id: number): void })
    | null;

  const accountModal = document.getElementById("modal-account") as
    | (HTMLElement & { open(): void })
    | null;

  authService.onPasswordRecovery(() => {
    accountModal?.open();
  });

  bus.on("chuck:open-account", () => {
    if (authService.isAuthenticated()) {
      accountModal?.open();
    } else {
      gateEl?.open(0);
    }
  });

  // init() émet chuck:challenge-loaded de façon synchrone — les listeners
  // doivent exister avant l'appel.

  bus.on("chuck:challenge-loaded", ({ challenge }) => {
    if (challenge.locked && !storage.isUnlocked()) {
      gateEl?.open(challenge.id);
    }
  });

  bus.on("chuck:challenge-loaded", ({ challenge }) => {
    const label = `Défi ${challenge.id} — ${challenge.title}`;
    titlebarFile.textContent = label;
    document.title = `${label} — Chuck IDE`;
    openSidePanel();
  });

  bus.on("chuck:require-auth" as any, () => {
    gateEl?.open(0); // 0 = pas de défi en attente, juste sauvegarde/nouveau projet
  });

  (bus as any).on(
    "chuck:content-loaded",
    ({ item }: { item: { id: number; title: string } }) => {
      titlebarFile.textContent = item.title;
      document.title = `${item.title} — Chuck IDE`;
      openSidePanel();
    },
  );

  (bus as any).on("chuck:ide-free", () => {
    titlebarFile.textContent = "mode libre";
    document.title = "Chuck IDE — Chuck-8 Computer";
    closeSidePanel();
  });

  // ── ChallengeManager ─────────────────────────────────────
  const challengeManager = new ChallengeManager();
  await challengeManager.init(await Emulator.create());

  // ── Modale de bienvenue ──────────────────────────────────
  const welcomeModal = document.getElementById("modal-welcome") as
    | (HTMLElement & { open(view?: "choice" | "list"): void })
    | null;

  const urlParams = new URLSearchParams(window.location.search);
  const rawChallenge = urlParams.get("challenge") ?? urlParams.get("lesson");
  const isNumericChallenge =
    rawChallenge !== null && /^\d+$/.test(rawChallenge);
  const isBareChallenge = urlParams.has("challenge") && !isNumericChallenge;

  if (!isNumericChallenge) {
    welcomeModal?.open(isBareChallenge ? "list" : "choice");
  }

  const sbState = document.getElementById("sb-state")!;
  const sbCursor = document.getElementById("sb-cursor")!;
  const sbPc = document.getElementById("sb-pc")!;

  const addr2hex = (n: number) => n.toString(16).padStart(4, "0").toUpperCase();

  bus.on("chuck:assembled", () => {
    sbState.textContent = "Assemblé";
    sbState.className = "sb-state";
    bus.emit("chuck:toolbar-state", { state: "assembled" });
  });
  bus.on("chuck:assemble-err", () => {
    sbState.textContent = "Erreur";
    sbState.className = "sb-state error";
  });
  bus.on("chuck:stop", () => {
    sbState.textContent = "En pause";
    sbState.className = "sb-state";
    bus.emit("chuck:toolbar-state", { state: "paused" });
  });
  bus.on("chuck:cpu-reset", () => {
    sbState.textContent = "Réinitialisé";
    sbState.className = "sb-state";
    bus.emit("chuck:toolbar-state", { state: "assembled" });
  });
  bus.on("chuck:cpu-halted", () => {
    sbState.textContent = "Terminé";
    sbState.className = "sb-state";
    bus.emit("chuck:toolbar-state", { state: "assembled" });
  });
  bus.on("chuck:cpu-error", () => {
    sbState.textContent = "Erreur CPU";
    sbState.className = "sb-state error";
    bus.emit("chuck:toolbar-state", { state: "assembled" });
  });
  bus.on("chuck:code-changed", () => {
    sbState.textContent = "Prêt";
    sbState.className = "sb-state";
  });

  // ── Au Run : ouvrir les modales et gérer les z-index ─────
  // La modale aide reste en dessous (z-index 500)
  // Les modales runtime (écran, registres, mémoire) passent devant (z-index 1000)
  const helpEl = document.getElementById("modal-help") as HTMLElement | null;
  if (helpEl) helpEl.style.zIndex = "500";

  function ensureOpen(el: (HTMLElement & { show?(): void }) | null): void {
    if (!el) return;
    const isOpen =
      el.classList.contains("visible") || el.classList.contains("open");
    if (isOpen) return;
    if (el.show) el.show();
    else el.classList.add("visible");
    el.style.zIndex = "1000";
  }

  bus.on("chuck:run", () => {
    sbState.textContent = "En cours…";
    sbState.className = "sb-state running";
    ensureOpen(displayEl as any);
    ensureOpen(registersEl as any);
    ensureOpen(memoryEl as any);
  });

  bus.on("chuck:cpu-updated", ({ PC }) => {
    sbPc.textContent = `$${addr2hex(PC)}`;
  });
  bus.on("chuck:cursor-moved", ({ line, col }) => {
    sbCursor.textContent = `Ln ${line}  Col ${col}`;
  });

  // Mode vidéo dans la status bar
  const sbMode = document.getElementById("sb-mode");
  (bus as any).on("chuck:vpu-mode", ({ mode }: { mode: number }) => {
    if (sbMode) sbMode.textContent = mode === 0 ? "TXT" : "GFX";
  });

  // ── Keyboard shortcuts ───────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "B") {
      e.preventDefault();
      const editorEl = document.getElementById("editor") as
        | (HTMLElement & { getSource?: () => string })
        | null;
      bus.emit("chuck:assemble", { source: editorEl?.getSource?.() ?? "" });
    }
    if (e.key === "F5") {
      e.preventDefault();
      bus.emit("chuck:run", undefined);
    }
    if (e.key === "F10") {
      e.preventDefault();
      bus.emit("chuck:step", undefined);
    }
  });

  console.info("[Chuck IDE v0.2.0 — Rust/WASM core] Initialisé ✓");

  // ── ?learn → ouvre la modale de formation ────────────────
  if (new URLSearchParams(window.location.search).has("learn")) {
    const learnEl = document.getElementById("modal-learn") as
      | (HTMLElement & { open(): void })
      | null;
    learnEl?.open();
  }
});
