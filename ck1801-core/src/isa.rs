// isa.rs — Types fondamentaux de l'ISA CK-1801 (modèle programmeur §1–§2).
//
// Référence normative : CK-1801_reference.md v2.0-FINAL.

/// Registres généraux symétriques. Le motif binaire `11` n'a PAS de variante :
/// il est illégal (§1) et le décodeur produit Instr::Illegal, jamais un Reg.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Reg {
    R0 = 0,
    R1 = 1,
    R2 = 2,
}

impl Reg {
    /// Décode un champ registre 2 bits. `11` → None (illégal, §1).
    #[inline]
    pub fn from_field(f: u8) -> Option<Reg> {
        match f & 0b11 {
            0 => Some(Reg::R0),
            1 => Some(Reg::R1),
            2 => Some(Reg::R2),
            _ => None, // 0b11 INVALIDE
        }
    }
    #[inline]
    pub fn from_index(i: u8) -> Option<Reg> {
        Self::from_field(i)
    }
}

// ── Bits du registre FL (§2) ────────────────────────────────────────────────
// Bits 5–2 réservés : lus à 0, non modifiables.
pub mod fl {
    pub const N: u8 = 0b1000_0000; // bit 7 du dernier résultat ALU
    pub const V: u8 = 0b0100_0000; // dépassement signé
    pub const Z: u8 = 0b0000_0010; // résultat == 0
    pub const C: u8 = 0b0000_0001; // carry / borrow unifié
    /// Masque des bits effectivement présents (le reste est lu à 0).
    pub const VALID: u8 = N | V | Z | C;
}

/// Masque des flags affectés par une instruction (quels bits elle a le droit d'écrire).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FlagMask(pub u8);

/// Construit un FlagMask depuis les booléens N/Z/C/V (utilisé par la table générée).
pub const fn flag_mask(n: bool, z: bool, c: bool, v: bool) -> FlagMask {
    let mut m = 0u8;
    if n {
        m |= fl::N;
    }
    if z {
        m |= fl::Z;
    }
    if c {
        m |= fl::C;
    }
    if v {
        m |= fl::V;
    }
    FlagMask(m)
}

/// Mnémoniques. Une seule par opération (les variantes d'adressage sont dans `Mode`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mnemonic {
    NOP,
    MOV,
    XCH,
    LDI,
    LD,
    ST,
    LDX,
    LDXD,
    STXD,
    INX,
    DEX,
    ADX,
    PSH,
    POP,
    SYS,
    SEI,
    CLI,
    HLT,
    ADD,
    ADC,
    SUB,
    SBC,
    AND,
    ORA,
    XOR,
    CMP,
    INC,
    DEC,
    SHL,
    SHR,
    ROL,
    ROR,
    JMP,
    JSR,
    RET,
    BRA,
    BZ,
    BNZ,
    BC,
    BNC,
    BN,
    BV,
    RESERVED, // slot non défini → NOP+ILL (§13)
}

/// Mode d'adressage / forme d'opérande. 5 modes mémoire réels (§ contexte) + formes registre.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode {
    Imp,     // implicite (aucun opérande)
    RegImp,  // un registre (unaire, push/pop, load→rd, store←rd) ; cf. src/dst
    RegPair, // deux registres (mov/xch/alu reg-reg)
    Imm,     // #imm 8 bits
    Imm16,   // #imm16 (LDX)
    ImmIx,   // #imm ajouté à IX (ADX)
    Zp,      // $nn page zéro
    Abs,     // $nnnn absolu (aussi cible JMP/JSR, LDXD/STXD)
    IndIx,   // (IX)
    IdxIx,   // IX+$nn
    Rel,     // déplacement signé (branchements)
}

/// Entrée de la table plate. `src`/`dst` : indices registre 0..2, ou 255 si non applicable.
#[derive(Clone, Copy, Debug)]
pub struct OpInfo {
    pub mnem: Mnemonic,
    pub mode: Mode,
    pub size: u8,
    pub cycles: u8,    // cycles de base (branchement non pris)
    pub cyc_taken: u8, // cycles si branchement pris (== cycles sinon)
    pub flags: FlagMask,
    pub src: u8, // 0..2 ou 255
    pub dst: u8, // 0..2 ou 255
}

impl OpInfo {
    /// Slot réservé (§13) : décodé comme NOP, 2 cycles, lève ILL à l'exécution.
    pub const RESERVED: OpInfo = OpInfo {
        mnem: Mnemonic::RESERVED,
        mode: Mode::Imp,
        size: 1,
        cycles: 2,
        cyc_taken: 2,
        flags: FlagMask(0),
        src: 255,
        dst: 255,
    };

    #[inline]
    pub fn src_reg(&self) -> Option<Reg> {
        Reg::from_index(self.src)
    }
    #[inline]
    pub fn dst_reg(&self) -> Option<Reg> {
        Reg::from_index(self.dst)
    }
}
