// Tests de l'assembleur CK-1801. Le test décisif est le round-trip :
// assembler une source, charger le binaire dans le CPU, exécuter, vérifier l'effet.
// Cela prouve que l'émission (ASM_RESOLVE) et le décodage (OPCODES) — tous deux
// dérivés de data/opcodes.tsv — sont cohérents.

use ck1801_core::asm::assemble;
use ck1801_core::isa::fl;
use ck1801_core::Machine;

fn asm_run(src: &str, steps: usize) -> Machine {
    let out = assemble(src).expect("assemblage doit réussir");
    let mut m = Machine::new();
    m.load_at(out.origin, &out.bytes);
    m.run_steps(steps);
    m
}

#[test]
fn assemble_emits_expected_bytes() {
    // LDI #$05,R0 → $10 $05 ; ADD R0,R1 → $41
    let out = assemble("    LDI #$05, R0\n    ADD R0, R1\n").unwrap();
    assert_eq!(out.bytes, vec![0x10, 0x05, 0x41]);
    assert_eq!(out.origin, 0x0200);
}

#[test]
fn roundtrip_add() {
    let m = asm_run("LDI #5,R0\nLDI #3,R1\nADD R0,R1\n", 3);
    assert_eq!(m.cpu.r[1], 8, "R1 = R1 + R0");
}

#[test]
fn roundtrip_destination_on_the_right() {
    // SUB R0,R1 → R1 ← R1 - R0
    let m = asm_run("LDI #10,R1\nLDI #3,R0\nSUB R0,R1\n", 3);
    assert_eq!(m.cpu.r[1], 7);
}

#[test]
fn org_directive_sets_origin() {
    let out = assemble(".org $0300\nLDI #1,R0\n").unwrap();
    assert_eq!(out.origin, 0x0300);
    assert_eq!(out.bytes, vec![0x10, 0x01]);
}

#[test]
fn labels_and_branch_backward() {
    // Boucle : décrémente R0 jusqu'à 0.
    //   LDI #3,R0
    // LOOP:
    //   DEC R0          ; pose Z quand R0=0
    //   BNZ LOOP
    //   HLT
    let src = "
        LDI #3, R0
    LOOP:
        DEC R0
        BNZ LOOP
        HLT
    ";
    let m = asm_run(src, 50);
    assert_eq!(m.cpu.r[0], 0, "la boucle doit ramener R0 à 0");
}

#[test]
fn labels_forward_jmp() {
    // JMP saute par-dessus une instruction qui mettrait R0=$FF.
    let src = "
        JMP SKIP
        LDI #$FF, R0
    SKIP:
        LDI #$42, R0
        HLT
    ";
    let m = asm_run(src, 10);
    assert_eq!(m.cpu.r[0], 0x42, "le JMP doit sauter le LDI #$FF");
}

#[test]
fn jsr_ret_via_assembler() {
    let src = "
        JSR SUB
        HLT
    SUB:
        LDI #$77, R0
        RET
    ";
    let m = asm_run(src, 10);
    assert_eq!(m.cpu.r[0], 0x77);
}

#[test]
fn immediate_alu_forms() {
    // ADD #imm,R0 ($C0) ; AND #imm,R0 ($C6)
    let out = assemble("ADD #$10, R0\nAND #$0F, R0\n").unwrap();
    assert_eq!(out.bytes, vec![0xC0, 0x10, 0xC6, 0x0F]);
}

#[test]
fn memory_modes_zp_vs_abs() {
    // ST R0,$nn (zp, $20) vs ST R0,$nnnn (abs, $23)
    let zp = assemble("ST R0, $80\n").unwrap();
    assert_eq!(zp.bytes, vec![0x20, 0x80]);
    let abs = assemble("ST R0, $4000\n").unwrap();
    assert_eq!(abs.bytes, vec![0x23, 0x00, 0x40], "absolu little-endian");
}

#[test]
fn indexed_and_indirect_modes() {
    // LD (IX),R0 → $19 ; LD IX+$nn,R0 → $1C nn
    let ind = assemble("LD (IX), R0\n").unwrap();
    assert_eq!(ind.bytes, vec![0x19]);
    let idx = assemble("LD IX+$04, R0\n").unwrap();
    assert_eq!(idx.bytes, vec![0x1C, 0x04]);
}

#[test]
fn ldx_imm16_little_endian() {
    // LDX #$1234 → $30 $34 $12
    let out = assemble("LDX #$1234\n").unwrap();
    assert_eq!(out.bytes, vec![0x30, 0x34, 0x12]);
}

#[test]
fn data_directives() {
    let b = assemble(".byte $01, $02, $FF\n").unwrap();
    assert_eq!(b.bytes, vec![0x01, 0x02, 0xFF]);
    let w = assemble(".word $1234, $00FF\n").unwrap();
    assert_eq!(w.bytes, vec![0x34, 0x12, 0xFF, 0x00]);
}

#[test]
fn char_literal() {
    let out = assemble("LDI #'A', R0\n").unwrap();
    assert_eq!(out.bytes, vec![0x10, 0x41]); // 'A' = $41
}

#[test]
fn comments_and_blank_lines_ignored() {
    let src = "
        ; commentaire seul
        LDI #1, R0   ; commentaire en fin de ligne

        LDI #2, R1
    ";
    let out = assemble(src).unwrap();
    assert_eq!(out.bytes, vec![0x10, 0x01, 0x11, 0x02]);
}

#[test]
fn error_on_unknown_mnemonic() {
    let e = assemble("FOO R0, R1\n").unwrap_err();
    assert!(
        e.msg.contains("forme invalide") || e.msg.contains("FOO"),
        "msg: {}",
        e.msg
    );
}

#[test]
fn error_on_invalid_register_pair() {
    // MOV R0,R0 n'existe pas (NOP est $00, pas une forme MOV) → forme invalide.
    let e = assemble("MOV R0, R0\n").unwrap_err();
    assert!(e.msg.contains("forme invalide"), "msg: {}", e.msg);
}

#[test]
fn error_branch_out_of_range() {
    // Cible trop loin pour un déplacement signé 8 bits.
    let mut src = String::from("BRA FAR\n");
    for _ in 0..200 {
        src.push_str("NOP\n");
    }
    src.push_str("FAR:\n NOP\n");
    let e = assemble(&src).unwrap_err();
    assert!(e.msg.contains("hors portée"), "msg: {}", e.msg);
}

#[test]
fn carry_borrow_program_via_assembler() {
    // Vérifie le piège borrow de bout en bout, code écrit en asm.
    // CMP R0,R1 calcule R1 - R0 ; R1=3 R0=5 → C=1 (borrow), BC pris.
    let src = "
        LDI #3, R1
        LDI #5, R0
        CMP R0, R1
        BC  LESS
        LDI #$00, R2
        HLT
    LESS:
        LDI #$AA, R2
        HLT
    ";
    let m = asm_run(src, 20);
    assert_eq!(m.cpu.r[2], 0xAA, "BC doit être pris car R1<R0 (borrow)");
    assert!(m.cpu.fl & fl::C != 0);
}
