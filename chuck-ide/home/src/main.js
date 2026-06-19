/* ─────────────────────────────────────────────────────────────
   Chuck IDE — home.js
   Landing page statique — pas de routeur, liens directs.

     IDE        → /editor
     Formation  → /learn
     Défi N     → /editor?challenge=N

   La progression (médailles, défis complétés) est lue depuis
   localStorage si présente (clé "chuck8_v2"), sinon la grille
   s'affiche sans badges.
   ───────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  // Nombre de défis affichés. Ajuste selon ton contenu réel.
  const TOTAL_CHALLENGES = 8;

  // Premier défi nécessitant un compte (email gate)
  const CHALLENGE_GATE = 4;

  const STORAGE_KEY = "chuck8_v2";

  // ── Lecture progression locale (best-effort, ne casse rien si absente) ──
  function readProgress() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        progress: raw.progress || {},
        isLoggedIn: Boolean(raw.auth && raw.auth.email),
      };
    } catch {
      return { progress: {}, isLoggedIn: false };
    }
  }

  // ── Construction d'une carte défi ──────────────────────────
  function buildCard(id, progress, isLoggedIn) {
    const entry = progress[id] || {};
    const completed = Boolean(entry.completed);
    const medal = entry.medal || null;
    const locked = id >= CHALLENGE_GATE && !isLoggedIn;

    const card = document.createElement("div");
    card.className = "challenge-card" + (completed ? " completed" : "") + (locked ? " locked" : "");

    if (locked) {
      card.innerHTML = `
        <span class="card-num">Défi ${id}</span>
        <span class="card-title">Accès réservé</span>
        <div class="card-footer">
          <span class="card-lock">🔒 connexion requise</span>
        </div>
      `;
      // Pas de navigation directe : on renvoie vers l'éditeur, qui gère
      // lui-même la redirection login si besoin.
      card.addEventListener("click", () => {
        window.location.href = "/editor?challenge=" + id;
      });
      return card;
    }

    card.innerHTML = `
      <span class="card-num">Défi ${id}</span>
      <span class="card-title">Challenge ${id}</span>
      <div class="card-footer">
        ${medal ? `<span class="card-badge">${medal}</span>` : "<span></span>"}
      </div>
    `;
    card.addEventListener("click", () => {
      window.location.href = "/editor?challenge=" + id;
    });
    return card;
  }

  // ── Rendu de la grille ───────────────────────────────────────
  function renderChallenges() {
    const grid = document.getElementById("challenges-grid");
    if (!grid) return;

    const { progress, isLoggedIn } = readProgress();
    grid.innerHTML = "";

    for (let id = 1; id <= TOTAL_CHALLENGES; id++) {
      grid.appendChild(buildCard(id, progress, isLoggedIn));
    }
  }

  // ── Liens statiques ────────────────────────────────────────
  function bindLinks() {
    document.querySelectorAll("[data-href]").forEach((el) => {
      el.addEventListener("click", () => {
        window.location.href = el.getAttribute("data-href");
      });
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindLinks();
    renderChallenges();
  });
})();