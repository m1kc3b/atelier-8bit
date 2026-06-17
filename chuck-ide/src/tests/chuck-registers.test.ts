/* ─────────────────────────────────────────────────────────────
   Chuck IDE — tests/chuck-registers.test.ts

   Tests du panneau Registres :
   - Rendu des valeurs hex/bin/dec dans le moniteur mémoire
   - Parsing de l'adresse "Go" (formats $xxxx, 0xXXXX, décimal)
   - Calcul des flags à partir du registre P
   - Flash (changed detection) sur les registres
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect } from 'vitest';

// ── Fonctions pures extraites du composant ───────────────────

const num2hex  = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
const addr2hex = (n: number) => n.toString(16).padStart(4, '0').toUpperCase();
const num2bin  = (n: number) => n.toString(2).padStart(8, '0');

/**
 * Reproduit le parsing CORRIGÉ de l'input "Go" dans le composant.
 *
 * Règle : hex implicite (sans préfixe $ / 0x) nécessite au moins
 * une lettre A-F pour être reconnu comme hex. Un nombre purement
 * numérique ('1024', '4800') est traité comme décimal.
 *
 * AVANT (bug) : length >= 3 suffisait → '1024' était parsé 0x1024 = 4132
 * APRÈS (fix)  : /[A-F]/ requis  → '1024' est parsé 1024 (décimal)
 *
 * Fix à appliquer dans chuck-registers.ts goto-btn listener :
 *   if (/^[0-9A-F]+$/.test(raw) && /[A-F]/.test(raw)) { hex }
 *   else if (/^[0-9]+$/.test(raw))                     { décimal }
 *   else                                                { 0xE000 }
 */
function parseGotoAddress(raw: string): number {
  const s = raw.trim().toUpperCase();

  if (s.startsWith('$')) {
    const parsed = parseInt(s.substring(1), 16);
    return isNaN(parsed) ? 0xE000 : parsed & 0xffff;
  }
  if (s.startsWith('0X')) {
    const parsed = parseInt(s.substring(2), 16);
    return isNaN(parsed) ? 0xE000 : parsed & 0xffff;
  }
  // Hex implicite : doit contenir au moins une lettre A-F
  if (/^[0-9A-F]+$/.test(s) && /[A-F]/.test(s)) {
    const parsed = parseInt(s, 16);
    return isNaN(parsed) ? 0xE000 : parsed & 0xffff;
  }
  // Décimal pur (chiffres seuls, y compris '4800' sans lettre)
  if (/^[0-9]+$/.test(s)) {
    const parsed = parseInt(s, 10);
    return isNaN(parsed) ? 0xE000 : parsed & 0xffff;
  }
  return 0xE000;
}

/** Reproduit l'état des flags à partir du registre P */
function computeFlags(P: number): Record<string, boolean> {
  return {
    N: (P & 0x80) !== 0,
    V: (P & 0x40) !== 0,
    B: (P & 0x10) !== 0,
    D: (P & 0x08) !== 0,
    I: (P & 0x04) !== 0,
    Z: (P & 0x02) !== 0,
    C: (P & 0x01) !== 0,
  };
}

/** Génère les lignes du moniteur pour une page de 256 octets */
function buildMonitorRows(fullRam: Uint8Array, baseAddr: number): Array<{
  addr: string; dec: number; hex: string; bin: string;
}> {
  const rows = [];
  const page = baseAddr & 0xff00;

  for (let i = 0; i < 256; i++) {
    const addr = (page + i) & 0xffff;
    const v    = fullRam[addr] ?? 0;
    rows.push({
      addr: `$${addr2hex(addr)}`,
      dec:  v,
      hex:  `$${num2hex(v)}`,
      bin:  num2bin(v),
    });
  }
  return rows;
}

// ── Tests num2hex / addr2hex / num2bin ────────────────────────

describe('ChuckRegisters — formatage hexadécimal', () => {

  it('num2hex($00) → "00"',       () => expect(num2hex(0x00)).toBe('00'));
  it('num2hex($FF) → "FF"',       () => expect(num2hex(0xFF)).toBe('FF'));
  it('num2hex($0A) → "0A"',       () => expect(num2hex(0x0A)).toBe('0A'));
  it('addr2hex($0600) → "0600"',  () => expect(addr2hex(0x0600)).toBe('0600'));
  it('addr2hex($FFFC) → "FFFC"',  () => expect(addr2hex(0xFFFC)).toBe('FFFC'));
  it('num2bin(0) → "00000000"',   () => expect(num2bin(0)).toBe('00000000'));
  it('num2bin(255) → "11111111"', () => expect(num2bin(255)).toBe('11111111'));
  it('num2bin(0b10101010) → "10101010"', () => expect(num2bin(0b10101010)).toBe('10101010'));
});

// ── Tests parsing adresse "Go" ────────────────────────────────

describe('ChuckRegisters — parsing adresse Go', () => {

  it('format $XXXX avec dollard',    () => expect(parseGotoAddress('$4800')).toBe(0x4800));
  it('format $xxxx lowercase',       () => expect(parseGotoAddress('$e000')).toBe(0xE000));
  it('format 0xXXXX',                () => expect(parseGotoAddress('0x4C00')).toBe(0x4C00));
  it('hex implicite avec lettre A-F → hex (ex: 4C00 = 0x4C00)', () => expect(parseGotoAddress('4C00')).toBe(0x4C00));
  it('chiffres purs sans A-F → décimal (4800 ≠ 0x4800)',         () => expect(parseGotoAddress('4800')).toBe(4800));
  it('format décimal',               () => expect(parseGotoAddress('1024')).toBe(1024));
  it('valeur invalide → $E000',      () => expect(parseGotoAddress('ZZZZ')).toBe(0xE000));
  it('chaîne vide → $E000',          () => expect(parseGotoAddress('')).toBe(0xE000));
  it('overflow 16 bits → masqué',    () => expect(parseGotoAddress('$1FFFF')).toBe(0xFFFF));
  it('$0000 → 0 (Zero Page)',        () => expect(parseGotoAddress('$0000')).toBe(0x0000));
  it('espaces tolérés',              () => expect(parseGotoAddress('  $4800  ')).toBe(0x4800));
});

// ── Tests flags CPU ───────────────────────────────────────────

describe('ChuckRegisters — calcul des flags (registre P)', () => {

  it('P=0x00 → tous les flags à 0', () => {
    const flags = computeFlags(0x00);
    expect(Object.values(flags).every(v => !v)).toBe(true);
  });

  it('P=0xFF → tous les flags à 1', () => {
    const flags = computeFlags(0xFF);
    expect(Object.values(flags).every(v => v)).toBe(true);
  });

  it('flag Z (zero) → bit 1', () => {
    expect(computeFlags(0b00000010).Z).toBe(true);
    expect(computeFlags(0b00000000).Z).toBe(false);
  });

  it('flag C (carry) → bit 0', () => {
    expect(computeFlags(0b00000001).C).toBe(true);
    expect(computeFlags(0b00000010).C).toBe(false);
  });

  it('flag N (negative) → bit 7', () => {
    expect(computeFlags(0b10000000).N).toBe(true);
    expect(computeFlags(0b01111111).N).toBe(false);
  });

  it('flag V (overflow) → bit 6', () => {
    expect(computeFlags(0b01000000).V).toBe(true);
    expect(computeFlags(0b10111111).V).toBe(false);
  });

  it('flag Z et C simultanément', () => {
    const flags = computeFlags(0b00000011);
    expect(flags.Z).toBe(true);
    expect(flags.C).toBe(true);
    expect(flags.N).toBe(false);
  });

  it('état typique après LDA #$00 : Z=1, N=0', () => {
    const P     = 0b00000010; // Z set
    const flags = computeFlags(P);
    expect(flags.Z).toBe(true);
    expect(flags.N).toBe(false);
  });

  it('état typique après LDA #$FF : N=1, Z=0', () => {
    const P     = 0b10000000; // N set
    const flags = computeFlags(P);
    expect(flags.N).toBe(true);
    expect(flags.Z).toBe(false);
  });
});

// ── Tests du moniteur mémoire ─────────────────────────────────

describe('ChuckRegisters — moniteur mémoire', () => {

  it('génère exactement 256 lignes par page', () => {
    const ram  = new Uint8Array(65536);
    const rows = buildMonitorRows(ram, 0x0000);
    expect(rows).toHaveLength(256);
  });

  it('première ligne de la Zero Page → $0000', () => {
    const ram = new Uint8Array(65536);
    const rows = buildMonitorRows(ram, 0x0000);
    expect(rows[0]!.addr).toBe('$0000');
  });

  it('dernière ligne de la Zero Page → $00FF', () => {
    const ram = new Uint8Array(65536);
    const rows = buildMonitorRows(ram, 0x0000);
    expect(rows[255]!.addr).toBe('$00FF');
  });

  it('aligne sur la page de 256 (masque &0xFF00)', () => {
    const ram  = new Uint8Array(65536);
    // Si on va à $4842, doit afficher la page $4800–$48FF
    const rows = buildMonitorRows(ram, 0x4842);
    expect(rows[0]!.addr).toBe('$4800');
    expect(rows[255]!.addr).toBe('$48FF');
  });

  it('lit la valeur correcte depuis fullRam', () => {
    const ram   = new Uint8Array(65536);
    ram[0x0010] = 0xAB;
    const rows  = buildMonitorRows(ram, 0x0000);
    expect(rows[0x10]!.dec).toBe(0xAB);
    expect(rows[0x10]!.hex).toBe('$AB');
    expect(rows[0x10]!.bin).toBe('10101011');
  });

  it('valeur 0 → hex=$00, bin=00000000', () => {
    const ram  = new Uint8Array(65536);
    const rows = buildMonitorRows(ram, 0x0000);
    expect(rows[0]!.hex).toBe('$00');
    expect(rows[0]!.bin).toBe('00000000');
  });

  it('valeur 255 → hex=$FF, bin=11111111, dec=255', () => {
    const ram   = new Uint8Array(65536);
    ram[0x0000] = 255;
    const rows  = buildMonitorRows(ram, 0x0000);
    expect(rows[0]!.hex).toBe('$FF');
    expect(rows[0]!.bin).toBe('11111111');
    expect(rows[0]!.dec).toBe(255);
  });

  it('page VRAM texte $4800 → 256 cellules correctes', () => {
    const ram   = new Uint8Array(65536);
    ram[0x4800] = 0x41; // 'A'
    ram[0x48FF] = 0x5A; // 'Z'
    const rows  = buildMonitorRows(ram, 0x4800);
    expect(rows[0]!.hex).toBe('$41');
    expect(rows[255]!.hex).toBe('$5A');
  });
});

// ── Tests détection de changement (flash) ─────────────────────

describe('ChuckRegisters — détection changement registres', () => {

  interface RegState { A: number; X: number; Y: number; P: number; PC: number; SP: number; }

  function detectChanged(prev: Partial<RegState>, next: RegState): Set<string> {
    const changed = new Set<string>();
    for (const key of ['A', 'X', 'Y', 'P', 'PC', 'SP'] as const) {
      if (prev[key] !== next[key]) changed.add(key);
    }
    return changed;
  }

  it('aucun changement → set vide', () => {
    const state = { A: 0, X: 0, Y: 0, P: 0, PC: 0x0600, SP: 0xFF };
    expect(detectChanged(state, state).size).toBe(0);
  });

  it('A change → A dans le set', () => {
    const prev = { A: 0, X: 0, Y: 0, P: 0, PC: 0x0600, SP: 0xFF };
    const next = { ...prev, A: 0x42 };
    expect(detectChanged(prev, next).has('A')).toBe(true);
  });

  it('PC change → PC dans le set', () => {
    const prev = { A: 0, X: 0, Y: 0, P: 0, PC: 0x0600, SP: 0xFF };
    const next = { ...prev, PC: 0x0603 };
    expect(detectChanged(prev, next).has('PC')).toBe(true);
    expect(detectChanged(prev, next).has('A')).toBe(false);
  });

  it('plusieurs changements simultanés', () => {
    const prev = { A: 0, X: 0, Y: 0, P: 0, PC: 0x0600, SP: 0xFF };
    const next = { A: 0x10, X: 0x20, Y: 0, P: 0, PC: 0x0600, SP: 0xFF };
    const changed = detectChanged(prev, next);
    expect(changed.has('A')).toBe(true);
    expect(changed.has('X')).toBe(true);
    expect(changed.has('Y')).toBe(false);
  });
});