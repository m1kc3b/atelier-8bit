/* ─────────────────────────────────────────────────────────────
   Chuck IDE — tests/chuck-toolbar.test.ts

   Tests de la machine à états de la toolbar (5 états) et du
   comportement des boutons selon l'état courant.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Machine à états inline (découplée du Web Component) ───────
// On teste la logique pure de applyState() sans DOM Shadow.

type ToolbarState = 'idle' | 'assembled' | 'running' | 'paused' | 'debugging';

interface ButtonConfig {
  assemble:    boolean; // true = activé
  run:         boolean;
  step:        boolean;
  reset:       boolean;
  debug:       boolean;
  hexdump:     boolean;
  disassemble: boolean;
}

/**
 * Calcule l'état des boutons à partir d'un ToolbarState.
 * Extrait de ChuckToolbar.applyState() pour test pur.
 */
function resolveButtons(state: ToolbarState): ButtonConfig {
  const idle      = state === 'idle';
  const running   = state === 'running';
  const debugging = state === 'debugging';

  return {
    assemble:    !(!idle && state !== 'assembled'), // actif si idle ou assembled
    run:         !(idle || debugging),
    step:        !(idle || state === 'assembled' || running),
    reset:       !idle,
    debug:       !(idle || running),
    hexdump:     !(idle || running),
    disassemble: !(idle || running),
  };
}

// ── Tests de la machine à états ───────────────────────────────

describe('ChuckToolbar — machine à états', () => {

  describe("état 'idle'", () => {
    const cfg = resolveButtons('idle');

    it('assemble est actif',          () => expect(cfg.assemble).toBe(true));
    it('run est désactivé',           () => expect(cfg.run).toBe(false));
    it('step est désactivé',          () => expect(cfg.step).toBe(false));
    it('reset est désactivé',         () => expect(cfg.reset).toBe(false));
    it('debug est désactivé',         () => expect(cfg.debug).toBe(false));
    it('hexdump est désactivé',       () => expect(cfg.hexdump).toBe(false));
    it('disassemble est désactivé',   () => expect(cfg.disassemble).toBe(false));
  });

  describe("état 'assembled'", () => {
    const cfg = resolveButtons('assembled');

    it('assemble reste actif (réassemblage possible)', () => expect(cfg.assemble).toBe(true));
    it('run est actif',     () => expect(cfg.run).toBe(true));
    it('step est désactivé (pas encore en pause)',     () => expect(cfg.step).toBe(false));
    it('reset est actif',   () => expect(cfg.reset).toBe(true));
    it('debug est actif',   () => expect(cfg.debug).toBe(true));
    it('hexdump est actif', () => expect(cfg.hexdump).toBe(true));
  });

  describe("état 'running'", () => {
    const cfg = resolveButtons('running');

    it("assemble est désactivé pendant l'exécution", () => expect(cfg.assemble).toBe(false));
    it('run (Stop) est actif',                       () => expect(cfg.run).toBe(true));
    it('step est désactivé',                         () => expect(cfg.step).toBe(false));
    it('reset est actif',                            () => expect(cfg.reset).toBe(true));
    it('debug est désactivé',                        () => expect(cfg.debug).toBe(false));
    it('hexdump est désactivé',                      () => expect(cfg.hexdump).toBe(false));
    it('disassemble est désactivé',                  () => expect(cfg.disassemble).toBe(false));
  });

  describe("état 'paused'", () => {
    const cfg = resolveButtons('paused');

    it('run (Reprendre) est actif', () => expect(cfg.run).toBe(true));
    it('step est actif',            () => expect(cfg.step).toBe(true));
    it('debug est actif',           () => expect(cfg.debug).toBe(true));
    it('hexdump est actif',         () => expect(cfg.hexdump).toBe(true));
  });

  describe("état 'debugging'", () => {
    const cfg = resolveButtons('debugging');

    it('run est désactivé (en debug, on utilise step)',  () => expect(cfg.run).toBe(false));
    it('step est actif',                                  () => expect(cfg.step).toBe(true));
    it('debug (Quitter) est actif',                       () => expect(cfg.debug).toBe(true));
    it('hexdump est actif',                               () => expect(cfg.hexdump).toBe(true));
  });
});

// ── Tests des transitions légales ─────────────────────────────

describe("ChuckToolbar — transitions d'état", () => {

  it('idle → assembled après chuck:assembled', () => {
    // Transition déclenchée par l'événement assemblé
    // Vérifie que le passage idle→assembled active les bons boutons
    const before = resolveButtons('idle');
    const after  = resolveButtons('assembled');

    expect(before.run).toBe(false);
    expect(after.run).toBe(true);
    expect(after.reset).toBe(true);
  });

  it('assembled → running au clic Run', () => {
    const after = resolveButtons('running');
    // En running, le bouton affiche "Stop"
    // Le bouton step doit être désactivé
    expect(after.step).toBe(false);
    expect(after.run).toBe(true); // Stop visible
  });

  it('running → paused au clic Stop', () => {
    // Simulation du cycle running → stop → paused
    const after = resolveButtons('paused');
    expect(after.step).toBe(true);   // step disponible en pause
    expect(after.run).toBe(true);    // Reprendre disponible
  });

  it('assembled → debugging via bouton Debug', () => {
    const after = resolveButtons('debugging');
    expect(after.run).toBe(false);   // pas de run en debug
    expect(after.step).toBe(true);   // step par step
    expect(after.debug).toBe(true);  // Quitter actif
  });

  it('idle → idle après chuck:code-changed (réinitialisation)', () => {
    // Quand le code change, on revient à idle
    const cfg = resolveButtons('idle');
    expect(cfg.assemble).toBe(true);  // on peut réassembler
    expect(cfg.run).toBe(false);       // mais pas lancer
  });
});

// ── Tests du libellé du bouton Run ────────────────────────────

describe('ChuckToolbar — libellé bouton Run', () => {

  function runLabel(state: ToolbarState): string {
    if (state === 'running') return 'Stop';
    if (state === 'paused')  return 'Reprendre';
    return 'Run';
  }

  it("libellé 'Run' en état idle/assembled",      () => expect(runLabel('assembled')).toBe('Run'));
  it("libellé 'Stop' en état running",            () => expect(runLabel('running')).toBe('Stop'));
  it("libellé 'Reprendre' en état paused",        () => expect(runLabel('paused')).toBe('Reprendre'));
  it("libellé 'Run' en état debugging (inactif)", () => expect(runLabel('debugging')).toBe('Run'));
});

// ── Tests du bouton Debug ─────────────────────────────────────

describe('ChuckToolbar — bouton Debug', () => {

  function debugLabel(state: ToolbarState): string {
    return state === 'debugging' ? 'Quitter' : 'Debug';
  }

  function debugTitle(state: ToolbarState): string {
    return state === 'debugging'
      ? 'Quitter le mode debug'
      : 'Mode debug pas à pas';
  }

  it("libellé 'Debug' hors mode debug",        () => expect(debugLabel('assembled')).toBe('Debug'));
  it("libellé 'Quitter' en mode debug",        () => expect(debugLabel('debugging')).toBe('Quitter'));
  it("title correct hors debug",               () => expect(debugTitle('assembled')).toContain('pas à pas'));
  it("title correct en debug",                 () => expect(debugTitle('debugging')).toContain('Quitter'));
});

// ── Tests des actions dispatchées ─────────────────────────────

describe('ChuckToolbar — actions émises sur le bus', () => {

  // On modélise dispatchAction() sans le Web Component
  type EmittedEvent = { event: string; detail?: unknown };

  function simulateAction(
    action: string,
    currentState: ToolbarState,
    source = 'LDA #$42\nBRK',
  ): EmittedEvent[] {
    const events: EmittedEvent[] = [];
    const emit = (e: string, d?: unknown) => events.push({ event: e, detail: d });

    switch (action) {
      case 'assemble':
        emit('chuck:assemble', { source });
        break;

      case 'run':
        if (currentState === 'running') {
          emit('chuck:stop');
        } else if (currentState === 'paused' || currentState === 'assembled') {
          emit('chuck:run');
        } else if (currentState === 'debugging') {
          emit('chuck:debug', { enabled: false });
          emit('chuck:run');
        }
        break;

      case 'step':
        if (currentState === 'paused') emit('chuck:debug', { enabled: true });
        emit('chuck:step');
        break;

      case 'reset':
        emit('chuck:reset');
        break;

      case 'debug':
        if (currentState === 'assembled' || currentState === 'paused') {
          emit('chuck:debug', { enabled: true });
        } else if (currentState === 'debugging') {
          emit('chuck:debug', { enabled: false });
        }
        break;
    }

    return events;
  }

  it("assemble → émet chuck:assemble avec le source", () => {
    const events = simulateAction('assemble', 'idle', 'LDA #$01');
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe('chuck:assemble');
    expect((events[0]!.detail as any).source).toBe('LDA #$01');
  });

  it("run depuis assembled → émet chuck:run", () => {
    const events = simulateAction('run', 'assembled');
    expect(events.some(e => e.event === 'chuck:run')).toBe(true);
  });

  it("run depuis running → émet chuck:stop (pause)", () => {
    const events = simulateAction('run', 'running');
    expect(events[0]!.event).toBe('chuck:stop');
  });

  it("run depuis debugging → émet debug:false puis chuck:run", () => {
    const events = simulateAction('run', 'debugging');
    expect(events[0]).toMatchObject({ event: 'chuck:debug', detail: { enabled: false } });
    expect(events[1]!.event).toBe('chuck:run');
  });

  it("step depuis paused → émet chuck:debug enabled puis chuck:step", () => {
    const events = simulateAction('step', 'paused');
    expect(events[0]).toMatchObject({ event: 'chuck:debug', detail: { enabled: true } });
    expect(events[1]!.event).toBe('chuck:step');
  });

  it("step depuis debugging → émet seulement chuck:step", () => {
    const events = simulateAction('step', 'debugging');
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe('chuck:step');
  });

  it("reset → émet chuck:reset", () => {
    const events = simulateAction('reset', 'assembled');
    expect(events[0]!.event).toBe('chuck:reset');
  });

  it("debug depuis assembled → active le mode debug", () => {
    const events = simulateAction('debug', 'assembled');
    expect(events[0]).toMatchObject({ event: 'chuck:debug', detail: { enabled: true } });
  });

  it("debug depuis debugging → désactive le mode debug", () => {
    const events = simulateAction('debug', 'debugging');
    expect(events[0]).toMatchObject({ event: 'chuck:debug', detail: { enabled: false } });
  });
});