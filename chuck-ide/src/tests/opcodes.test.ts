/* ─────────────────────────────────────────────────────────────
   Tests — features/asm/opcodes.ts + default-source.ts
   Couvre : intégrité du jeu d’instructions 6502 légal (présence des
   opcodes clés, absence d’illégaux dans le set « légal »), cohérence
   OPCODE_DOCS ↔ OPCODES_6502, structure des complétions et des
   directives, et le source par défaut de l’éditeur.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect } from 'vitest';
import {
  OPCODES_6502,
  OPCODE_DOCS,
  CHUCK8_COMPLETIONS,
  DIRECTIVE_DOCS,
} from '../features/asm/opcodes.js';
import { DEFAULT_SOURCE } from '../features/asm/default-source.js';

describe('OPCODES_6502', () => {
  it('est un Set non vide', () => {
    expect(OPCODES_6502).toBeInstanceOf(Set);
    expect(OPCODES_6502.size).toBeGreaterThan(50);
  });

  it('contient les opcodes fondamentaux', () => {
    for (const op of ['LDA', 'STA', 'JMP', 'JSR', 'RTS', 'CMP', 'BNE', 'BEQ', 'ADC', 'SBC']) {
      expect(OPCODES_6502.has(op)).toBe(true);
    }
  });

  it('ne contient pas les opcodes illégaux NMOS ni les secrets (MUL/MCP)', () => {
    for (const illegal of ['LAX', 'SAX', 'DCP', 'SLO', 'MUL', 'MCP']) {
      expect(OPCODES_6502.has(illegal)).toBe(false);
    }
  });

  it('est exclusivement en MAJUSCULES', () => {
    for (const op of OPCODES_6502) {
      expect(op).toBe(op.toUpperCase());
    }
  });
});

describe('OPCODE_DOCS', () => {
  it('chaque entrée documentée correspond à un opcode légal connu', () => {
    for (const op of Object.keys(OPCODE_DOCS)) {
      expect(OPCODES_6502.has(op)).toBe(true);
    }
  });

  it('chaque doc fournit detail et info non vides', () => {
    for (const [op, doc] of Object.entries(OPCODE_DOCS)) {
      expect(doc.detail, `${op}.detail`).toBeTruthy();
      expect(doc.info, `${op}.info`).toBeTruthy();
    }
  });
});

describe('CHUCK8_COMPLETIONS', () => {
  it('est un tableau non vide', () => {
    expect(Array.isArray(CHUCK8_COMPLETIONS)).toBe(true);
    expect(CHUCK8_COMPLETIONS.length).toBeGreaterThan(0);
  });

  it('chaque complétion porte au moins un champ label', () => {
    for (const c of CHUCK8_COMPLETIONS as Array<Record<string, unknown>>) {
      expect(c).toHaveProperty('label');
      expect(typeof c.label).toBe('string');
    }
  });
});

describe('DIRECTIVE_DOCS', () => {
  it('documente les directives clés (.org)', () => {
    const keys = Object.keys(DIRECTIVE_DOCS).map((k) => k.toLowerCase());
    expect(keys.some((k) => k.includes('org'))).toBe(true);
  });

  it('chaque directive fournit detail et info', () => {
    for (const [d, doc] of Object.entries(DIRECTIVE_DOCS)) {
      expect(doc.detail, `${d}.detail`).toBeTruthy();
      expect(doc.info, `${d}.info`).toBeTruthy();
    }
  });
});

describe('DEFAULT_SOURCE', () => {
  it('est une chaîne non vide', () => {
    expect(typeof DEFAULT_SOURCE).toBe('string');
    expect(DEFAULT_SOURCE.length).toBeGreaterThan(0);
  });

  it('contient une directive .org et une boucle assemblable', () => {
    expect(DEFAULT_SOURCE).toContain('.org');
    expect(DEFAULT_SOURCE).toMatch(/JMP\s+LOOP/);
  });

  it('n’utilise que des opcodes légaux connus', () => {
    // Extrait les mnémoniques candidats (mots de 3 lettres en début de ligne).
    const lines = DEFAULT_SOURCE.split('\n');
    for (const raw of lines) {
      const line = raw.split(';')[0].trim();          // retire les commentaires
      const m = line.match(/^([A-Z]{3})\b/);          // mnémonique en tête
      if (m && !line.includes('=') && !line.includes(':')) {
        expect(OPCODES_6502.has(m[1]), `${m[1]} doit être un opcode légal`).toBe(true);
      }
    }
  });
});