// Tests d'exécution : exactitude des cycles, pièges sémantiques de bout en bout,
// cas limites §13, interruptions §15. Programmes assemblés à la main (octets bruts).

use ck1801_core::cpu::STACK_BASE;
use ck1801_core::isa::fl;
use ck1801_core::Machine;

fn run(code: &[u8], steps: usize) -> Machine {
    let mut m = Machine::new();
    m.load_at(0x0200, code);
    m.run_steps(steps);
    m
}

// ── Exactitude des cycles ────────────────────────────────────────────────────

#[test]
fn cycles_ldi_add_exact() {
    // LDI #$05,R0 ($10 $05) ; LDI #$03,R1 ($11 $03) ; ADD R0,R1 ($41)
    let m = run(&[0x10, 0x05, 0x11, 0x03, 0x41], 3);
    assert_eq!(m.cpu.r[1], 8, "R1 = 5 + 3");
    // 2 + 2 + 2 = 6 cycles
    assert_eq!(m.cpu.cycles, 6, "cycles LDI+LDI+ADD");
}

#[test]
fn cycles_branch_taken_vs_not_taken() {
    // BZ pris : LDI #0,R0 ; ADD #0,R0 (pose Z) ; BZ +0
    // ADD #imm,R0 = $C0
    let taken = run(&[0x10, 0x00, 0xC0, 0x00, 0xF7, 0x00], 3);
    // LDI(2) + ADD#imm(2) + BZ pris(3) = 7
    assert_eq!(taken.cpu.cycles, 7, "BZ pris = 3 cycles");

    // BZ non pris : LDI #1,R0 ; ADD #0,R0 (Z=0) ; BZ
    let not = run(&[0x10, 0x01, 0xC0, 0x00, 0xF7, 0x00], 3);
    // LDI(2) + ADD#imm(2) + BZ non pris(2) = 6
    assert_eq!(not.cpu.cycles, 6, "BZ non pris = 2 cycles");
}

// ── ⚠ PIÈGE : destination à droite ───────────────────────────────────────────

#[test]
fn destination_on_the_right() {
    // SUB R0,R1 ⟹ R1 ← R1 - R0. R1=10, R0=3 → R1=7
    // LDI #10,R1 ; LDI #3,R0 ; SUB R0,R1 ($61)
    let m = run(&[0x11, 0x0A, 0x10, 0x03, 0x61], 3);
    assert_eq!(m.cpu.r[1], 7, "R1 ← R1 - R0 = 10 - 3");
    assert_eq!(m.cpu.r[0], 3, "R0 inchangé");
}

// ── ⚠ PIÈGE : carry = borrow ─────────────────────────────────────────────────

#[test]
fn carry_is_borrow_after_cmp() {
    // CMP R0,R1 calcule R1 - R0. R1=3, R0=5 → R1<R0 → C=1 (borrow)
    // LDI #3,R1 ; LDI #5,R0 ; CMP R0,R1 ($B1)
    let m = run(&[0x11, 0x03, 0x10, 0x05, 0xB1], 3);
    assert!(m.cpu.fl & fl::C != 0, "R1<R0 ⟹ C=1 (borrow)");
    assert!(m.cpu.fl & fl::Z == 0, "pas égal ⟹ Z=0");
    assert_eq!(m.cpu.r[1], 3, "CMP ne modifie pas R1");
}

#[test]
fn no_borrow_when_greater_equal() {
    // R1=5, R0=5 → R1>=R0 → C=0, Z=1
    let m = run(&[0x11, 0x05, 0x10, 0x05, 0xB1], 3);
    assert!(m.cpu.fl & fl::C == 0, "R1>=R0 ⟹ C=0");
    assert!(m.cpu.fl & fl::Z != 0, "égal ⟹ Z=1");
}

// ── ⚠ PIÈGE : INX/DEX/ADX ne touchent aucun flag ─────────────────────────────

#[test]
fn ix_ops_touch_no_flags() {
    // Poser Z via ADD #0 sur R0 nul, puis DEX ; Z doit rester posé.
    // LDI #0,R0 ; ADD #0,R0 ($C0 $00) → Z=1 ; LDX #$0001 ; DEX → IX=0 mais Z inchangé
    let m = run(&[0x10, 0x00, 0xC0, 0x00, 0x30, 0x01, 0x00, 0x34], 4);
    assert_eq!(m.cpu.ix, 0x0000, "DEX : IX 1→0");
    assert!(m.cpu.fl & fl::Z != 0, "DEX ne doit PAS effacer Z");
}

// ── §13 : opcode réservé → NOP + drapeau ILL ─────────────────────────────────

#[test]
fn reserved_opcode_is_nop_plus_ill() {
    // $0F est réservé (absent de la table). Doit agir en NOP (2 cycles) + ILL.
    let m = run(&[0x0F], 1);
    assert_eq!(m.cpu.cycles, 2, "slot réservé = NOP 2 cycles");
    assert!(
        m.mem.dbg_flags() & ck1801_core::memory::ILL_BIT != 0,
        "drapeau ILL levé"
    );
}

// ── §13 : wrap de pile + STKERR ──────────────────────────────────────────────

#[test]
fn stack_overflow_wraps_and_flags_stkerr() {
    // Forcer SP=0 puis PSH R0 → SP wrap à $FF, écriture en $0100, STKERR.
    let mut m = Machine::new();
    m.load_at(0x0200, &[0x36]); // PSH R0
    m.cpu.sp = 0x00;
    m.cpu.r[0] = 0xAB;
    m.run_steps(1);
    assert_eq!(m.cpu.sp, 0xFF, "SP wrap $00→$FF");
    assert_eq!(m.mem.peek(STACK_BASE + 0x00), 0xAB, "écriture en $0100");
    assert!(
        m.mem.dbg_flags() & ck1801_core::memory::STKERR_BIT != 0,
        "STKERR levé"
    );
}

#[test]
fn stack_underflow_wraps_and_flags_stkerr() {
    // SP=$FF puis POP → SP wrap à $00, STKERR.
    let mut m = Machine::new();
    m.load_at(0x0200, &[0x39]); // POP R0
    m.cpu.sp = 0xFF;
    m.run_steps(1);
    assert_eq!(m.cpu.sp, 0x00, "SP wrap $FF→$00");
    assert!(
        m.mem.dbg_flags() & ck1801_core::memory::STKERR_BIT != 0,
        "STKERR levé"
    );
}

// ── §13 : lecture zone non mappée → $00 ; écriture zone RO ignorée ────────────

#[test]
fn write_to_readonly_io_is_ignored() {
    // ST R0,$D200 (absolu) : $23 lo hi. R0=$FF. La zone $D200 est RO → inchangée.
    let mut m = Machine::new();
    m.cpu.r[0] = 0xFF;
    m.load_at(0x0200, &[0x23, 0x00, 0xD2]); // ST R0,$D200
    m.run_steps(1);
    assert_eq!(m.mem.read(0xD200), 0x00, "écriture en zone RO ignorée");
}

// ── JSR/RET ordinaire (is_irq=0, FL non restauré) ────────────────────────────

#[test]
fn jsr_ret_roundtrip() {
    // En $0200 : JSR $0206 ($F4 06 02) ; (à $0203) LDI #$99,R0 ; HLT
    // En $0206 : LDI #$11,R1 ($11 $11) ; RET ($F5)
    let mut m = Machine::new();
    m.load_at(
        0x0200,
        &[
            0xF4, 0x06, 0x02, // JSR $0206
            0x11, 0x11, // (retour ici) LDI #$11,R1
            0x3F, // HLT  (slot $0205) — non atteint en l'état, padding
        ],
    );
    m.mem.load(0x0206, &[0x10, 0x99, 0xF5]); // LDI #$99,R0 ; RET
                                             // étapes : JSR, LDI#$99R0, RET, LDI#$11R1
    m.run_steps(4);
    assert_eq!(m.cpu.r[0], 0x99, "sous-programme exécuté");
    assert_eq!(m.cpu.r[1], 0x11, "retour à l'appelant exécuté");
    assert_eq!(
        m.cpu.pc, 0x0205,
        "PC repris après le JSR (3 octets) + LDI(2)"
    );
}

// ── §15 : RET d'interruption restaure FL ─────────────────────────────────────

#[test]
fn interrupt_ret_restores_fl() {
    let mut m = Machine::new();
    // Handler en $0300 : modifie FL via CMP qui pose C, puis RET.
    // LDI #0,R0 ; LDI #1,R1 ; CMP R1,R0 (R0 - R1 = -1 → C=1) ; RET
    m.mem.load(0x0300, &[0x10, 0x00, 0x11, 0x01, 0xB3, 0xF5]);
    m.mem.write16(ck1801_core::cpu::VEC_VBLANK, 0x0300);
    // FL initial = 0 (C=0). On entre en interruption, le handler pose C=1,
    // puis RET doit restaurer FL=0.
    m.cpu.pc = 0x0200;
    m.mem.load(0x0200, &[0x00]); // NOP en cas de reprise
    m.cpu.fl = 0;
    m.cpu.trigger_vblank(&mut m.mem);
    // exécuter le handler : LDI,LDI,CMP,RET = 4 étapes
    m.run_steps(4);
    assert_eq!(
        m.cpu.fl & fl::C,
        0,
        "RET d'IT doit restaurer FL (C remis à 0)"
    );
    assert_eq!(m.cpu.pc, 0x0200, "retour à l'adresse interrompue");
}

// ── HLT : reprend à l'instruction suivante (ne termine pas le run) ────────────

#[test]
fn hlt_resumes_next_instruction() {
    let mut m = Machine::new();
    m.cpu.vblank_period = 100;
    // HLT ($3F) ; LDI #$42,R0 ($10 $42)
    m.load_at(0x0200, &[0x3F, 0x10, 0x42]);
    let halted_first = m.cpu.step(&mut m.mem); // exécute HLT
    assert!(!halted_first, "HLT ne doit pas arrêter le run");
    // coût = cycles jusqu'à la prochaine frontière de période (100)
    assert_eq!(m.cpu.cycles, 100, "HLT consomme jusqu'au prochain VBlank");
    m.cpu.step(&mut m.mem); // LDI suivant
    assert_eq!(
        m.cpu.r[0], 0x42,
        "exécution reprend à l'instruction suivante"
    );
}

// ── Aucun crash sur flot d'octets arbitraire (robustesse §13/Annexe C) ────────

#[test]
fn never_panics_on_arbitrary_bytes() {
    // Remplit la RAM de tous les octets et exécute longuement : ne doit jamais paniquer.
    for seed in [0u8, 1, 0x55, 0xAA, 0xFF, 0x11, 0x3F, 0xF5] {
        let mut m = Machine::new();
        let prog: Vec<u8> = (0..512u16).map(|i| (i as u8) ^ seed).collect();
        m.load_at(0x0200, &prog);
        // Beaucoup d'étapes : on veut surtout l'absence de panic.
        m.run_steps(2000);
    }
}
