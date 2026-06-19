/* ═══════════════════════════════════════════════════════════════
   Chuck IDE — tests/memory.test.ts
   Tests unitaires : Ram64K
   ═══════════════════════════════════════════════════════════════ */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Ram64K } from '../core/memory.js';

// ── Suite ────────────────────────────────────────────────────────

describe('Ram64K', () => {
  let ram: Ram64K;

  beforeEach(() => {
    ram = new Ram64K();
  });

  // ── Initialisation ────────────────────────────────────────────

  describe('initialisation', () => {
    it('buffer de 65536 octets initialisé à zéro', () => {
      expect(ram.buffer.length).toBe(0x10000);
      expect(ram.buffer.every(b => b === 0)).toBe(true);
    });
  });

  // ── read / write ──────────────────────────────────────────────

  describe('read / write', () => {
    it('write puis read retourne la même valeur', () => {
      ram.write(0x0010, 0xAB);
      expect(ram.read(0x0010)).toBe(0xAB);
    });

    it('masque les adresses sur 16 bits (wrap-around)', () => {
      ram.write(0x10001, 0xFF); // overflow → 0x0001
      expect(ram.read(0x0001)).toBe(0xFF);
    });

    it('masque les valeurs sur 8 bits', () => {
      ram.write(0x0020, 0x1FF); // overflow → 0xFF
      expect(ram.read(0x0020)).toBe(0xFF);
    });

    it('$FE retourne une valeur aléatoire (pseudo-random)', () => {
      // On lit plusieurs fois : les valeurs doivent être dans [0, 255]
      for (let i = 0; i < 10; i++) {
        const v = ram.read(0xFE);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
        expect(Number.isInteger(v)).toBe(true);
      }
    });

    it('$FE n\'est pas toujours identique (aléatoire)', () => {
      // Sur 50 lectures, au moins 2 valeurs différentes (probabilité quasi-certaine)
      const values = new Set(Array.from({ length: 50 }, () => ram.read(0xFE)));
      expect(values.size).toBeGreaterThan(1);
    });

    it('$FE - write n\'affecte pas la lecture (toujours aléatoire)', () => {
      ram.write(0xFE, 0x42);
      const v = ram.read(0xFE);
      // On ne peut pas tester une valeur exacte, mais on vérifie que c'est valide
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    });
  });

  // ── store (avec hook display) ─────────────────────────────────

  describe('store + pixelHook', () => {
    it('store écrit la valeur dans le buffer', () => {
      ram.store(0x0300, 0x05);
      expect(ram.buffer[0x0300]).toBe(0x05);
    });

    it('hook appelé pour une adresse dans la zone display ($0200–$05FF)', () => {
      const hook = vi.fn();
      ram.setPixelHook(hook);
      ram.store(0x0200, 0x03);
      expect(hook).toHaveBeenCalledOnce();
      expect(hook).toHaveBeenCalledWith(0x0200, 0x03);
    });

    it('hook appelé à la limite haute $05FF', () => {
      const hook = vi.fn();
      ram.setPixelHook(hook);
      ram.store(0x05FF, 0x0F);
      expect(hook).toHaveBeenCalledWith(0x05FF, 0x0F);
    });

    it('hook NON appelé hors de la zone display ($01FF)', () => {
      const hook = vi.fn();
      ram.setPixelHook(hook);
      ram.store(0x01FF, 0x01);
      expect(hook).not.toHaveBeenCalled();
    });

    it('hook NON appelé à $0600 (juste après la zone display)', () => {
      const hook = vi.fn();
      ram.setPixelHook(hook);
      ram.store(0x0600, 0xA9);
      expect(hook).not.toHaveBeenCalled();
    });

    it('write (stack) ne déclenche PAS le hook', () => {
      const hook = vi.fn();
      ram.setPixelHook(hook);
      ram.write(0x0200, 0x05); // write brut, pas store
      expect(hook).not.toHaveBeenCalled();
    });

    it('pas de hook enregistré → store ne lève pas d\'erreur', () => {
      expect(() => ram.store(0x0200, 0x01)).not.toThrow();
    });
  });

  // ── readWord ──────────────────────────────────────────────────

  describe('readWord', () => {
    it('lit un mot 16-bit little-endian', () => {
      ram.write(0x0010, 0x34); // octet bas
      ram.write(0x0011, 0x12); // octet haut
      expect(ram.readWord(0x0010)).toBe(0x1234);
    });

    it('wrap-around sur la frontière $FFFF / $0000', () => {
      ram.write(0xFFFF, 0xAB);
      ram.write(0x0000, 0xCD);
      expect(ram.readWord(0xFFFF)).toBe(0xCDAB);
    });
  });

  // ── storeKeypress ─────────────────────────────────────────────

  describe('storeKeypress', () => {
    it('écrit le code ASCII en $FF', () => {
      ram.storeKeypress(0x41); // 'A'
      expect(ram.read(0xFF)).toBe(0x41);
    });

    it('masque sur 8 bits', () => {
      ram.storeKeypress(0x141); // → 0x41
      expect(ram.read(0xFF)).toBe(0x41);
    });
  });

  // ── loadBytes ─────────────────────────────────────────────────

  describe('loadBytes', () => {
    it('charge un programme à partir d\'une adresse de base', () => {
      const prog = [0xA9, 0x42, 0x8D, 0x00, 0x02, 0x00];
      ram.loadBytes(0x0600, prog);
      for (let i = 0; i < prog.length; i++) {
        expect(ram.buffer[0x0600 + i]).toBe(prog[i]);
      }
    });

    it('ne déclenche pas le hook display pendant le chargement', () => {
      const hook = vi.fn();
      ram.setPixelHook(hook);
      // Charge dans la zone display
      ram.loadBytes(0x0200, [0x01, 0x02, 0x03]);
      expect(hook).not.toHaveBeenCalled();
    });

    it('wrap-around à $FFFF', () => {
      ram.loadBytes(0xFFFE, [0xAA, 0xBB, 0xCC]);
      expect(ram.buffer[0xFFFE]).toBe(0xAA);
      expect(ram.buffer[0xFFFF]).toBe(0xBB);
      expect(ram.buffer[0x0000]).toBe(0xCC); // wrap
    });
  });

  // ── reset ─────────────────────────────────────────────────────

  describe('reset', () => {
    it('efface tout le buffer', () => {
      ram.write(0x0010, 0xFF);
      ram.write(0x0600, 0xA9);
      ram.reset();
      expect(ram.buffer.every(b => b === 0)).toBe(true);
    });
  });

  // ── hexDump ───────────────────────────────────────────────────

  describe('hexDump', () => {
    it('produit un hexdump lisible', () => {
      ram.write(0x0600, 0xA9);
      ram.write(0x0601, 0x42);
      const dump = ram.hexDump(0x0600, 2);
      expect(dump).toContain('0600');
      expect(dump).toContain('A9');
      expect(dump).toContain('42');
    });

    it('format : une ligne de 16 octets max', () => {
      ram.loadBytes(0x0600, Array.from({ length: 16 }, (_, i) => i));
      const dump = ram.hexDump(0x0600, 16);
      const lines = dump.split('\n').filter(l => l.trim());
      expect(lines.length).toBe(1);
    });

    it('deux lignes pour 17 octets', () => {
      ram.loadBytes(0x0600, Array.from({ length: 17 }, () => 0));
      const dump = ram.hexDump(0x0600, 17);
      const lines = dump.split('\n').filter(l => l.trim());
      expect(lines.length).toBe(2);
    });

    it('format de l\'adresse : 4 chiffres hex majuscules', () => {
      const dump = ram.hexDump(0x0600, 1);
      expect(dump).toMatch(/^0600:/);
    });
  });
});