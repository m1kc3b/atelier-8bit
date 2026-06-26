#!/usr/bin/env python3
# Génère opcodes.tsv — la source UNIQUE de vérité de la table plate (Annexe A
# de CK-1801_reference.md v2.0-FINAL). 177 opcodes définis, le reste réservé.
#
# Colonnes : opcode<TAB>mnem<TAB>operands<TAB>size<TAB>cycles<TAB>cyc_taken<TAB>flags
#   - opcode    : 0..255
#   - mnem      : mnémonique
#   - operands  : forme texte normalisée (R0,R1 / #imm,R0 / $nn,R0 / (IX),R0 ...)
#   - size      : octets
#   - cycles    : cycles si non pris (cas de base)
#   - cyc_taken : cycles si branchement pris (= cycles si pas un branchement)
#   - flags     : 4 chars parmi N Z C V ou '-' (ordre N Z C V), '----' si aucun
#
# Les opcodes ABSENTS du fichier sont réservés → NOP+ILL (§13).

rows = {}  # opcode -> (mnem, operands, size, cycles, cyc_taken, flags)

def put(op, mnem, operands, size, cycles, cyc_taken=None, flags="----"):
    assert 0 <= op <= 255, f"opcode hors plage: {op:#x}"
    assert op not in rows, f"COLLISION sur ${op:02X}: {rows[op]} vs {mnem} {operands}"
    if cyc_taken is None:
        cyc_taken = cycles
    rows[op] = (mnem, operands, size, cycles, cyc_taken, flags)

REGS = ["R0", "R1", "R2"]

# ── 0x0_ transfert ──────────────────────────────────────────────────────────
put(0x00, "NOP", "", 1, 2)
# MOV rs,rd : 6 paires utiles ($01..$06), ordre Annexe A
mov_pairs = [("R0","R1"),("R0","R2"),("R1","R0"),("R1","R2"),("R2","R0"),("R2","R1")]
for i,(rs,rd) in enumerate(mov_pairs):
    put(0x01+i, "MOV", f"{rs},{rd}", 1, 2)
# XCH ($07..$09)
xch_pairs = [("R0","R1"),("R0","R2"),("R1","R2")]
for i,(a,b) in enumerate(xch_pairs):
    put(0x07+i, "XCH", f"{a},{b}", 1, 3)

# ── 0x1_ load (+ LDI) ───────────────────────────────────────────────────────
# LDI #imm,rd : $10+r
for r in range(3):
    put(0x10+r, "LDI", f"#imm,{REGS[r]}", 2, 2)
# LD $nn,rd : $13+r  (page zéro)
for r in range(3):
    put(0x13+r, "LD", f"$nn,{REGS[r]}", 2, 3)
# LD $nnnn,rd : $16+r (absolu)
for r in range(3):
    put(0x16+r, "LD", f"$nnnn,{REGS[r]}", 3, 4)
# LD (IX),rd : $19+r
for r in range(3):
    put(0x19+r, "LD", f"(IX),{REGS[r]}", 1, 4)
# LD IX+$nn,rd : $1C+r
for r in range(3):
    put(0x1C+r, "LD", f"IX+$nn,{REGS[r]}", 2, 5)

# ── 0x2_ store ──────────────────────────────────────────────────────────────
# ST rd,$nn : $20+r
for r in range(3):
    put(0x20+r, "ST", f"{REGS[r]},$nn", 2, 3)
# ST rd,$nnnn : $23+r
for r in range(3):
    put(0x23+r, "ST", f"{REGS[r]},$nnnn", 3, 4)
# ST rd,(IX) : $26+r
for r in range(3):
    put(0x26+r, "ST", f"{REGS[r]},(IX)", 1, 4)
# ST rd,IX+$nn : $29+r
for r in range(3):
    put(0x29+r, "ST", f"{REGS[r]},IX+$nn", 2, 5)

# ── 0x3_ index / pile / système ─────────────────────────────────────────────
put(0x30, "LDX",  "#imm16", 3, 4)
put(0x31, "LDXD", "$nnnn",  3, 6)
put(0x32, "STXD", "$nnnn",  3, 6)
put(0x33, "INX",  "",       1, 2)
put(0x34, "DEX",  "",       1, 2)
put(0x35, "ADX",  "#imm",   2, 3)
for r in range(3):
    put(0x36+r, "PSH", REGS[r], 1, 3)
for r in range(3):
    put(0x39+r, "POP", REGS[r], 1, 3)
put(0x3C, "SYS", "#n", 2, 8)   # 8 + routine ; le coût routine est ajouté à l'exécution
put(0x3D, "SEI", "",   1, 2)
put(0x3E, "CLI", "",   1, 2)
put(0x3F, "HLT", "",   1, 0)   # cycles dépendants du VBlank (harnais) ; base 0

# ── 0x4_..0xB_ ALU reg-reg ──────────────────────────────────────────────────
# offset = source*3 + destination
alu_rr = [
    (0x40, "ADD", "NZCV"),
    (0x50, "ADC", "NZCV"),
    (0x60, "SUB", "NZCV"),
    (0x70, "SBC", "NZCV"),
    (0x80, "AND", "NZ--"),
    (0x90, "ORA", "NZ--"),
    (0xA0, "XOR", "NZ--"),
    (0xB0, "CMP", "NZCV"),
]
for base, mnem, flags in alu_rr:
    for src in range(3):
        for dst in range(3):
            off = src*3 + dst
            put(base+off, mnem, f"{REGS[src]},{REGS[dst]}", 1, 2, flags=flags)

# ── 0xC_ ALU immédiat groupe A ──────────────────────────────────────────────
# $C0-$C2 ADD, $C3-$C5 SUB, $C6-$C8 AND, $C9-$CB CMP
imm_groupA = [("ADD","NZCV"),("SUB","NZCV"),("AND","NZ--"),("CMP","NZCV")]
for g,(mnem,flags) in enumerate(imm_groupA):
    for r in range(3):
        put(0xC0 + g*3 + r, mnem, f"#imm,{REGS[r]}", 2, 2, flags=flags)

# ── 0xD_ ALU immédiat groupe B ──────────────────────────────────────────────
# $D0-$D2 ADC, $D3-$D5 SBC, $D6-$D8 ORA, $D9-$DB XOR
imm_groupB = [("ADC","NZCV"),("SBC","NZCV"),("ORA","NZ--"),("XOR","NZ--")]
for g,(mnem,flags) in enumerate(imm_groupB):
    for r in range(3):
        put(0xD0 + g*3 + r, mnem, f"#imm,{REGS[r]}", 2, 2, flags=flags)

# ── 0xE_/0xF_ unaires, décalages, rotations ─────────────────────────────────
for r in range(3): put(0xE0+r, "INC", REGS[r], 1, 2, flags="NZCV")
for r in range(3): put(0xE3+r, "DEC", REGS[r], 1, 2, flags="NZCV")
for r in range(3): put(0xE6+r, "SHL", REGS[r], 1, 2, flags="NZC-")
for r in range(3): put(0xE9+r, "SHR", REGS[r], 1, 2, flags="NZC-")
for r in range(3): put(0xEC+r, "ROL", REGS[r], 1, 2, flags="NZC-")
for r in range(3): put(0xF0+r, "ROR", REGS[r], 1, 2, flags="NZC-")

# ── 0xF_ contrôle de flux ───────────────────────────────────────────────────
put(0xF3, "JMP", "$nnnn", 3, 3)
put(0xF4, "JSR", "$nnnn", 3, 6)
put(0xF5, "RET", "",      1, 6)
put(0xF6, "BRA", "rel",   2, 3, cyc_taken=3)
put(0xF7, "BZ",  "rel",   2, 2, cyc_taken=3)
put(0xF8, "BNZ", "rel",   2, 2, cyc_taken=3)
put(0xF9, "BC",  "rel",   2, 2, cyc_taken=3)
put(0xFA, "BNC", "rel",   2, 2, cyc_taken=3)
put(0xFB, "BN",  "rel",   2, 2, cyc_taken=3)
put(0xFC, "BV",  "rel",   2, 2, cyc_taken=3)

# ── Vérifications ───────────────────────────────────────────────────────────
assert len(rows) == 177, f"attendu 177 opcodes, obtenu {len(rows)}"
reserved = 256 - len(rows)
assert reserved == 79, f"attendu 79 réservés, obtenu {reserved}"

import sys
out = []
for op in sorted(rows):
    mnem, operands, size, cyc, cyct, flags = rows[op]
    out.append(f"{op}\t{mnem}\t{operands}\t{size}\t{cyc}\t{cyct}\t{flags}")
sys.stdout.write("\n".join(out) + "\n")
sys.stderr.write(f"OK: {len(rows)} opcodes, {reserved} réservés, aucune collision\n")
