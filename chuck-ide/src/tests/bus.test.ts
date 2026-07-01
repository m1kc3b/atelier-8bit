/* ─────────────────────────────────────────────────────────────
   Tests — core/bus.ts (Event Bus typé)
   Couvre : emit/on, désinscription, once, isolation des canaux,
   absence de replay (un abonné tardif ne reçoit pas les émissions
   passées — comportement documenté qui motive le lazy-loading).
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus, bus } from '../core/bus.js';

describe('EventBus', () => {
  let local: EventBus;

  beforeEach(() => {
    local = new EventBus();
  });

  describe('emit / on', () => {
    it('délivre le detail au handler abonné', () => {
      const handler = vi.fn();
      local.on('chuck:goto', handler);
      local.emit('chuck:goto', { address: 0xe000 });
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith({ address: 0xe000 });
    });

    it('transmet une absence de payload pour les événements sans detail', () => {
      // Les CustomEvent natifs normalisent un detail `undefined` en `null` :
      // le handler est appelé, sans donnée significative.
      const handler = vi.fn();
      local.on('chuck:run', handler);
      local.emit('chuck:run', undefined);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0]).toBeNull();
    });

    it('appelle tous les abonnés d’un même événement', () => {
      const a = vi.fn();
      const b = vi.fn();
      local.on('chuck:reset', a);
      local.on('chuck:reset', b);
      local.emit('chuck:reset', undefined);
      expect(a).toHaveBeenCalledTimes(1);
      expect(b).toHaveBeenCalledTimes(1);
    });

    it('n’appelle pas un handler abonné à un autre événement (isolation des canaux)', () => {
      const onRun = vi.fn();
      const onStop = vi.fn();
      local.on('chuck:run', onRun);
      local.on('chuck:stop', onStop);
      local.emit('chuck:run', undefined);
      expect(onRun).toHaveBeenCalledTimes(1);
      expect(onStop).not.toHaveBeenCalled();
    });

    it('préserve l’objet detail par référence', () => {
      const handler = vi.fn();
      const detail = { source: 'LDA #1' };
      local.on('chuck:assemble', handler);
      local.emit('chuck:assemble', detail);
      expect(handler.mock.calls[0][0]).toBe(detail);
    });
  });

  describe('désinscription', () => {
    it('la fonction retournée par on() arrête la livraison', () => {
      const handler = vi.fn();
      const off = local.on('chuck:step', handler);
      local.emit('chuck:step', undefined);
      off();
      local.emit('chuck:step', undefined);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('désinscrire un handler n’affecte pas les autres', () => {
      const a = vi.fn();
      const b = vi.fn();
      const offA = local.on('chuck:reset', a);
      local.on('chuck:reset', b);
      offA();
      local.emit('chuck:reset', undefined);
      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalledTimes(1);
    });

    it('appeler off() plusieurs fois est sans danger', () => {
      const handler = vi.fn();
      const off = local.on('chuck:step', handler);
      off();
      expect(() => off()).not.toThrow();
    });
  });

  describe('once', () => {
    it('ne déclenche le handler qu’une seule fois', () => {
      const handler = vi.fn();
      local.once('chuck:modal-opened', handler);
      local.emit('chuck:modal-opened', undefined);
      local.emit('chuck:modal-opened', undefined);
      local.emit('chuck:modal-opened', undefined);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('reçoit bien le detail à son unique appel', () => {
      const handler = vi.fn();
      local.once('chuck:goto', handler);
      local.emit('chuck:goto', { address: 0x0200 });
      expect(handler).toHaveBeenCalledWith({ address: 0x0200 });
    });
  });

  describe('absence de replay (motivation du lazy-loading)', () => {
    it('un abonné tardif ne reçoit PAS les émissions antérieures', () => {
      // Émis AVANT que le composant ne s’abonne (cas du late-mount).
      local.emit('chuck:ide-defi', undefined);
      const lateHandler = vi.fn();
      local.on('chuck:ide-defi', lateHandler);
      expect(lateHandler).not.toHaveBeenCalled();
      // …mais reçoit bien une émission postérieure (re-emit après abonnement).
      local.emit('chuck:ide-defi', undefined);
      expect(lateHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('singleton exporté', () => {
    it('expose une instance EventBus prête à l’emploi', () => {
      expect(bus).toBeInstanceOf(EventBus);
    });

    it('le singleton fonctionne de bout en bout', () => {
      const handler = vi.fn();
      const off = bus.on('chuck:log', handler);
      bus.emit('chuck:log', { text: 'hi', level: 'info' });
      expect(handler).toHaveBeenCalledWith({ text: 'hi', level: 'info' });
      off();
    });
  });
});