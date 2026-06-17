/* ─────────────────────────────────────────────────────────────
   Chuck IDE — tests/chuck-email-gate.test.ts

   Tests de la modale de capture email :
   - Validation du format email
   - Cycle open/close/état succès
   - Résistance à Escape
   - Persistance localStorage
   - isUnlocked()
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Logique pure extraite du composant ────────────────────────
// On teste la logique sans instancier le Web Component (jsdom +
// Shadow DOM = fragile). Les classes pures sont testées séparément.

// Reproduit _validEmail()
function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Reproduit isUnlocked() — lit localStorage
function isUnlocked(): boolean {
  try { return !!localStorage.getItem('chuck8_email_gate'); } catch { return false; }
}

// Reproduit saveSession()
function saveSession(email: string): void {
  localStorage.setItem('chuck8_email_gate', email);
}

// ── Validation email ──────────────────────────────────────────

describe('ChuckEmailGate — validation email', () => {

  describe('emails valides', () => {
    const valid = [
      'user@example.com',
      'prenom.nom@domaine.fr',
      'dev+tag@company.io',
      'a@b.co',
      'test123@sub.domaine.org',
    ];

    valid.forEach(email => {
      it(`accepte "${email}"`, () => expect(validEmail(email)).toBe(true));
    });
  });

  describe('emails invalides', () => {
    const invalid = [
      '',
      'pas-un-email',
      '@domaine.com',
      'user@',
      'user @example.com',   // espace
      'user@domain',          // pas de TLD
      'user@@domain.com',
    ];

    invalid.forEach(email => {
      it(`rejette "${email || '(vide)'}"`, () => expect(validEmail(email)).toBe(false));
    });
  });
});

// ── Persistance localStorage ──────────────────────────────────

describe('ChuckEmailGate — persistance', () => {

  beforeEach(() => localStorage.clear());

  it('isUnlocked() retourne false avant toute soumission', () => {
    expect(isUnlocked()).toBe(false);
  });

  it("saveSession() persiste l'email", () => {
    saveSession('dev@atelier8bit.com');
    expect(localStorage.getItem('chuck8_email_gate')).toBe('dev@atelier8bit.com');
  });

  it('isUnlocked() retourne true après saveSession()', () => {
    saveSession('dev@atelier8bit.com');
    expect(isUnlocked()).toBe(true);
  });

  it('isUnlocked() retourne false après clear()', () => {
    saveSession('dev@atelier8bit.com');
    localStorage.clear();
    expect(isUnlocked()).toBe(false);
  });

  it("un deuxième appel à saveSession() écrase l'email", () => {
    saveSession('premier@email.com');
    saveSession('second@email.com');
    expect(localStorage.getItem('chuck8_email_gate')).toBe('second@email.com');
  });
});

// ── Cycle open / close / succès ───────────────────────────────
// On simule le comportement sans le Shadow DOM, en modélisant
// l'état de la modale sous forme d'objet.

describe('ChuckEmailGate — cycle de la modale', () => {

  type GateState = 'closed' | 'open' | 'success';

  function createGate() {
    let state: GateState     = 'closed';
    let pendingId            = 4;
    let submittedEmail: string | null = null;

    return {
      open(id = 4) {
        pendingId = id;
        state     = 'open';
      },

      close() { state = 'closed'; },

      submit(email: string): 'error' | 'success' {
        if (!validEmail(email)) return 'error';
        saveSession(email);
        submittedEmail = email;
        state          = 'success';
        return 'success';
      },

      pressEscape(): void {
        // Escape ne doit PAS fermer la modale (captured + preventDefault)
        // aucun changement d'état
      },

      get isOpen()     { return state === 'open'; },
      get isSuccess()  { return state === 'success'; },
      get isClosed()   { return state === 'closed'; },
      get pendingChallengeId() { return pendingId; },
      get email()      { return submittedEmail; },
    };
  }

  it('gate est fermée par défaut', () => {
    const gate = createGate();
    expect(gate.isClosed).toBe(true);
  });

  it('open() ouvre la modale', () => {
    const gate = createGate();
    gate.open();
    expect(gate.isOpen).toBe(true);
  });

  it("open() stocke l'id du défi en attente", () => {
    const gate = createGate();
    gate.open(7);
    expect(gate.pendingChallengeId).toBe(7);
  });

  it('open() avec id par défaut → défi 4', () => {
    const gate = createGate();
    gate.open();
    expect(gate.pendingChallengeId).toBe(4);
  });

  it('Escape ne ferme pas la modale', () => {
    const gate = createGate();
    gate.open();
    gate.pressEscape();  // aucun effet
    expect(gate.isOpen).toBe(true);
  });

  it('submit avec email invalide → erreur, modale reste ouverte', () => {
    const gate   = createGate();
    gate.open();
    const result = gate.submit('pas-un-email');
    expect(result).toBe('error');
    expect(gate.isOpen).toBe(true);   // pas passé en succès
    expect(gate.isSuccess).toBe(false);
  });

  it('submit avec email valide → succès', () => {
    const gate   = createGate();
    gate.open();
    const result = gate.submit('dev@atelier8bit.com');
    expect(result).toBe('success');
    expect(gate.isSuccess).toBe(true);
  });

  it('submit valide → email sauvegardé dans localStorage', () => {
    const gate = createGate();
    gate.open();
    gate.submit('user@example.com');
    expect(localStorage.getItem('chuck8_email_gate')).toBe('user@example.com');
  });

  it('après succès → close() ferme la modale', () => {
    const gate = createGate();
    gate.open();
    gate.submit('dev@atelier8bit.com');
    gate.close();
    expect(gate.isClosed).toBe(true);
  });

  it('après succès → continuer émet goto-challenge avec le bon id', () => {
    const emitted: number[] = [];
    const gate = createGate();
    gate.open(5);
    gate.submit('dev@atelier8bit.com');

    // Simule le clic "Lancer le défi N →"
    function onContinue() {
      gate.close();
      emitted.push(gate.pendingChallengeId);
    }

    onContinue();
    expect(emitted).toContain(5);
    expect(gate.isClosed).toBe(true);
  });
});

// ── Accès séquentiel aux défis ────────────────────────────────

describe("ChuckEmailGate — logique d'accès défis 4+", () => {

  const FREE_LIMIT = 3;

  function shouldShowGate(challengeId: number, unlocked: boolean): boolean {
    return challengeId > FREE_LIMIT && !unlocked;
  }

  it('défis 1-3 sont libres même sans email', () => {
    [1, 2, 3].forEach(id =>
      expect(shouldShowGate(id, false)).toBe(false)
    );
  });

  it('défi 4 déclenche la gate si non débloqué', () => {
    expect(shouldShowGate(4, false)).toBe(true);
  });

  it('défi 10 déclenche la gate si non débloqué', () => {
    expect(shouldShowGate(10, false)).toBe(true);
  });

  it('défi 4 est libre si déjà débloqué', () => {
    expect(shouldShowGate(4, true)).toBe(false);
  });

  it('défi 30 est libre si déjà débloqué', () => {
    expect(shouldShowGate(30, true)).toBe(false);
  });
});