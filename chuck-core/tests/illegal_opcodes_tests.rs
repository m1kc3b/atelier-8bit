// Test natif des opcodes illégaux ajoutés (LAX, SAX, DCP, ISC).
use chuck_core::assembler::Assembler;
use chuck_core::cpu::Cpu;
use chuck_core::memory::Memory;

fn run_asm(src: &str) -> (Cpu, Memory) {
    let mut mem = Memory::new();
    let r = Assembler::assemble(src, &mut mem);
    assert!(r.ok, "assemblage échoué: {:?}", r.error);
    // Vecteur RESET -> org
    mem.write_raw(0xFFFC, (r.org & 0xFF) as u8);
    mem.write_raw(0xFFFD, (r.org >> 8) as u8);
    let mut cpu = Cpu::new();
    cpu.reset(&mut mem);
    cpu.run(&mut mem, 10_000);
    (cpu, mem)
}

#[test]
fn lax_loads_a_and_x() {
    // LAX $10 : charge A et X depuis $10
    let (cpu, _) = run_asm(".org $E000\n LDA #$AB\n STA $10\n LDA #$00\n LAX $10\n BRK\n");
    assert_eq!(cpu.a, 0xAB, "A doit valoir $AB");
    assert_eq!(cpu.x, 0xAB, "X doit valoir $AB (chargé en même temps)");
}

#[test]
fn sax_stores_a_and_x() {
    // SAX $20 : écrit A & X en $20, sans toucher les flags
    let (_cpu, mut mem) = run_asm(".org $E000\n LDA #$F0\n LDX #$3C\n SAX $20\n BRK\n");
    assert_eq!(mem.read(0x20), 0xF0 & 0x3C, "M doit valoir A & X = $30");
}

#[test]
fn dcp_decrements_and_compares() {
    // DCP $30 : M-- puis CMP A. Si A == nouveau M -> Z=1
    // M=$06 -> $05 ; A=$05 -> égal -> Z=1, C=1
    let (cpu, mut mem) = run_asm(".org $E000\n LDA #$06\n STA $30\n LDA #$05\n DCP $30\n BRK\n");
    assert_eq!(mem.read(0x30), 0x05, "M décrémenté à $05");
    assert!(cpu.get_flag(chuck_core::cpu::flags::Z), "Z=1 car A == M");
    assert!(cpu.get_flag(chuck_core::cpu::flags::C), "C=1 car A >= M");
}

#[test]
fn isc_increments_and_sbc() {
    // ISC $40 : M++ puis SBC A. A=$0A, M=$04 -> $05 ; SEC d'abord
    // A - M = $0A - $05 = $05
    let (cpu, mut mem) = run_asm(".org $E000\n LDA #$04\n STA $40\n SEC\n LDA #$0A\n ISC $40\n BRK\n");
    assert_eq!(mem.read(0x40), 0x05, "M incrémenté à $05");
    assert_eq!(cpu.a, 0x05, "A = $0A - $05 = $05");
}

#[test]
fn lax_saves_cycles_vs_lda_tax() {
    // Démonstration du gain : LAX zp (3 cyc) vs LDA zp + TAX (3+2=5 cyc)
    let (lax, _)   = run_asm(".org $E000\n LAX $10\n BRK\n");
    let (legal, _) = run_asm(".org $E000\n LDA $10\n TAX\n BRK\n");
    // cycles depuis reset (7) : on compare les deltas
    assert!(lax.cycles < legal.cycles,
        "LAX ({}) doit coûter moins que LDA+TAX ({})", lax.cycles, legal.cycles);
}

// ───────── LOT 2 : SLO / RLA / SRE / RRA ─────────

#[test]
fn slo_asl_then_ora() {
    // M=$21 -> ASL -> $42, C=0 ; A=$03 -> A |= $42 = $43
    let (cpu, mut mem) = run_asm(".org $E000\n LDA #$21\n STA $10\n LDA #$03\n SLO $10\n BRK\n");
    assert_eq!(mem.read(0x10), 0x42, "M après ASL = $42");
    assert_eq!(cpu.a, 0x43, "A = $03 | $42 = $43");
    assert!(!cpu.get_flag(chuck_core::cpu::flags::C), "C=0 (bit7 de $21 = 0)");
}

#[test]
fn rla_rol_then_and() {
    // CLC ; M=$80 -> ROL -> $00 avec C=1 ; A=$FF -> A &= $00 = $00
    let (cpu, mut mem) = run_asm(".org $E000\n CLC\n LDA #$80\n STA $10\n LDA #$FF\n RLA $10\n BRK\n");
    assert_eq!(mem.read(0x10), 0x00, "M après ROL = $00");
    assert_eq!(cpu.a, 0x00, "A = $FF & $00 = $00");
    assert!(cpu.get_flag(chuck_core::cpu::flags::C), "C=1 (bit7 de $80)");
    assert!(cpu.get_flag(chuck_core::cpu::flags::Z), "Z=1 (résultat nul)");
}

#[test]
fn sre_lsr_then_eor() {
    // M=$02 -> LSR -> $01, C=0 ; A=$03 -> A ^= $01 = $02
    let (cpu, mut mem) = run_asm(".org $E000\n LDA #$02\n STA $10\n LDA #$03\n SRE $10\n BRK\n");
    assert_eq!(mem.read(0x10), 0x01, "M après LSR = $01");
    assert_eq!(cpu.a, 0x02, "A = $03 ^ $01 = $02");
}

#[test]
fn rra_ror_then_adc() {
    // CLC ; M=$02 -> ROR -> $01, C_out=0 ; A=$10 + $01 + 0 = $11
    let (cpu, mut mem) = run_asm(".org $E000\n CLC\n LDA #$02\n STA $10\n LDA #$10\n RRA $10\n BRK\n");
    assert_eq!(mem.read(0x10), 0x01, "M après ROR = $01");
    assert_eq!(cpu.a, 0x11, "A = $10 + $01 = $11");
}

#[test]
fn rra_carry_propagates() {
    // M=$01 -> ROR : bit0=1 donc C_out=1 ; A=$10 + $00 + 1(carry) = $11
    // (CLC d'abord pour que le bit entrant du ROR soit 0 -> result $00)
    let (cpu, mut mem) = run_asm(".org $E000\n CLC\n LDA #$01\n STA $10\n LDA #$10\n RRA $10\n BRK\n");
    assert_eq!(mem.read(0x10), 0x00, "M après ROR de $01 (C_in=0) = $00");
    assert_eq!(cpu.a, 0x11, "A = $10 + $00 + carry(1) = $11");
}

// ───────── LOT 3 : ANC / ALR / ARR / AXS ─────────
use chuck_core::cpu::flags;

#[test]
fn anc_and_sets_carry_from_bit7() {
    // A=$FF & $80 = $80 -> bit7=1 -> C=1, N=1
    let (cpu, _) = run_asm(".org $E000\n LDA #$FF\n ANC #$80\n BRK\n");
    assert_eq!(cpu.a, 0x80);
    assert!(cpu.get_flag(flags::C), "C = bit7 = 1");
    assert!(cpu.get_flag(flags::N), "N=1");
}

#[test]
fn anc_clears_carry_when_bit7_zero() {
    // A=$0F & $0F = $0F -> bit7=0 -> C=0
    let (cpu, _) = run_asm(".org $E000\n LDA #$0F\n ANC #$0F\n BRK\n");
    assert_eq!(cpu.a, 0x0F);
    assert!(!cpu.get_flag(flags::C), "C=0");
}

#[test]
fn alr_and_then_lsr() {
    // A=$FF & $03 = $03 ; LSR -> $01, C = ancien bit0 = 1
    let (cpu, _) = run_asm(".org $E000\n LDA #$FF\n ALR #$03\n BRK\n");
    assert_eq!(cpu.a, 0x01, "A = ($FF&$03)>>1 = $01");
    assert!(cpu.get_flag(flags::C), "C = bit0 avant shift = 1");
}

#[test]
fn arr_rotates_and_sets_special_flags() {
    // CLC ; A=$FF & $C0 = $C0 ; ROR (C_in=0) -> $60
    // bit6 de $60 = 1 -> C=1 ; bit5=1 -> V = 1 XOR 1 = 0
    let (cpu, _) = run_asm(".org $E000\n CLC\n LDA #$FF\n ARR #$C0\n BRK\n");
    assert_eq!(cpu.a, 0x60, "A = $C0 >> 1 = $60");
    assert!(cpu.get_flag(flags::C), "C = bit6 = 1");
    assert!(!cpu.get_flag(flags::V), "V = bit6 XOR bit5 = 0");
}

#[test]
fn axs_subtracts_into_x() {
    // A=$FF, X=$0F -> (A&X)=$0F ; - $05 = $0A ; C=1 (pas d'emprunt)
    let (cpu, _) = run_asm(".org $E000\n LDA #$FF\n LDX #$0F\n AXS #$05\n BRK\n");
    assert_eq!(cpu.x, 0x0A, "X = ($FF&$0F) - $05 = $0A");
    assert!(cpu.get_flag(flags::C), "C=1 car $0F >= $05");
}

#[test]
fn axs_borrow_clears_carry() {
    // (A&X)=$03 ; - $05 -> emprunt -> C=0, X=$FE
    let (cpu, _) = run_asm(".org $E000\n LDA #$03\n LDX #$03\n AXS #$05\n BRK\n");
    assert_eq!(cpu.x, 0xFE, "X = $03 - $05 = $FE (wrap)");
    assert!(!cpu.get_flag(flags::C), "C=0 car emprunt");
}

// ───────── OPCODES RÉASSIGNÉS SECRETS : MUL / MCP ─────────

#[test]
fn mul_multiplies_a_by_x() {
    // A=$0C (12) * X=$0A (10) = 120 = $78 ; lo=$78 hi=$00
    let (cpu, _) = run_asm(".org $E000\n LDA #$0C\n LDX #$0A\n MUL\n BRK\n");
    assert_eq!(cpu.a, 0x78, "A = octet bas de 120 = $78");
    assert_eq!(cpu.x, 0x00, "X = octet haut = $00");
}

#[test]
fn mul_16bit_result() {
    // A=$FF (255) * X=$FF (255) = 65025 = $FE01 ; lo=$01, hi=$FE
    let (cpu, _) = run_asm(".org $E000\n LDA #$FF\n LDX #$FF\n MUL\n BRK\n");
    assert_eq!(cpu.a, 0x01, "lo = $01");
    assert_eq!(cpu.x, 0xFE, "hi = $FE");
}

#[test]
fn mcp_copies_x_bytes() {
    // Place une source en $0300, copie 3 octets vers $0400 via MCP.
    // pointeurs : src=$0300 -> $FB/$FC ; dst=$0400 -> $FD/$FE ; X=3
    let src = "
        .org $E000
        LDA #$11
        STA $0300
        LDA #$22
        STA $0301
        LDA #$33
        STA $0302
        LDA #$00
        STA $FB
        LDA #$03
        STA $FC
        LDA #$00
        STA $FD
        LDA #$04
        STA $FE
        LDX #$03
        MCP
        BRK
    ";
    let (_cpu, mut mem) = run_asm(src);
    assert_eq!(mem.read(0x0400), 0x11, "octet 0 copié");
    assert_eq!(mem.read(0x0401), 0x22, "octet 1 copié");
    assert_eq!(mem.read(0x0402), 0x33, "octet 2 copié");
}