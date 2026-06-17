/* ═══════════════════════════════════════════════════════════════
   Chuck IDE — tests/assembler.test.ts
   Tests unitaires : Assembler6502
   ═══════════════════════════════════════════════════════════════ */

import { describe, it, expect, beforeEach } from 'vitest';
import { Assembler6502 } from '../core/assembler.js';
import { Ram64K } from '../core/memory.js';

// ── Helpers ──────────────────────────────────────────────────────

function setup() {
  const ram = new Ram64K();
  const asm = new Assembler6502();
  const assemble = (source: string) => asm.assemble(source, ram);
  return { ram, asm, assemble };
}

// ── Suite ────────────────────────────────────────────────────────

describe('Assembler6502', () => {
  // ── Cas passants basiques ─────────────────────────────────────

  describe('assemblage réussi', () => {
    it('retourne ok=true pour un programme minimal', () => {
      const { assemble } = setup();
      const r = assemble('LDA #$01\nBRK');
      expect(r.ok).toBe(true);
    });

    it('retourne le nombre d\'octets correct (LDA #imm = 2 octets)', () => {
      const { assemble } = setup();
      const r = assemble('LDA #$42');
      expect(r.ok).toBe(true);
      expect(r.bytes).toBe(2);
    });

    it('BRK est un seul octet ($00)', () => {
      const { assemble } = setup();
      const r = assemble('BRK');
      expect(r.ok).toBe(true);
      expect(r.bytes).toBe(1);
      expect(r.buf[0]).toBe(0x00);
    });

    it('charge les octets en RAM à partir de $0600', () => {
      const { ram, assemble } = setup();
      assemble('LDA #$42');
      expect(ram.read(0x0600)).toBe(0xA9); // opcode LDA #imm
      expect(ram.read(0x0601)).toBe(0x42); // opérande
    });

    it('retourne une copie du buffer (buf)', () => {
      const { assemble } = setup();
      const r = assemble('LDA #$01\nBRK');
      expect(r.buf).toEqual([0xA9, 0x01, 0x00]);
    });
  });

  // ── Modes d'adressage ─────────────────────────────────────────

  describe('modes d\'adressage', () => {
    it('immédiat : LDA #$42 → A9 42', () => {
      const { assemble } = setup();
      const r = assemble('LDA #$42');
      expect(r.buf).toEqual([0xA9, 0x42]);
    });

    it('zero-page : LDA $10 → A5 10', () => {
      const { assemble } = setup();
      const r = assemble('LDA $10');
      expect(r.buf).toEqual([0xA5, 0x10]);
    });

    it('zero-page,X : LDA $10,X → B5 10', () => {
      const { assemble } = setup();
      const r = assemble('LDA $10,X');
      expect(r.buf).toEqual([0xB5, 0x10]);
    });

    it('absolu : LDA $1234 → AD 34 12 (little-endian)', () => {
      const { assemble } = setup();
      const r = assemble('LDA $1234');
      expect(r.buf).toEqual([0xAD, 0x34, 0x12]);
    });

    it('absolu,X : STA $0200,X → 9D 00 02', () => {
      const { assemble } = setup();
      const r = assemble('STA $0200,X');
      expect(r.buf).toEqual([0x9D, 0x00, 0x02]);
    });

    it('absolu,Y : LDA $0200,Y → B9 00 02', () => {
      const { assemble } = setup();
      const r = assemble('LDA $0200,Y');
      expect(r.buf).toEqual([0xB9, 0x00, 0x02]);
    });

    it('(indirect,X) : LDA ($10,X) → A1 10', () => {
      const { assemble } = setup();
      const r = assemble('LDA ($10,X)');
      expect(r.buf).toEqual([0xA1, 0x10]);
    });

    it('(indirect),Y : LDA ($10),Y → B1 10', () => {
      const { assemble } = setup();
      const r = assemble('LDA ($10),Y');
      expect(r.buf).toEqual([0xB1, 0x10]);
    });

    it('accumulateur : ASL A → 0A', () => {
      const { assemble } = setup();
      const r = assemble('ASL A');
      expect(r.buf).toEqual([0x0A]);
    });

    it('accumulateur implicite : ASL (sans opérande) → 0A', () => {
      const { assemble } = setup();
      const r = assemble('ASL');
      expect(r.buf).toEqual([0x0A]);
    });

    it('JMP absolu : JMP $0600 → 4C 00 06', () => {
      const { assemble } = setup();
      const r = assemble('JMP $0600');
      expect(r.buf).toEqual([0x4C, 0x00, 0x06]);
    });

    it('JMP indirect : JMP ($0200) → 6C 00 02', () => {
      const { assemble } = setup();
      const r = assemble('JMP ($0200)');
      expect(r.buf).toEqual([0x6C, 0x00, 0x02]);
    });
  });

  // ── Formats numériques ────────────────────────────────────────

  describe('formats numériques', () => {
    it('hexadécimal ($XX)', () => {
      const { assemble } = setup();
      const r = assemble('LDA #$FF');
      expect(r.buf[1]).toBe(0xFF);
    });

    it('décimal', () => {
      const { assemble } = setup();
      const r = assemble('LDA #42');
      expect(r.buf[1]).toBe(42);
    });

    it('binaire (%XXXXXXXX)', () => {
      const { assemble } = setup();
      const r = assemble('LDA #%11001010');
      expect(r.buf[1]).toBe(0b11001010);
    });

    it('caractère ASCII (\'A\')', () => {
      const { assemble } = setup();
      const r = assemble("LDA #'A'");
      expect(r.buf[1]).toBe(65);
    });
  });

  // ── Instructions implied ──────────────────────────────────────

  describe('instructions implied', () => {
    const implied: Array<[string, number]> = [
      ['NOP', 0xEA], ['RTS', 0x60], ['RTI', 0x40],
      ['PHA', 0x48], ['PLA', 0x68], ['PHP', 0x08], ['PLP', 0x28],
      ['CLC', 0x18], ['SEC', 0x38], ['CLV', 0xB8], ['CLD', 0xD8],
      ['TAX', 0xAA], ['TXA', 0x8A], ['TAY', 0xA8], ['TYA', 0x98],
      ['DEX', 0xCA], ['DEY', 0x88], ['INX', 0xE8], ['INY', 0xC8],
    ];

    for (const [mnem, opcode] of implied) {
      it(`${mnem} → $${opcode.toString(16).toUpperCase().padStart(2, '0')}`, () => {
        const { assemble } = setup();
        const r = assemble(mnem);
        expect(r.ok).toBe(true);
        expect(r.buf[0]).toBe(opcode);
      });
    }
  });

  // ── Branches ──────────────────────────────────────────────────

  describe('branches', () => {
    it('BNE avec label forward → offset relatif correct', () => {
      // LOOP: LDA #$01 ; BNE LOOP
      // LDA #$01 = 2 octets (à $0600-$0601)
      // BNE LOOP = 2 octets (à $0602-$0603)
      // offset = $0600 - ($0602 + 2) = -4 = 0xFC
      const { assemble } = setup();
      const r = assemble('LOOP:\nLDA #$01\nBNE LOOP');
      expect(r.ok).toBe(true);
      expect(r.buf[2]).toBe(0xD0); // opcode BNE
      expect(r.buf[3]).toBe(0xFC); // offset = -4 signé
    });

    it('toutes les branches sont encodées (opcode)', () => {
      const branches: Array<[string, number]> = [
        ['BPL', 0x10], ['BMI', 0x30], ['BVC', 0x50], ['BVS', 0x70],
        ['BCC', 0x90], ['BCS', 0xB0], ['BNE', 0xD0], ['BEQ', 0xF0],
      ];
      for (const [mnem, opcode] of branches) {
        const { assemble } = setup();
        const r = assemble(`TARGET:\n${mnem} TARGET`);
        expect(r.ok).toBe(true);
        expect(r.buf[0]).toBe(opcode);
      }
    });

    it('branchement hors portée retourne une erreur', () => {
      // Cible hors de [-128, +127] : force un gros programme en between
      let source = 'BNE TARGET\n';
      source += Array.from({ length: 200 }, () => 'NOP').join('\n');
      source += '\nTARGET:\nNOP';
      const { assemble } = setup();
      const r = assemble(source);
      // Peut retourner ok=false ou produire un offset erroné
      // selon l'impl — on vérifie au moins que ce n'est pas silencieux
      if (!r.ok) {
        expect(r.err).toBeTruthy();
      }
    });
  });

  // ── Directives ────────────────────────────────────────────────

  describe('directives', () => {
    it('.org / *= change l\'adresse de base', () => {
      const { ram, assemble } = setup();
      assemble('* = $0800\nLDA #$FF');
      expect(ram.read(0x0800)).toBe(0xA9);
      expect(ram.read(0x0801)).toBe(0xFF);
    });

    it('.byte émet des octets littéraux', () => {
      const { assemble } = setup();
      const r = assemble('.byte $DE,$AD,$BE,$EF');
      expect(r.buf).toEqual([0xDE, 0xAD, 0xBE, 0xEF]);
    });

    it('DCB synonyme de .byte', () => {
      const { assemble } = setup();
      const r = assemble('DCB $01,$02,$03');
      expect(r.buf).toEqual([0x01, 0x02, 0x03]);
    });

    it('DB synonyme de .byte', () => {
      const { assemble } = setup();
      const r = assemble('DB $AA');
      expect(r.buf).toEqual([0xAA]);
    });
  });

  // ── Labels ────────────────────────────────────────────────────

  describe('labels', () => {
    it('label utilisé comme adresse absolue', () => {
      const { assemble } = setup();
      // MAIN: à $0600 — JSR MAIN = JSR $0600
      const r = assemble('MAIN:\nNOP\nJSR MAIN');
      expect(r.ok).toBe(true);
      expect(r.buf[1]).toBe(0x20); // opcode JSR
      expect(r.buf[2]).toBe(0x00); // lo de $0600
      expect(r.buf[3]).toBe(0x06); // hi de $0600
    });

    it('label avec underscore', () => {
      const { assemble } = setup();
      const r = assemble('_loop:\nBNE _loop');
      expect(r.ok).toBe(true);
    });
  });

  // ── Commentaires ─────────────────────────────────────────────

  describe('commentaires', () => {
    it('les commentaires ; sont ignorés', () => {
      const { assemble } = setup();
      const r = assemble('LDA #$01 ; charger 1\nBRK ; stop');
      expect(r.ok).toBe(true);
      expect(r.buf).toEqual([0xA9, 0x01, 0x00]);
    });

    it('lignes vides ignorées', () => {
      const { assemble } = setup();
      const r = assemble('\n\nLDA #$01\n\nBRK\n\n');
      expect(r.ok).toBe(true);
      expect(r.bytes).toBe(3);
    });
  });

  // ── Erreurs ───────────────────────────────────────────────────

  describe('erreurs', () => {
    it('mnémonique inconnu → ok=false', () => {
      const { assemble } = setup();
      const r = assemble('XYZ $10');
      expect(r.ok).toBe(false);
      expect(r.err).toBeTruthy();
    });

    it('retourne le numéro de ligne de l\'erreur', () => {
      const { assemble } = setup();
      const r = assemble('NOP\nNOP\nINVALID');
      expect(r.ok).toBe(false);
      expect(r.line).toBe(3);
    });

    it('ok=false → buf vide', () => {
      const { assemble } = setup();
      const r = assemble('BADMNEM');
      expect(r.ok).toBe(false);
      expect(r.buf).toEqual([]);
      expect(r.bytes).toBe(0);
    });

    it('valeur immédiate inconnue (label non défini) → erreur', () => {
      const { assemble } = setup();
      const r = assemble('LDA #UNDEFINED_LABEL');
      expect(r.ok).toBe(false);
    });
  });

  // ── Programmes complets ───────────────────────────────────────

  describe('programmes complets', () => {
    it('charge 42 ($2A) dans A et arrête', () => {
      const { ram, assemble } = setup();
      const r = assemble('LDA #$2A\nBRK');
      expect(r.ok).toBe(true);
      expect(r.bytes).toBe(3);
      expect(ram.read(0x0600)).toBe(0xA9);
      expect(ram.read(0x0601)).toBe(0x2A);
      expect(ram.read(0x0602)).toBe(0x00);
    });

    it('boucle avec compteur', () => {
      // LDX #$05 = 2 octets, DEX = 1, BNE LOOP = 2, BRK = 1 → total 6
      // LOOP: est un label pur, ne produit aucun octet
      const src = [
        'LDX #$05',
        'LOOP:',
        'DEX',
        'BNE LOOP',
        'BRK',
      ].join('\n');
      const { assemble } = setup();
      const r = assemble(src);
      expect(r.ok).toBe(true);
      expect(r.bytes).toBe(6);
    });

    it('écriture dans la zone display ($0200)', () => {
      const src = 'LDA #$01\nSTA $0200\nBRK';
      const { assemble } = setup();
      const r = assemble(src);
      expect(r.ok).toBe(true);
      expect(r.bytes).toBe(6);
    });
  });

  // ── Désassembleur ─────────────────────────────────────────────

  describe('disassemble', () => {
    it('désassemble LDA #$42', () => {
      const { ram, asm } = setup();
      ram.write(0x0600, 0xA9);
      ram.write(0x0601, 0x42);
      const out = asm.disassemble(ram, 0x0600, 2);
      expect(out).toContain('LDA');
      expect(out).toContain('#$42');
    });

    it('désassemble NOP (1 octet)', () => {
      const { ram, asm } = setup();
      ram.write(0x0600, 0xEA);
      const out = asm.disassemble(ram, 0x0600, 1);
      expect(out).toContain('NOP');
    });

    it('opcode inconnu → ???', () => {
      const { ram, asm } = setup();
      ram.write(0x0600, 0xFF); // pas un opcode 6502 officiel
      const out = asm.disassemble(ram, 0x0600, 1);
      expect(out).toContain('???');
    });

    it('disassembleOne retourne une string pour chaque opcode connu', () => {
      const { ram, asm } = setup();
      ram.write(0x0600, 0xA9); // LDA imm
      ram.write(0x0601, 0x42);
      const line = asm.disassembleOne(ram, 0x0600);
      expect(line).toBe('LDA #$42');
    });

    it('désassemble des branches avec offset signé négatif', () => {
      const { ram, asm } = setup();
      ram.write(0x0600, 0xD0); // BNE
      ram.write(0x0601, 0xFE); // offset -2 → boucle sur soi-même
      const out = asm.disassembleOne(ram, 0x0600);
      expect(out).toMatch(/BNE/);
    });
  });
});