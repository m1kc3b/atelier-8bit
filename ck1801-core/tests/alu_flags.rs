// Tests exhaustifs et property-based de l'ALU (§2.1 borrow, §2.2 V, §2.3 table flags).
//
// Stratégie : pour add/sub on dispose d'un oracle indépendant (arithmétique i16/u16),
// donc on balaie les 256×256 paires — c'est exhaustif, pas seulement échantillonné.

use ck1801_core::alu;

// ── Oracle de référence ─────────────────────────────────────────────────────

/// Oracle addition : renvoie (value, n, z, c, v).
fn oracle_add(a: u8, b: u8, cin: bool) -> (u8, bool, bool, bool, bool) {
    let sum = a as u16 + b as u16 + cin as u16;
    let res = sum as u8;
    let c = sum > 0xFF;
    let v = ((a ^ res) & (b ^ res) & 0x80) != 0;
    (res, res & 0x80 != 0, res == 0, c, v)
}

/// Oracle soustraction a - b - borrow : C de sortie = BORROW (résultat non signé < 0).
fn oracle_sub(a: u8, b: u8, bin: bool) -> (u8, bool, bool, bool, bool) {
    let diff = a as i16 - b as i16 - bin as i16;
    let res = diff as u8;
    let borrow = diff < 0; // emprunt ⟺ résultat non signé négatif
                           // V signé : a et b de signes opposés, et res prend le signe de b (soustracteur)
    let v = ((a ^ b) & (a ^ res) & 0x80) != 0;
    (res, res & 0x80 != 0, res == 0, borrow, v)
}

#[test]
fn add_core_matches_oracle_exhaustive() {
    for a in 0..=255u8 {
        for b in 0..=255u8 {
            for &cin in &[false, true] {
                let out = alu::add_core(a, b, cin);
                let (ev, en, ez, ec, evf) = oracle_add(a, b, cin);
                assert_eq!(out.value, ev, "ADD value a={a} b={b} cin={cin}");
                assert_eq!(out.n, en, "ADD N a={a} b={b} cin={cin}");
                assert_eq!(out.z, ez, "ADD Z a={a} b={b} cin={cin}");
                assert_eq!(out.c, ec, "ADD C a={a} b={b} cin={cin}");
                assert_eq!(out.v, evf, "ADD V a={a} b={b} cin={cin}");
            }
        }
    }
}

#[test]
fn sub_core_borrow_matches_oracle_exhaustive() {
    for a in 0..=255u8 {
        for b in 0..=255u8 {
            for &bin in &[false, true] {
                let out = alu::sub_core(a, b, bin);
                let (ev, en, ez, ec, evf) = oracle_sub(a, b, bin);
                assert_eq!(out.value, ev, "SUB value a={a} b={b} bin={bin}");
                assert_eq!(out.n, en, "SUB N a={a} b={b} bin={bin}");
                assert_eq!(out.z, ez, "SUB Z a={a} b={b} bin={bin}");
                assert_eq!(out.c, ec, "SUB C(borrow) a={a} b={b} bin={bin}");
                assert_eq!(out.v, evf, "SUB V a={a} b={b} bin={bin}");
            }
        }
    }
}

/// ⚠ PIÈGE §2.1 : après CMP rs,rd (calcul rd - rs), C=1 ⟺ rd < rs.
#[test]
fn cmp_carry_means_strictly_less() {
    for rd in 0..=255u8 {
        for rs in 0..=255u8 {
            let out = alu::cmp(rd, rs);
            assert_eq!(
                out.c,
                rd < rs,
                "CMP borrow: rd={rd} rs={rs} → C doit valoir (rd<rs)"
            );
            assert_eq!(out.z, rd == rs, "CMP Z: rd={rd} rs={rs}");
        }
    }
}

/// On n'arme jamais C avant SUB : SUB == SBC avec borrow=0.
#[test]
fn sub_equals_sbc_without_borrow() {
    for a in 0..=255u8 {
        for b in 0..=255u8 {
            assert_eq!(alu::sub(a, b), alu::sbc(a, b, false), "a={a} b={b}");
        }
    }
}

/// INC : V ssi $7F→$80 ; C ← report (seulement $FF→$00).
#[test]
fn inc_overflow_and_carry_boundaries() {
    let o7f = alu::inc(0x7F);
    assert_eq!(o7f.value, 0x80);
    assert!(o7f.v, "INC $7F→$80 doit poser V");
    assert!(!o7f.c, "INC $7F ne pose pas C");

    let off = alu::inc(0xFF);
    assert_eq!(off.value, 0x00);
    assert!(off.c, "INC $FF→$00 pose C");
    assert!(off.z, "INC $FF→$00 pose Z");
    assert!(!off.v, "INC $FF ne pose pas V");
}

/// DEC : V ssi $80→$7F ; C ← borrow (seulement $00→$FF).
#[test]
fn dec_overflow_and_borrow_boundaries() {
    let o80 = alu::dec(0x80);
    assert_eq!(o80.value, 0x7F);
    assert!(o80.v, "DEC $80→$7F doit poser V");
    assert!(!o80.c, "DEC $80 ne pose pas borrow");

    let o00 = alu::dec(0x00);
    assert_eq!(o00.value, 0xFF);
    assert!(o00.c, "DEC $00→$FF pose borrow");
    assert!(!o00.z, "DEC $00→$FF ne pose pas Z");
}

/// SHR force bit7=0 → N toujours 0 ; C ← ancien bit0.
#[test]
fn shr_clears_n_and_captures_bit0() {
    for v in 0..=255u8 {
        let out = alu::shr(v);
        assert!(!out.n, "SHR N doit être 0 (v={v})");
        assert_eq!(out.c, v & 1 != 0, "SHR C = ancien bit0 (v={v})");
        assert_eq!(out.value, v >> 1);
    }
}

/// SHL : C ← ancien bit7 ; bit0 ← 0.
#[test]
fn shl_captures_bit7() {
    for v in 0..=255u8 {
        let out = alu::shl(v);
        assert_eq!(out.c, v & 0x80 != 0, "SHL C = ancien bit7 (v={v})");
        assert_eq!(out.value, v << 1);
    }
}

/// ROL/ROR : rotation 9 bits à travers C. Vérifie aller-retour et capture de carry.
#[test]
fn rotations_are_9bit_through_carry() {
    for v in 0..=255u8 {
        for &cin in &[false, true] {
            let l = alu::rol(v, cin);
            assert_eq!(l.value, (v << 1) | cin as u8, "ROL value v={v} cin={cin}");
            assert_eq!(l.c, v & 0x80 != 0, "ROL C v={v}");

            let r = alu::ror(v, cin);
            assert_eq!(
                r.value,
                (v >> 1) | ((cin as u8) << 7),
                "ROR value v={v} cin={cin}"
            );
            assert_eq!(r.c, v & 1 != 0, "ROR C v={v}");
        }
    }
}

/// Logiques : C et V inchangés (NZ--). apply_flags ne doit pas les toucher.
#[test]
fn logical_ops_set_only_nz() {
    use ck1801_core::isa::{fl, flag_mask};
    // état initial avec C=1 et V=1 ; AND ne doit pas les modifier.
    let mut flreg = fl::C | fl::V;
    let out = alu::and(0xF0, 0x0F); // = 0 → Z
    let mask = flag_mask(true, true, false, false).0; // NZ--
    alu::apply_flags(&mut flreg, mask, &out);
    assert!(flreg & fl::C != 0, "AND ne doit pas toucher C");
    assert!(flreg & fl::V != 0, "AND ne doit pas toucher V");
    assert!(flreg & fl::Z != 0, "AND 0xF0&0x0F=0 doit poser Z");
    assert!(flreg & fl::N == 0, "résultat 0 → N=0");
}

/// Les bits réservés (5–2) du registre FL restent toujours 0.
#[test]
fn reserved_flag_bits_stay_zero() {
    use ck1801_core::isa::{fl, flag_mask};
    let mut flreg = 0xFF; // tous bits à 1 au départ
    let out = alu::add(1, 1);
    alu::apply_flags(&mut flreg, flag_mask(true, true, true, true).0, &out);
    assert_eq!(flreg & 0b0011_1100, 0, "bits 5–2 doivent rester 0");
    assert_eq!(flreg & !fl::VALID, 0);
}
