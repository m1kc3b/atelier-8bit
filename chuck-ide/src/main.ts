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
import "./components/chuck-side-panel.js";
import "./components/chuck-help-modal.js";
import "./components/chuck-learn-modal.js";
import "./components/chuck-auth-gate.js";
import "./components/chuck-account-modal.js";
import "./components/chuck-welcome-modal.js";
import "./components/chuck-onboarding-tour.js";
import "./components/chuck-challenges-list.js";
import "./components/chuck-track-roadmap.js";
import "./components/chuck-track-paywall.js";

import { authService } from "./core/auth/auth-service.js";

import { bus } from "./core/bus.js";
import { Emulator } from "./core/emulator.js";
import { ChallengeManager } from "./core/challenge-manager.js";
import { storage } from "./core/storage/storage-service.js";
import { funnelTracker } from "./core/funnel-tracker.js";
import { superAdmin } from "./core/super-admin.js";

document.addEventListener("DOMContentLoaded", async () => {
  // ── Tracking funnel ──────────────────────────────────────
  // Démarré en premier : visitor_id prêt avant la 1ère étape tracée.
  funnelTracker.start();

  // ── Modale de bienvenue — affichée IMMÉDIATEMENT ─────────
  // Ouverte avant le chargement de l'émulateur WASM et des défis, pour
  // qu'elle apparaisse dès l'arrivée sur le site (pas après le réseau/WASM).
  const welcomeModal = document.getElementById("modal-welcome") as
    | (HTMLElement & {
        open(view?: "choice" | "challenges" | "pong"): Promise<void>;
      })
    | null;
  {
    const urlParams = new URLSearchParams(window.location.search);
    const rawChallenge =
      urlParams.get("parcours") ??
      urlParams.get("challenge") ??
      urlParams.get("lesson");
    const isNumericChallenge =
      rawChallenge !== null && /^\d+$/.test(rawChallenge);
    const hasParcours =
      urlParams.has("parcours") ||
      urlParams.has("challenge") ||
      urlParams.has("lesson");
    const isBareChallenge = hasParcours && !isNumericChallenge;
    if (!isNumericChallenge) {
      void welcomeModal?.open(isBareChallenge ? "challenges" : "choice");
    }
  }

  // ── Émulateur WASM ───────────────────────────────────────
  // Chargement async du module Rust/WASM
  const displayEl = document.getElementById("modal-display") as
    | (HTMLElement & { show(): void; toggle(): void })
    | null;

  // ── Titlebar — toggles modales flottantes ────────────────
  const registersEl = document.getElementById("modal-registers") as
    | (HTMLElement & { toggle(): void })
    | null;
    
  const sidePanel = document.getElementById("side-panel") as HTMLElement | null;

  document
    .getElementById("btn-show-display")
    ?.addEventListener("click", () => displayEl?.toggle());
  document
    .getElementById("btn-show-registers")
    ?.addEventListener("click", () => registersEl?.toggle());
  
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
  // Plus de vues plein écran : challenges et pong vivent dans la modale
  // welcome. Le workspace (IDE) reste toujours monté en dessous.

  // Bouton « Menu » de la titlebar → rouvre la modale sur la dernière vue.
  document
    .getElementById("btn-show-welcome")
    ?.addEventListener("click", () => bus.emit("chuck:open-welcome", undefined));

  // ── Email gate — défis verrouillés (4+) ─────────────────────
  const gateEl = document.getElementById("modal-auth-gate") as
    | (HTMLElement & {
        open(opts?: {
          challengeId?: number;
          title?: string;
          sub?: string;
          dismissible?: boolean;
        }): void;
      })
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
      gateEl?.open({
        title: "Connecte-toi à ton compte",
        sub: "Retrouve ta progression et tes réalisations sauvegardées.",
        dismissible: true,
      });
    }
  });

  // init() émet chuck:challenge-loaded de façon synchrone — les listeners
  // doivent exister avant l'appel.

  // Couleur du mode actif, propagée à tout l'UI via --mode-color sur :root.
  type ModeName = "free" | "challenges" | "pong";
  function setMode(mode: ModeName): void {
    const root = document.documentElement;
    root.style.setProperty("--mode-color", `var(--mode-${mode})`);
    root.style.setProperty("--mode-color-dim", `var(--mode-${mode}-dim)`);
    root.dataset.mode = mode;
  }

  // Nom d'affichage d'un parcours à partir de son slug ('pong' → 'Pong').
  function parcoursName(trackId: string): string {
    return trackId.charAt(0).toUpperCase() + trackId.slice(1);
  }

  bus.on("chuck:challenge-loaded", ({ challenge }) => {
    if (challenge.locked && !storage.isUnlocked()) {
      gateEl?.open({
        challengeId: challenge.id,
        title: "Sauvegarde ta progression",
        sub: "Crée un compte pour débloquer la suite des défis et garder tes réalisations.",
      });
    }
  });

  bus.on("chuck:challenge-loaded", ({ challenge, track }) => {
    setMode(track ? "pong" : "challenges");
    const label = track
      ? `${parcoursName(track.trackId)} ${track.stepIndex} — ${challenge.title}`
      : `Défi ${challenge.id} — ${challenge.title}`;
    titlebarFile.textContent = label;
    document.title = `${label} — Chuck IDE`;
    openSidePanel();
  });

  bus.on("chuck:require-auth", ({ reason }) => {
    const copy: Record<string, { title: string; sub: string }> = {
      save: {
        title: "Sauvegarde ton travail",
        sub: "Crée un compte pour enregistrer ce projet et le retrouver plus tard.",
      },
      "new-project": {
        title: "Crée un compte pour démarrer un projet",
        sub: "Tes projets sont sauvegardés et synchronisés sur ton compte.",
      },
      pong: {
        title: "Continue Coder Pong",
        sub: "Crée un compte pour sauvegarder ta progression dans le parcours.",
      },
      challenge: {
        title: "Sauvegarde ta progression",
        sub: "Crée un compte pour débloquer la suite des défis.",
      },
    };
    gateEl?.open(copy[reason] ?? {});
  });

  (bus as any).on(
    "chuck:content-loaded",
    ({ item }: { item: { id: number; title: string } }) => {
      titlebarFile.textContent = item.title;
      document.title = `${item.title} — Chuck IDE`;
      openSidePanel();
    },
  );

  bus.on("chuck:ide-free", () => {
    setMode("free");
    titlebarFile.textContent = "mode libre";
    document.title = "Chuck IDE — Chuck-8 Computer";
    closeSidePanel();
  });

  // ── ChallengeManager ─────────────────────────────────────
  // Charge le flag super-admin AVANT le premier render des défis.
  // Les gardes isUnlocked() / hasPurchasedSync() / isTrackStepAccessible()
  // sont synchrones et lues au moment où init() émet chuck:challenge-loaded ;
  // sans cet await, elles verraient encore active=false et rien ne serait
  // débloqué tant qu'un re-render n'a pas lieu.
  await superAdmin.refresh();
  const challengeManager = new ChallengeManager();
  await challengeManager.init(await Emulator.create());

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