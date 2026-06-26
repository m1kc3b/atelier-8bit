// alu.rs — Unité arithmétique et logique du CK-1801.
//
// Référence normative : §2 (flags), §2.1 (sémantique C = borrow unifié),
// §2.2 (règle V), §8/§9/§10 (opérations). Annexe C (notes d'implémentation).
//
// Principe : une seule primitive d'addition `add_core(a, b, carry_in)`. La
// soustraction est dérivée par complément à deux ; le C de sortie d'une
// soustraction est un BORROW = NON(carry_out de l'addition complémentée).

use crate::isa::fl;

/// Résultat d'une opération ALU : valeur + 4 drapeaux candidats.
/// L'appelant applique ensuite le FlagMask de l'instruction pour ne mettre à jour
/// que les bits autorisés (les autres restent inchangés, §2.3).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AluOut {
    pub value: u8,
    pub n: bool,
    pub z: bool,
    pub c: bool,
    pub v: bool,
}

impl AluOut {
    /// Construit les drapeaux N/Z standard pour une valeur (opérations logiques).
    #[inline]
    fn nz(value: u8, c: bool, v: bool) -> Self {
        AluOut {
            value,
            n: value & 0x80 != 0,
            z: value == 0,
            c,
            v,
        }
    }
}

/// Addition 8 bits avec carry entrant. C sortant = report au-delà du bit 7.
/// V (overflow signé) = mêmes signes en entrée, signe opposé en sortie.
#[inline]
pub fn add_core(a: u8, b: u8, carry_in: bool) -> AluOut {
    let sum = a as u16 + b as u16 + carry_in as u16;
    let res = sum as u8;
    let c = sum > 0xFF;
    // V : a et b de même signe, résultat de signe opposé.
    let v = ((a ^ res) & (b ^ res) & 0x80) != 0;
    AluOut {
        value: res,
        n: res & 0x80 != 0,
        z: res == 0,
        c,
        v,
    }
}

/// Soustraction `a - b - borrow_in` (utilisée pour SUB/SBC/CMP/DEC/comparaisons).
///
/// Implémentation par complément à deux : `a + (!b) + (1 - borrow_in)`.
/// - C SORTANT = BORROW = NON(carry_out de l'addition complémentée)  ← ⚠ §2.1
/// - V : opérandes de signes opposés ET résultat du signe du soustracteur (§2.2)
#[inline]
pub fn sub_core(a: u8, b: u8, borrow_in: bool) -> AluOut {
    // carry_in de l'addition complémentée = 1 - borrow_in
    let add = add_core(a, !b, !borrow_in);
    let borrow_out = !add.c; // inversion : pas de carry ⟺ emprunt
                             // V pour soustraction : (a ^ b) & (a ^ res) & 0x80
    let v = ((a ^ b) & (a ^ add.value) & 0x80) != 0;
    AluOut {
        value: add.value,
        n: add.value & 0x80 != 0,
        z: add.value == 0,
        c: borrow_out,
        v,
    }
}

// ── Opérations exposées (mappées 1:1 aux mnémoniques) ───────────────────────

#[inline]
pub fn add(rd: u8, rs: u8) -> AluOut {
    add_core(rd, rs, false)
}
#[inline]
pub fn adc(rd: u8, rs: u8, c: bool) -> AluOut {
    add_core(rd, rs, c)
}
#[inline]
pub fn sub(rd: u8, rs: u8) -> AluOut {
    sub_core(rd, rs, false)
}
#[inline]
pub fn sbc(rd: u8, rs: u8, c: bool) -> AluOut {
    sub_core(rd, rs, c)
} // C = borrow courant
/// CMP calcule rd - rs (résultat jeté) ; mêmes drapeaux que SUB.
#[inline]
pub fn cmp(rd: u8, rs: u8) -> AluOut {
    sub_core(rd, rs, false)
}

#[inline]
pub fn and(rd: u8, rs: u8) -> AluOut {
    AluOut::nz(rd & rs, false, false)
}
#[inline]
pub fn ora(rd: u8, rs: u8) -> AluOut {
    AluOut::nz(rd | rs, false, false)
}
#[inline]
pub fn xor(rd: u8, rs: u8) -> AluOut {
    AluOut::nz(rd ^ rs, false, false)
}

/// INC : V ssi $7F→$80 (§2.2). C ← report (donc seulement $FF→$00).
#[inline]
pub fn inc(rd: u8) -> AluOut {
    let out = add_core(rd, 1, false);
    // add_core calcule déjà N/Z/C/V correctement ; V($7F+1) = ($7F^$80)&($01^$80)&$80 = vrai.
    out
}

/// DEC : V ssi $80→$7F (§2.2). C ← borrow (donc seulement $00→$FF).
#[inline]
pub fn dec(rd: u8) -> AluOut {
    sub_core(rd, 1, false)
}

/// SHL : décalage gauche logique. bit0 ← 0, C ← ancien bit7. V inchangé (NZC-).
#[inline]
pub fn shl(rd: u8) -> AluOut {
    let c = rd & 0x80 != 0;
    let res = rd << 1;
    AluOut::nz(res, c, false)
}

/// SHR : décalage droite logique. bit7 ← 0, C ← ancien bit0. N donc toujours 0.
#[inline]
pub fn shr(rd: u8) -> AluOut {
    let c = rd & 0x01 != 0;
    let res = rd >> 1;
    AluOut::nz(res, c, false)
}

/// ROL : rotation 9 bits à travers C. bit0 ← C_in, C_out ← ancien bit7.
#[inline]
pub fn rol(rd: u8, carry_in: bool) -> AluOut {
    let c = rd & 0x80 != 0;
    let res = (rd << 1) | carry_in as u8;
    AluOut::nz(res, c, false)
}

/// ROR : rotation 9 bits à travers C. bit7 ← C_in, C_out ← ancien bit0.
#[inline]
pub fn ror(rd: u8, carry_in: bool) -> AluOut {
    let c = rd & 0x01 != 0;
    let res = (rd >> 1) | ((carry_in as u8) << 7);
    AluOut::nz(res, c, false)
}

/// Applique le résultat ALU au registre FL en ne touchant QUE les bits du masque.
/// Garantit que les bits réservés (5–2) restent à 0 et que les bits hors masque
/// conservent leur valeur (§2.3).
#[inline]
pub fn apply_flags(flreg: &mut u8, mask: u8, out: &AluOut) {
    let mut new = *flreg;
    if mask & fl::N != 0 {
        if out.n {
            new |= fl::N;
        } else {
            new &= !fl::N;
        }
    }
    if mask & fl::Z != 0 {
        if out.z {
            new |= fl::Z;
        } else {
            new &= !fl::Z;
        }
    }
    if mask & fl::C != 0 {
        if out.c {
            new |= fl::C;
        } else {
            new &= !fl::C;
        }
    }
    if mask & fl::V != 0 {
        if out.v {
            new |= fl::V;
        } else {
            new &= !fl::V;
        }
    }
    *flreg = new & fl::VALID; // bits réservés toujours 0
}
