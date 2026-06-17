/* ═══════════════════════════════════════════════════════════════
   Chuck IDE — tests/bus.test.ts
   Tests unitaires : EventBus
   ═══════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../core/bus.js';

// ── Helpers ──────────────────────────────────────────────────────

/** Crée une instance fraîche (évite la pollution entre tests) */
function makeBus() {
  return new EventBus();
}

// ── Suite ────────────────────────────────────────────────────────

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = makeBus();
  });

  // ── emit / on ─────────────────────────────────────────────────

  describe('emit + on', () => {
    it('appelle le handler avec le detail correct', () => {
      const handler = vi.fn();
      bus.on('chuck:speed', handler);
      bus.emit('chuck:speed', { value: 75 });
      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ value: 75 });
    });

    it('appelle tous les handlers enregistrés sur le même événement', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('chuck:reset', h1);
      bus.on('chuck:reset', h2);
      bus.emit('chuck:reset', undefined);
      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });

    it('ne déclenche pas les handlers d\'autres événements', () => {
      const handler = vi.fn();
      bus.on('chuck:run', handler);
      bus.emit('chuck:stop', undefined);
      expect(handler).not.toHaveBeenCalled();
    });

    it('transmet correctement les payloads complexes (CpuState)', () => {
      const handler = vi.fn();
      const state = { A: 0x42, X: 0x01, Y: 0x00, P: 0b00100000, PC: 0x0600, SP: 0xFF };
      bus.on('chuck:cpu-updated', handler);
      bus.emit('chuck:cpu-updated', state);
      expect(handler).toHaveBeenCalledWith(state);
    });

    it('supporte les payloads undefined (événements sans données)', () => {
      // Note : CustomEvent sérialise `undefined` en `null` dans JSDOM/certains navigateurs.
      // Ce comportement est conforme à la spec (detail non-clonable → null).
      // Le bus reçoit bien l'événement — seul le detail diffère.
      const handler = vi.fn();
      bus.on('chuck:run', handler);
      bus.emit('chuck:run', undefined);
      expect(handler).toHaveBeenCalledTimes(1);
      // Le payload est null ou undefined selon l'environnement
      expect(handler.mock.calls[0][0] ?? undefined).toBeUndefined();
    });

    it('passe correctement l\'AssembleResult', () => {
      const handler = vi.fn();
      const result = { ok: true, bytes: 6, buf: [0xa9, 0x01, 0x8d, 0x00, 0x02, 0x00] };
      bus.on('chuck:assembled', handler);
      bus.emit('chuck:assembled', result);
      expect(handler).toHaveBeenCalledWith(result);
    });
  });

  // ── Désabonnement ─────────────────────────────────────────────

  describe('désabonnement', () => {
    it('retourne une fonction de désinscription fonctionnelle', () => {
      const handler = vi.fn();
      const unsub = bus.on('chuck:step', handler);

      bus.emit('chuck:step', undefined);
      expect(handler).toHaveBeenCalledOnce();

      unsub(); // se désabonner
      bus.emit('chuck:step', undefined);
      expect(handler).toHaveBeenCalledOnce(); // toujours 1 seul appel
    });

    it('n\'affecte pas les autres handlers lors du désabonnement', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      const unsub1 = bus.on('chuck:stop', h1);
      bus.on('chuck:stop', h2);

      unsub1();
      bus.emit('chuck:stop', undefined);

      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledOnce();
    });

    it('double appel de unsub est sans effet', () => {
      const handler = vi.fn();
      const unsub = bus.on('chuck:reset', handler);
      unsub();
      expect(() => unsub()).not.toThrow();
      bus.emit('chuck:reset', undefined);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── once ──────────────────────────────────────────────────────

  describe('once', () => {
    it('appelle le handler une seule fois', () => {
      const handler = vi.fn();
      bus.once('chuck:run', handler);
      bus.emit('chuck:run', undefined);
      bus.emit('chuck:run', undefined);
      bus.emit('chuck:run', undefined);
      expect(handler).toHaveBeenCalledOnce();
    });

    it('reçoit le bon payload', () => {
      const handler = vi.fn();
      bus.once('chuck:goto', handler);
      bus.emit('chuck:goto', { address: 0x1234 });
      expect(handler).toHaveBeenCalledWith({ address: 0x1234 });
    });
  });

  // ── Isolation entre instances ─────────────────────────────────

  describe('isolation des instances', () => {
    it('deux bus distincts ne partagent pas leurs événements', () => {
      const bus2 = makeBus();
      const handler = vi.fn();

      bus.on('chuck:run', handler);
      bus2.emit('chuck:run', undefined); // émis sur l'autre bus

      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ── Événements log ────────────────────────────────────────────

  describe('chuck:log', () => {
    it('transmet tous les niveaux de log', () => {
      const handler = vi.fn();
      bus.on('chuck:log', handler);

      const levels = ['info', 'ok', 'err', 'hex', 'dim'] as const;
      for (const level of levels) {
        bus.emit('chuck:log', { text: `test ${level}`, level });
      }

      expect(handler).toHaveBeenCalledTimes(5);
      expect(handler).toHaveBeenCalledWith({ text: 'test err', level: 'err' });
    });
  });

  // ── Événements challenge ──────────────────────────────────────

  describe('événements challenge', () => {
    it('chuck:autosave transporte id et code', () => {
      const handler = vi.fn();
      bus.on('chuck:autosave', handler);
      bus.emit('chuck:autosave', { id: 3, code: 'LDA #$01\nBRK' });
      expect(handler).toHaveBeenCalledWith({ id: 3, code: 'LDA #$01\nBRK' });
    });

    it('chuck:validate transporte source et hintsUsed', () => {
      const handler = vi.fn();
      bus.on('chuck:validate', handler);
      bus.emit('chuck:validate', { source: 'LDA #$42\nBRK', hintsUsed: 1 });
      expect(handler).toHaveBeenCalledWith({ source: 'LDA #$42\nBRK', hintsUsed: 1 });
    });

    it('chuck:goto-challenge transporte l\'id', () => {
      const handler = vi.fn();
      bus.on('chuck:goto-challenge', handler);
      bus.emit('chuck:goto-challenge', { id: 7 });
      expect(handler).toHaveBeenCalledWith({ id: 7 });
    });
  });
});