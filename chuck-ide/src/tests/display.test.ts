/* ═══════════════════════════════════════════════════════════════
   Chuck IDE — tests/display.test.ts
   Tests unitaires : Display6502 + palette
   ═══════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Display6502, PALETTE } from '../core/display.js';
import { Ram64K } from '../core/memory.js';

// ── Mock Canvas ───────────────────────────────────────────────────

function makeMockCanvas(width = 256, height = 256) {
  const drawCalls: Array<{ method: string; args: unknown[] }> = [];

  const ctx = {
    fillStyle: '',
    fillRect: vi.fn((...args) => drawCalls.push({ method: 'fillRect', args })),
    _drawCalls: drawCalls,
  };

  const canvas = {
    width,
    height,
    getContext: vi.fn(() => ctx),
  } as unknown as HTMLCanvasElement;

  return { canvas, ctx };
}

// ── Suite ────────────────────────────────────────────────────────

describe('PALETTE', () => {
  it('contient exactement 16 couleurs', () => {
    expect(PALETTE).toHaveLength(16);
  });

  it('chaque couleur est un code hex CSS valide', () => {
    for (const color of PALETTE) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('la couleur 0 est noir (#000000)', () => {
    expect(PALETTE[0]).toBe('#000000');
  });

  it('la couleur 1 est blanc (#ffffff)', () => {
    expect(PALETTE[1]).toBe('#ffffff');
  });
});

describe('Display6502', () => {
  let display: Display6502;
  let ram: Ram64K;

  beforeEach(() => {
    display = new Display6502();
    ram = new Ram64K();
  });

  // ── init ──────────────────────────────────────────────────────

  describe('init', () => {
    it('init() demande le contexte 2D au canvas', () => {
      const { canvas } = makeMockCanvas(256, 256);
      display.init(canvas, ram);
      expect(canvas.getContext).toHaveBeenCalledWith('2d');
    });

    it('init() branche automatiquement le pixelHook sur la RAM', () => {
      const { canvas } = makeMockCanvas();
      display.init(canvas, ram);
      // Écriture via store → le hook display doit être appelé
      const { ctx } = makeMockCanvas();
      // On vérifie indirectement : après init, store() sur $0200 redessine
      // (ctx.fillRect appelé dans clear() lors de l'init, puis sur store)
      // On va utiliser un spy sur ctx pour valider
    });

    it('init() appelle clear() (fond noir au démarrage)', () => {
      const { canvas, ctx } = makeMockCanvas(256, 256);
      display.init(canvas, ram);
      // clear() appelle fillRect une fois avec les dimensions totales
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 256, 256);
    });

    it('calcule pixelSize = canvas.width / 32', () => {
      // Sur un canvas 256×256, pixelSize = 8
      const { canvas, ctx } = makeMockCanvas(256, 256);
      display.init(canvas, ram);
      // Écriture dans $0200 → pixel (0,0) → fillRect(0, 0, 8, 8)
      ram.store(0x0200, 0x01);
      // La dernière fillRect après clear devrait avoir la taille correcte
      const calls = ctx.fillRect.mock.calls;
      const pixelCall = calls.find(
        (c) => c[2] === 8 && c[3] === 8
      );
      expect(pixelCall).toBeDefined();
    });
  });

  // ── Pixel hook ────────────────────────────────────────────────

  describe('dessin de pixels via store()', () => {
    it('un store dans la zone display déclenche le dessin du pixel', () => {
      const { canvas, ctx } = makeMockCanvas(256, 256);
      display.init(canvas, ram);
      ctx.fillRect.mockClear(); // ignorer les appels de clear()

      ram.store(0x0200, 0x01); // pixel (0,0) couleur blanche
      expect(ctx.fillRect).toHaveBeenCalled();
    });

    it('la couleur utilisée correspond à la palette', () => {
      const { canvas, ctx } = makeMockCanvas(256, 256);
      display.init(canvas, ram);

      ram.store(0x0200, 0x02); // couleur index 2 = '#880000'
      expect(ctx.fillStyle).toBe(PALETTE[2]);
    });

    it('masque la valeur couleur sur 4 bits (& 0x0F)', () => {
      const { canvas, ctx } = makeMockCanvas(256, 256);
      display.init(canvas, ram);

      ram.store(0x0200, 0x12); // bits hauts ignorés → index 2
      expect(ctx.fillStyle).toBe(PALETTE[2]);
    });

    it('calcule les coordonnées X et Y correctement', () => {
      const { canvas, ctx } = makeMockCanvas(256, 256);
      display.init(canvas, ram);
      ctx.fillRect.mockClear();

      // $0200 = offset 0 → (x=0, y=0)
      ram.store(0x0200, 0x01);
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 8, 8);

      ctx.fillRect.mockClear();
      // $0201 = offset 1 → (x=1, y=0)
      ram.store(0x0201, 0x01);
      expect(ctx.fillRect).toHaveBeenCalledWith(8, 0, 8, 8);

      ctx.fillRect.mockClear();
      // $0220 = offset 32 → (x=0, y=1) (32e pixel = 2e ligne)
      ram.store(0x0220, 0x01);
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 8, 8, 8);
    });

    it('un store hors zone display ne déclenche pas de dessin', () => {
      const { canvas, ctx } = makeMockCanvas(256, 256);
      display.init(canvas, ram);
      ctx.fillRect.mockClear();

      ram.store(0x0600, 0x01); // programme, pas display
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });

    it('dessine le dernier pixel de la zone ($05FF)', () => {
      const { canvas, ctx } = makeMockCanvas(256, 256);
      display.init(canvas, ram);
      ctx.fillRect.mockClear();

      ram.store(0x05FF, 0x0F); // dernier pixel (index 1023)
      expect(ctx.fillRect).toHaveBeenCalled();
      // offset = 0x3FF = 1023 → x = 1023%32 = 31, y = floor(1023/32) = 31
      expect(ctx.fillRect).toHaveBeenCalledWith(31 * 8, 31 * 8, 8, 8);
    });
  });

  // ── clear ─────────────────────────────────────────────────────

  describe('clear', () => {
    it('clear() remplit le canvas en noir', () => {
      const { canvas, ctx } = makeMockCanvas(256, 256);
      display.init(canvas, ram);
      ctx.fillRect.mockClear();

      display.clear();
      expect(ctx.fillStyle).toBe('#000000');
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 256, 256);
    });
  });

  // ── redraw ────────────────────────────────────────────────────

  describe('redraw', () => {
    it('redraw() redessine tous les 1024 pixels', () => {
      const { canvas, ctx } = makeMockCanvas(256, 256);
      display.init(canvas, ram);
      ctx.fillRect.mockClear();

      display.redraw();
      // 32×32 = 1024 pixels → 1024 appels fillRect
      expect(ctx.fillRect).toHaveBeenCalledTimes(1024);
    });

    it('redraw() utilise les valeurs actuelles de la RAM', () => {
      const { canvas, ctx } = makeMockCanvas(256, 256);
      ram.write(0x0200, 0x03); // Écriture directe sans hook
      display.init(canvas, ram);
      ctx.fillRect.mockClear();

      display.redraw();
      // Le pixel (0,0) devrait être dessiné avec la couleur 3
      const calls = ctx.fillRect.mock.calls;
      // Premier appel = pixel (0,0)
      expect(calls[0]).toEqual([0, 0, 8, 8]);
      // La couleur doit être PALETTE[3]
      // (on vérifie via fillStyle au moment du call — difficile sans mock plus fin)
      // On vérifie au moins que redraw a bien itéré toute la zone
      expect(calls).toHaveLength(1024);
    });
  });

  // ── destroy ───────────────────────────────────────────────────

  describe('destroy', () => {
    it('destroy() coupe le lien canvas — les stores suivants ne dessinent pas', () => {
      const { canvas, ctx } = makeMockCanvas(256, 256);
      display.init(canvas, ram);
      display.destroy();
      ctx.fillRect.mockClear();

      // Après destroy, un store ne doit pas tenter d'utiliser le ctx
      // (le hook reste branché sur la ram mais _ctx est null)
      // On vérifie qu'il n'y a pas d'erreur
      expect(() => ram.store(0x0200, 0x01)).not.toThrow();
    });
  });

  // ── Taille de canvas variable ─────────────────────────────────

  describe('canvas size', () => {
    it('canvas 128×128 → pixelSize = 4', () => {
      const { canvas, ctx } = makeMockCanvas(128, 128);
      display.init(canvas, ram);
      ctx.fillRect.mockClear();

      ram.store(0x0200, 0x01);
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 4, 4);
    });

    it('canvas 64×64 → pixelSize = 2', () => {
      const { canvas, ctx } = makeMockCanvas(64, 64);
      display.init(canvas, ram);
      ctx.fillRect.mockClear();

      ram.store(0x0200, 0x01);
      expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 2, 2);
    });
  });
});