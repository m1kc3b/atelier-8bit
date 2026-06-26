// Tests des périphériques mémoire-mappés (io.rs).
// Le test décisif est la conformité du LFSR : période maximale et séquence
// déterministe depuis un seed — fondement de la reproductibilité du barème.

use ck1801_core::io::{reg, Io, LFSR_DEFAULT_SEED, LFSR_MASK};
use ck1801_core::Machine;

#[test]
fn lfsr_has_maximal_period_65535() {
    // Un LFSR 16 bits à polynôme primitif parcourt les 65535 états non nuls
    // avant de revenir au seed initial.
    let mut io = Io::new();
    io.lfsr = 0x0001; // état de départ arbitraire non nul
    let start = io.lfsr;
    let mut period = 0u32;
    loop {
        io.lfsr_step();
        period += 1;
        if io.lfsr == start {
            break;
        }
        assert!(
            period <= 65535,
            "période dépasse 65535 — polynôme non primitif"
        );
    }
    assert_eq!(period, 65535, "période maximale attendue");
}

#[test]
fn lfsr_never_reaches_zero_from_nonzero() {
    // L'état $0000 est absorbant : un LFSR correct ne doit jamais l'atteindre
    // depuis un état non nul.
    let mut io = Io::new();
    io.lfsr = 0xACE1;
    for _ in 0..70000 {
        io.lfsr_step();
        assert_ne!(io.lfsr, 0, "le LFSR ne doit jamais atteindre $0000");
    }
}

#[test]
fn lfsr_zero_seed_is_normalized() {
    // Écrire $0000 comme seed doit être neutralisé (état absorbant interdit).
    let mut io = Io::new();
    io.write(reg::RNG_LO, 0x00);
    io.write(reg::RNG_HI, 0x00);
    assert_eq!(io.lfsr, LFSR_DEFAULT_SEED, "seed nul → valeur par défaut");
}

#[test]
fn lfsr_is_deterministic_from_seed() {
    // Même seed → même séquence. C'est l'invariant de reproductibilité.
    let seq = |seed: u16| {
        let mut io = Io::new();
        io.lfsr = seed;
        (0..16).map(|_| io.rand8()).collect::<Vec<u8>>()
    };
    assert_eq!(
        seq(0x1234),
        seq(0x1234),
        "séquence reproductible depuis un seed"
    );
    assert_ne!(
        seq(0x1234),
        seq(0x5678),
        "seeds différents → séquences différentes"
    );
}

#[test]
fn lfsr_galois_step_matches_reference() {
    // Vérifie l'algorithme exact (Galois, masque 0xB400) sur un pas connu.
    let mut io = Io::new();
    io.lfsr = 0xACE1;
    // Calcul de référence indépendant.
    let expected = {
        let mut s = 0xACE1u16;
        let bit = s & 1;
        s >>= 1;
        if bit == 1 {
            s ^= LFSR_MASK;
        }
        s
    };
    let got = io.lfsr_step();
    assert_eq!(
        got, expected,
        "un pas de LFSR doit suivre la forme Galois 0xB400"
    );
}

#[test]
fn rng_registers_roundtrip_through_memory() {
    // Le seed est lisible/écrivable via $D307/$D308 depuis le bus mémoire.
    let mut m = Machine::new();
    m.mem.write(reg::RNG_LO, 0x34);
    m.mem.write(reg::RNG_HI, 0x12);
    assert_eq!(m.mem.read(reg::RNG_LO), 0x34);
    assert_eq!(m.mem.read(reg::RNG_HI), 0x12);
    assert_eq!(m.mem.io.lfsr, 0x1234);
}

#[test]
fn vpu_mode_is_readable_writable() {
    let mut m = Machine::new();
    m.mem.write(reg::VPU_MODE, 1); // mode gfx
    assert_eq!(m.mem.read(reg::VPU_MODE), 1);
    assert_eq!(m.mem.io.vpu_mode, 1);
}

#[test]
fn input_registers_are_read_only_to_program() {
    // Le programme ne peut pas écrire les registres d'entrée (§13) ; seul le
    // harnais les injecte.
    let mut m = Machine::new();
    m.mem.io.set_key(0x41, 0x41); // 'A' injecté par le harnais
    m.mem.write(reg::KEY_ASCII, 0x00); // tentative d'écriture programme : ignorée
    assert_eq!(
        m.mem.read(reg::KEY_ASCII),
        0x41,
        "entrée RO : écriture programme sans effet"
    );
}

#[test]
fn timer_registers_configurable() {
    let mut m = Machine::new();
    m.mem.write(reg::TIMER_PERIOD, 0x20);
    m.mem.write(reg::TIMER_CTRL, 0x01); // enable
    assert_eq!(m.mem.io.timer_period, 0x20);
    assert!(m.mem.io.timer_enabled());
}

#[test]
fn frame_counter_increments() {
    let mut io = Io::new();
    assert_eq!(io.frame, 0);
    io.tick_frame();
    io.tick_frame();
    assert_eq!(io.frame, 2);
    assert_eq!(io.read(reg::FRAME_LO), 2);
}

#[test]
fn reset_register_requests_reset() {
    let mut m = Machine::new();
    assert!(!m.mem.io.reset_requested);
    m.mem.write(reg::RESET, 0x01); // écriture quelconque
    assert!(
        m.mem.io.reset_requested,
        "écriture en $D306 demande SYS_RESET"
    );
}

#[test]
fn non_device_addresses_still_ram() {
    // Une adresse hors plage device reste de la RAM normale.
    let mut m = Machine::new();
    m.mem.write(0x4000, 0xAB); // VRAM = RAM
    assert_eq!(m.mem.read(0x4000), 0xAB);
    m.mem.write(0x0200, 0xCD); // RAM utilisateur
    assert_eq!(m.mem.read(0x0200), 0xCD);
}
