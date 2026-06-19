/* ─────────────────────────────────────────────────────────────
   Chuck IDE — tests/chuck-memory-dump.test.ts

   Tests du composant Memory Dump (grille Zero Page $0000–$00FF) :
   - Formatage hex des cellules
   - Détection des cellules non-zéro
   - Détection des cellules changées entre deux états
   - Structure de la grille 16×16
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect } from 'vitest';

// ── Logique pure extraite du composant ───────────────────────

function num2hex(num: number | undefined): string {
  if (num === undefined) return '00';
  return num.toString(16).padStart(2, '0');
}

/** État d'une cellule après diffing */
interface CellState {
  value:    number;
  hex:      string;
  isNonzero: boolean;
  isChanged: boolean;
}

/**
 * Calcule l'état de toutes les cellules en comparant prev et next.
 * Reproduit la logique de _render() dans ChuckMemoryDump.
 */
function diffBytes(prev: Uint8Array, next: Uint8Array): CellState[] {
  return Array.from({ length: 256 }, (_, i) => {
    const v       = next[i] ?? 0;
    const changed = v !== (prev[i] ?? 0);
    return {
      value:     v,
      hex:       num2hex(v),
      isNonzero: v !== 0,
      isChanged: changed && v !== 0, // changed uniquement si nouveau ≠ 0
    };
  });
}

/** Calcule les adresses de la grille 16×16 */
function gridAddresses(): Array<{ row: number; col: number; addr: number; label: string }> {
  return Array.from({ length: 256 }, (_, i) => ({
    row:   Math.floor(i / 16),
    col:   i % 16,
    addr:  i,
    label: `$${num2hex(i)}`,
  }));
}

// ── Tests num2hex ─────────────────────────────────────────────

describe('ChuckMemoryDump — num2hex', () => {

  it('undefined → "00"',          () => expect(num2hex(undefined)).toBe('00'));
  it('0 → "00"',                   () => expect(num2hex(0)).toBe('00'));
  it('255 → "ff"',                 () => expect(num2hex(255)).toBe('ff'));
  it('16 → "10"',                  () => expect(num2hex(16)).toBe('10'));
  it('0xAB → "ab"',                () => expect(num2hex(0xAB)).toBe('ab'));
  it('valeur inférieure à 16 paddée', () => expect(num2hex(5)).toBe('05'));
});

// ── Tests structure de grille ─────────────────────────────────

describe('ChuckMemoryDump — structure grille 16×16', () => {

  const grid = gridAddresses();

  it('génère exactement 256 cellules', () => {
    expect(grid).toHaveLength(256);
  });

  it('cellule 0 → row=0, col=0, addr=$00', () => {
    expect(grid[0]).toMatchObject({ row: 0, col: 0, addr: 0, label: '$00' });
  });

  it('cellule 15 → row=0, col=15 (fin de ligne 0)', () => {
    expect(grid[15]).toMatchObject({ row: 0, col: 15, addr: 15 });
  });

  it('cellule 16 → row=1, col=0 (début ligne 1)', () => {
    expect(grid[16]).toMatchObject({ row: 1, col: 0, addr: 16 });
  });

  it('cellule 255 → row=15, col=15 ($FF)', () => {
    expect(grid[255]).toMatchObject({ row: 15, col: 15, addr: 255, label: '$ff' });
  });

  it('16 lignes uniques', () => {
    const rows = new Set(grid.map(c => c.row));
    expect(rows.size).toBe(16);
  });

  it('16 colonnes par ligne', () => {
    const row0 = grid.filter(c => c.row === 0);
    expect(row0).toHaveLength(16);
  });

  it('adresses consécutives et uniques', () => {
    const addrs = grid.map(c => c.addr);
    const unique = new Set(addrs);
    expect(unique.size).toBe(256);
    expect(Math.max(...addrs)).toBe(255);
    expect(Math.min(...addrs)).toBe(0);
  });
});

// ── Tests diffing des octets ──────────────────────────────────

describe('ChuckMemoryDump — détection cellules non-zéro', () => {

  it('tout à zéro → aucune cellule nonzero', () => {
    const bytes = new Uint8Array(256);
    const cells = diffBytes(bytes, bytes);
    expect(cells.every(c => !c.isNonzero)).toBe(true);
  });

  it('byte[5]=0x42 → cellule 5 est nonzero', () => {
    const prev = new Uint8Array(256);
    const next = new Uint8Array(256);
    next[5] = 0x42;
    const cells = diffBytes(prev, next);
    expect(cells[5]!.isNonzero).toBe(true);
    expect(cells[5]!.hex).toBe('42');
  });

  it('byte[0]=0x00 → cellule 0 pas nonzero', () => {
    const bytes = new Uint8Array(256);
    const cells = diffBytes(bytes, bytes);
    expect(cells[0]!.isNonzero).toBe(false);
  });

  it('byte[255]=0xFF → dernière cellule nonzero', () => {
    const prev  = new Uint8Array(256);
    const next  = new Uint8Array(256);
    next[255]   = 0xFF;
    const cells = diffBytes(prev, next);
    expect(cells[255]!.isNonzero).toBe(true);
    expect(cells[255]!.hex).toBe('ff');
  });
});

describe('ChuckMemoryDump — détection cellules changées', () => {

  it('aucun changement → aucune cellule changed', () => {
    const bytes = new Uint8Array(256).fill(0);
    const cells = diffBytes(bytes, bytes);
    expect(cells.every(c => !c.isChanged)).toBe(true);
  });

  it('octet passe de 0 à 0x42 → changed=true', () => {
    const prev  = new Uint8Array(256);
    const next  = new Uint8Array(256);
    next[10]    = 0x42;
    const cells = diffBytes(prev, next);
    expect(cells[10]!.isChanged).toBe(true);
  });

  it('octet passe de 0x42 à 0 → changed=false (retour à zéro non signalé)', () => {
    // Règle du composant : changed = true seulement si NEW !== 0
    const prev = new Uint8Array(256);
    const next = new Uint8Array(256);
    prev[10]   = 0x42;
    next[10]   = 0x00; // retour à zéro
    const cells = diffBytes(prev, next);
    expect(cells[10]!.isChanged).toBe(false); // pas de flash sur retour à 0
  });

  it('octet change de 0x01 à 0x02 → changed=true', () => {
    const prev = new Uint8Array(256).fill(1);
    const next = new Uint8Array(256).fill(1);
    next[20]   = 0x02;
    const cells = diffBytes(prev, next);
    expect(cells[20]!.isChanged).toBe(true);
    expect(cells[0]!.isChanged).toBe(false); // les autres inchangés
  });

  it('plusieurs cellules changent simultanément', () => {
    const prev = new Uint8Array(256);
    const next = new Uint8Array(256);
    next[0]    = 0x01;
    next[128]  = 0xFF;
    next[255]  = 0xAB;
    const cells = diffBytes(prev, next);

    expect(cells[0]!.isChanged).toBe(true);
    expect(cells[128]!.isChanged).toBe(true);
    expect(cells[255]!.isChanged).toBe(true);

    // Les non-modifiées restent stables
    expect(cells[1]!.isChanged).toBe(false);
    expect(cells[127]!.isChanged).toBe(false);
  });

  it('reset (tout à 0) → prev reset, aucune cellule changed', () => {
    const prev = new Uint8Array(256).fill(0xFF);
    const next = new Uint8Array(256); // tout à 0
    const cells = diffBytes(prev, next);
    // changed = false car new === 0
    expect(cells.every(c => !c.isChanged)).toBe(true);
  });
});

// ── Tests adresses de ligne ───────────────────────────────────

describe("ChuckMemoryDump — libellés d'adresse de ligne", () => {

  it('ligne 0 → $00', () => expect(num2hex(0 * 16)).toBe('00'));
  it('ligne 1 → $10', () => expect(num2hex(1 * 16)).toBe('10'));
  it('ligne 8 → $80', () => expect(num2hex(8 * 16)).toBe('80'));
  it('ligne 15 → $f0', () => expect(num2hex(15 * 16)).toBe('f0'));
});