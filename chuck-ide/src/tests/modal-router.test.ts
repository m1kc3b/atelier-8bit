/* ─────────────────────────────────────────────────────────────
   Tests — core/modal-router.ts
   Couvre : show (rendu + open), gate auth (redirige vers require-auth
   si non connecté), pile de navigation (push/back/root reset), réactions
   au bus (modal-show, modal-close, modal-back, goto-challenge, open-welcome),
   options de coquille (titre, bouton retour, dismissible).
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const authState = { authed: false };
vi.mock('../features/auth/auth-service.js', () => ({
  supabase: {},
  authService: { isAuthenticated: () => authState.authed },
}));

import { bus } from '../core/bus.js';
import { ModalRouter } from '../core/modal-router.js';

/** Élément modale factice instrumenté. */
function makeModal() {
  return {
    setContent: vi.fn(),
    setBottombar: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
  };
}

describe('ModalRouter', () => {
  let modal: ReturnType<typeof makeModal>;
  let router: ModalRouter;

  beforeEach(() => {
    authState.authed = false;
    modal = makeModal();
    // jsdom : éviter que customElements inconnus posent souci — createElement suffit.
    router = new ModalRouter(modal as any);
  });

  describe('show', () => {
    it('rend la vue welcome et ouvre la modale', async () => {
      await router.show('welcome');
      expect(modal.setContent).toHaveBeenCalledTimes(1);
      expect(modal.open).toHaveBeenCalledTimes(1);
      const [, opts] = modal.setContent.mock.calls[0];
      expect(opts.title).toBe("L'Atelier 8-bit");
      expect(opts.showBackBtn).toBe(false); // racine
    });

    it('affiche le titre propre à chaque vue', async () => {
      await router.show('challenges');
      const [, opts] = modal.setContent.mock.calls.at(-1)!;
      expect(opts.title).toContain('Challenges');
    });
  });

  describe('gate auth', () => {
    it('redirige vers require-auth si gate et non connecté (pas de rendu)', async () => {
      const requireAuth = vi.fn();
      bus.on('chuck:require-auth', requireAuth);
      await router.show('challenges', { gate: true });
      expect(requireAuth).toHaveBeenCalledWith({ reason: 'challenge' });
      expect(modal.open).not.toHaveBeenCalled();
    });

    it('affiche la vue si gate mais utilisateur connecté', async () => {
      authState.authed = true;
      await router.show('challenges', { gate: true });
      expect(modal.open).toHaveBeenCalledTimes(1);
    });
  });

  describe('pile de navigation', () => {
    it('empile une vue enfant et affiche le bouton retour', async () => {
      await router.show('welcome');     // racine
      await router.show('help');        // enfant
      const [, opts] = modal.setContent.mock.calls.at(-1)!;
      expect(opts.showBackBtn).toBe(true);
    });

    it('back() dépile vers la vue précédente', async () => {
      await router.show('welcome');
      await router.show('help');
      modal.setContent.mockClear();
      router.back();
      const [, opts] = modal.setContent.mock.calls.at(-1)!;
      expect(opts.title).toBe("L'Atelier 8-bit"); // retour à welcome
      expect(opts.showBackBtn).toBe(false);
    });

    it('back() sur la racine seule ne plante pas et reste sur welcome', async () => {
      await router.show('welcome');
      modal.setContent.mockClear();
      router.back();
      expect(modal.setContent).toHaveBeenCalledTimes(1);
    });

    it('réafficher la racine welcome réinitialise la pile', async () => {
      await router.show('welcome');
      await router.show('help');
      await router.show('welcome'); // root → reset
      modal.setContent.mockClear();
      router.back(); // pile = [welcome] seul
      const [, opts] = modal.setContent.mock.calls.at(-1)!;
      expect(opts.showBackBtn).toBe(false);
    });
  });

  describe('réactions au bus', () => {
    it('chuck:modal-show affiche la vue demandée', async () => {
      bus.emit('chuck:modal-show', { view: 'help' });
      await Promise.resolve();
      expect(modal.open).toHaveBeenCalled();
    });

    it('chuck:modal-close ferme la modale', () => {
      bus.emit('chuck:modal-close', undefined);
      expect(modal.close).toHaveBeenCalledTimes(1);
    });

    it('chuck:goto-challenge ferme la modale (l’IDE prend le relais)', () => {
      bus.emit('chuck:goto-challenge', { id: 3 });
      expect(modal.close).toHaveBeenCalledTimes(1);
    });

    it('chuck:open-welcome rouvre l’accueil', async () => {
      bus.emit('chuck:open-welcome', undefined);
      await Promise.resolve();
      const [, opts] = modal.setContent.mock.calls.at(-1)!;
      expect(opts.title).toBe("L'Atelier 8-bit");
    });
  });
});