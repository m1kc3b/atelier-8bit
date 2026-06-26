// Couverture d'exécution exhaustive : chaque mnémonique de l'ISA est exercé par
// au moins un test d'exécution réel (effet observable + cycles), pour qu'aucune
// instruction ne soit livrée sans test direct.

use ck1801_core::cpu::{VEC_TIMER, VEC_VBLANK};
use ck1801_core::isa::fl;
use ck1801_core::Machine;

fn m_with(prog: &[u8]) -> Machine {
    let mut m = Machine::new();
    m.mem.load(0x0200, prog);
    m.cpu.pc = 0x0200;
    m
}

#[test]
fn shl_execution() {
    // SHL R0 ($E6) : $81 → $02, C ← ancien bit7 = 1.
    let mut m = m_with(&[0xE6]);
    m.cpu.r[0] = 0x81;
    m.cpu.step(&mut m.mem);
    assert_eq!(m.cpu.r[0], 0x02);
    assert!(m.cpu.fl & fl::C != 0, "C = ancien bit7");
    assert_eq!(m.cpu.cycles, 2);
}

#[test]
fn shr_execution() {
    // SHR R0 ($E9) : $03 → $01, C ← ancien bit0 = 1, N toujours 0.
    let mut m = m_with(&[0xE9]);
    m.cpu.r[0] = 0x03;
    m.cpu.step(&mut m.mem);
    assert_eq!(m.cpu.r[0], 0x01);
    assert!(m.cpu.fl & fl::C != 0);
    assert!(m.cpu.fl & fl::N == 0, "N=0 après SHR");
}

#[test]
fn rol_execution_through_carry() {
    // ROL R0 ($EC) avec C=1 : $80 → $01 (bit0←C_in), C_out ← ancien bit7 = 1.
    let mut m = m_with(&[0xEC]);
    m.cpu.r[0] = 0x80;
    m.cpu.fl = fl::C;
    m.cpu.step(&mut m.mem);
    assert_eq!(m.cpu.r[0], 0x01, "bit0 reçoit C entrant");
    assert!(m.cpu.fl & fl::C != 0, "C sort = ancien bit7");
}

#[test]
fn ror_execution_through_carry() {
    // ROR R0 ($F0) avec C=1 : $01 → $80 (bit7←C_in), C_out ← ancien bit0 = 1.
    let mut m = m_with(&[0xF0]);
    m.cpu.r[0] = 0x01;
    m.cpu.fl = fl::C;
    m.cpu.step(&mut m.mem);
    assert_eq!(m.cpu.r[0], 0x80);
    assert!(m.cpu.fl & fl::C != 0);
}

#[test]
fn ora_execution() {
    // ORA R0,R1 ($91) : R1 ← R1 | R0.
    let mut m = m_with(&[0x91]);
    m.cpu.r[0] = 0x0F;
    m.cpu.r[1] = 0xF0;
    m.cpu.step(&mut m.mem);
    assert_eq!(m.cpu.r[1], 0xFF);
    assert!(m.cpu.fl & fl::N != 0, "bit7 posé → N");
}

#[test]
fn xor_execution() {
    // XOR R0,R1 ($A1) : R1 ← R1 ^ R0 ; valeurs égales → 0 → Z.
    let mut m = m_with(&[0xA1]);
    m.cpu.r[0] = 0x55;
    m.cpu.r[1] = 0x55;
    m.cpu.step(&mut m.mem);
    assert_eq!(m.cpu.r[1], 0x00);
    assert!(m.cpu.fl & fl::Z != 0);
}

#[test]
fn bn_branch_on_negative() {
    // Pose N via ADD donnant bit7, puis BN saute.
    // LDI #$70,R0 ; ADD #$10,R0 ($C0) → $80 (N=1) ; BN +2 ; LDI #$00,R0 ; HLT
    let prog = [
        0x10, 0x70, // LDI #$70,R0
        0xC0, 0x10, // ADD #$10,R0 → $80, N=1
        0xFB, 0x02, // BN +2  (saute le LDI suivant)
        0x10, 0x00, // LDI #$00,R0 (sauté)
        0x3F, // HLT
    ];
    let mut m = m_with(&prog);
    m.cpu.vblank_period = 100;
    m.run_steps(10);
    assert_eq!(m.cpu.r[0], 0x80, "BN pris : le LDI #0 est sauté");
}

#[test]
fn bnc_branch_on_no_carry() {
    // ADD sans report → C=0 → BNC pris.
    // LDI #1,R0 ; ADD #1,R0 ($C0) → 2, C=0 ; BNC +2 ; LDI #$FF,R0 ; HLT
    let prog = [
        0x10, 0x01, // LDI #1,R0
        0xC0, 0x01, // ADD #1,R0 → 2, C=0
        0xFA, 0x02, // BNC +2
        0x10, 0xFF, // LDI #$FF,R0 (sauté)
        0x3F, // HLT
    ];
    let mut m = m_with(&prog);
    m.cpu.vblank_period = 100;
    m.run_steps(10);
    assert_eq!(m.cpu.r[0], 0x02, "BNC pris");
}

#[test]
fn sei_cli_mask_timer_irq() {
    // SEI masque l'IRQ timer ; CLI la démasque. On vérifie via trigger_timer.
    let mut m = Machine::new();
    m.mem.write16(VEC_TIMER, 0x0400); // handler installé
    m.mem.load(0x0400, &[0xF5]); // RET immédiat
    m.cpu.pc = 0x0200;

    // SEI ($3D)
    m.mem.load(0x0200, &[0x3D]);
    m.cpu.step(&mut m.mem);
    assert!(m.cpu.irq_masked, "SEI masque");
    let pc_before = m.cpu.pc;
    m.cpu.trigger_timer(&mut m.mem);
    assert_eq!(m.cpu.pc, pc_before, "IRQ timer ignorée car masquée");

    // CLI ($3E)
    m.mem.poke(0x0201, 0x3E);
    m.cpu.pc = 0x0201;
    m.cpu.step(&mut m.mem);
    assert!(!m.cpu.irq_masked, "CLI démasque");
    m.cpu.trigger_timer(&mut m.mem);
    assert_eq!(m.cpu.pc, 0x0400, "IRQ timer prise après CLI");
}

#[test]
fn ldxd_stxd_execution() {
    // STXD $4000 ($32) écrit IX ; LDXD $4000 ($31) le relit.
    let mut m = Machine::new();
    m.cpu.ix = 0xBEEF;
    m.mem.load(0x0200, &[0x32, 0x00, 0x40]); // STXD $4000
    m.cpu.pc = 0x0200;
    m.cpu.step(&mut m.mem);
    assert_eq!(m.mem.read16(0x4000), 0xBEEF, "STXD écrit IX little-endian");

    m.cpu.ix = 0;
    m.mem.load(0x0203, &[0x31, 0x00, 0x40]); // LDXD $4000
    m.cpu.pc = 0x0203;
    m.cpu.step(&mut m.mem);
    assert_eq!(m.cpu.ix, 0xBEEF, "LDXD relit IX");
}

#[test]
fn sys_costs_eight_cycles_no_routine() {
    // SYS #16 ($3C 16) : 8 cycles, aucun effet de routine au stade cœur.
    let mut m = m_with(&[0x3C, 0x10]);
    m.cpu.step(&mut m.mem);
    assert_eq!(m.cpu.cycles, 8, "SYS coûte 8 cycles de base");
}

#[test]
fn vblank_interrupt_entry_and_ret() {
    // VBLANK installé : entrée empile (FL,PC,is_irq=1), RET restaure FL et PC.
    let mut m = Machine::new();
    m.mem.write16(VEC_VBLANK, 0x0500);
    m.mem.load(0x0500, &[0xF5]); // handler = RET seul
    m.cpu.pc = 0x0250;
    m.cpu.fl = fl::N | fl::C; // état FL à préserver
    m.cpu.trigger_vblank(&mut m.mem);
    assert_eq!(m.cpu.pc, 0x0500, "saut au handler VBLANK");
    m.cpu.step(&mut m.mem); // exécute RET
    assert_eq!(m.cpu.pc, 0x0250, "RET d'IT restaure PC");
    assert_eq!(
        m.cpu.fl & (fl::N | fl::C),
        fl::N | fl::C,
        "RET d'IT restaure FL"
    );
}
