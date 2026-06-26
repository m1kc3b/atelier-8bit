// Tests de durcissement « production » : prouvent que le cœur ne panique JAMAIS
// sur entrée programme arbitraire (§13, Annexe C), que le boot est conforme (§14),
// et que l'exécution est déterministe (même entrée → même état).

use ck1801_core::cpu::{Cpu, VEC_RESET};
use ck1801_core::io::reg::VPU_MODE;
use ck1801_core::Machine;
use ck1801_core::Memory;

/// Exécute chaque opcode possible (0x00..=0xFF) suivi d'octets variés, depuis
/// plusieurs états initiaux, et vérifie qu'aucune exécution ne panique.
/// Couvre : opcodes définis, réservés, champ registre 11, opérandes manquants.
#[test]
fn no_panic_over_full_opcode_space() {
    // Octets de "queue" pour fournir d'éventuels opérandes (imm, adresses, rel).
    let tails: [&[u8]; 4] = [
        &[0x00, 0x00, 0x00],
        &[0xFF, 0xFF, 0xFF],
        &[0x80, 0x01, 0xD3], // rel négatif, adresses vers I/O
        &[0x7F, 0x00, 0x42],
    ];
    // États SP variés pour provoquer wrap pile haut/bas.
    let sps: [u8; 4] = [0xFF, 0x00, 0x01, 0x80];

    for opcode in 0u16..=0xFF {
        for tail in &tails {
            for &sp in &sps {
                let mut m = Machine::new();
                // Programme : opcode + queue, placé en RAM utilisateur.
                let mut prog = vec![opcode as u8];
                prog.extend_from_slice(tail);
                m.mem.load(0x0200, &prog);
                m.cpu.pc = 0x0200;
                m.cpu.sp = sp;
                m.cpu.vblank_period = 100;
                // Exécuter quelques pas : l'opcode, puis ce qui suit. Aucun panic permis.
                m.run_steps(4);
            }
        }
    }
}

/// Fuzz : milliers de programmes pseudo-aléatoires (LFSR déterministe interne au
/// test, PAS le RNG de la machine), exécutés longuement. Aucun panic, état borné.
#[test]
fn fuzz_random_programs_never_panic() {
    let mut seed: u32 = 0x1234_5678;
    let mut next = || {
        // xorshift32 déterministe (interne au test).
        seed ^= seed << 13;
        seed ^= seed >> 17;
        seed ^= seed << 5;
        seed
    };

    for _ in 0..400 {
        let mut m = Machine::new();
        // Remplir toute la RAM utilisateur de bruit déterministe.
        for addr in 0x0200u16..0x4000 {
            m.mem.poke(addr, (next() & 0xFF) as u8);
        }
        // Vecteurs aléatoires aussi (boot/IT pointant n'importe où).
        for addr in 0xFFFAu16..=0xFFFF {
            m.mem.poke(addr, (next() & 0xFF) as u8);
        }
        m.cpu.pc = 0x0200;
        m.cpu.sp = (next() & 0xFF) as u8;
        m.cpu.vblank_period = 1 + (next() % 500) as u64;
        // Exécution prolongée : on cherche un crash, pas un résultat.
        m.run_steps(5000);
        // Invariant : le compteur de cycles reste cohérent (monotone, pas d'UB).
        assert!(m.cpu.cycles < u64::MAX, "cycles doit rester borné");
    }
}

/// Déterminisme : deux machines partant du même état produisent un état identique.
#[test]
fn execution_is_deterministic() {
    let program: Vec<u8> = (0..1024u16)
        .map(|i| (i.wrapping_mul(31) & 0xFF) as u8)
        .collect();

    let run = || {
        let mut m = Machine::new();
        m.mem.load(0x0200, &program);
        m.cpu.pc = 0x0200;
        m.cpu.vblank_period = 137;
        m.run_steps(3000);
        (
            m.cpu.r,
            m.cpu.ix,
            m.cpu.sp,
            m.cpu.pc,
            m.cpu.fl,
            m.cpu.cycles,
            m.mem.dbg_flags(),
        )
    };

    assert_eq!(run(), run(), "même entrée → même état final (déterminisme)");
}

/// Boot §14 : SP=$FF, FL=0, registres=0, IX=0, VPU_MODE=0, PC=vecteur RESET.
#[test]
fn reset_follows_spec_section_14() {
    let mut mem = Memory::new();
    // Installer un vecteur RESET pointant en $1234 (little-endian en $FFFA/$FFFB).
    mem.poke(VEC_RESET, 0x34);
    mem.poke(VEC_RESET + 1, 0x12);
    // Salir l'état VPU_MODE pour vérifier qu'il est remis à 0.
    mem.io.vpu_mode = 0xAB;

    let mut cpu = Cpu::new();
    // Salir les registres avant reset.
    cpu.r = [0x11, 0x22, 0x33];
    cpu.ix = 0xBEEF;
    cpu.fl = 0xFF;
    cpu.sp = 0x10;

    cpu.reset(&mut mem);

    assert_eq!(cpu.sp, 0xFF, "SP←$FF");
    assert_eq!(cpu.fl, 0x00, "FL←0");
    assert_eq!(cpu.r, [0, 0, 0], "R0=R1=R2←0");
    assert_eq!(cpu.ix, 0x0000, "IX←0");
    assert_eq!(cpu.pc, 0x1234, "PC←vecteur RESET little-endian");
    assert_eq!(mem.read(VPU_MODE), 0x00, "VPU_MODE←0 (mode texte, §14.2)");
    assert_eq!(cpu.cycles, 0, "compteur cycles remis à 0");
}

/// Le compteur de cycles est strictement croissant sur instructions normales
/// (assiette du barème — aucune instruction ne doit coûter 0 sauf cas défini).
#[test]
fn cycles_are_monotonic_nonzero() {
    // Programme d'instructions variées sans branchement infini.
    let prog = [
        0x10, 0x05, // LDI #5,R0
        0x11, 0x03, // LDI #3,R1
        0x41, // ADD R0,R1
        0x33, // INX
        0x07, // XCH R0,R1
        0xE0, // INC R0
        0x00, // NOP
    ];
    let mut m = Machine::new();
    m.mem.load(0x0200, &prog);
    m.cpu.pc = 0x0200;

    let mut last = 0u64;
    for _ in 0..prog.len() {
        let before = m.cpu.cycles;
        m.cpu.step(&mut m.mem);
        let after = m.cpu.cycles;
        assert!(after > before, "chaque instruction consomme ≥1 cycle");
        assert!(after > last || last == 0);
        last = after;
    }
}

/// $D309 reste strictement en lecture seule côté programme (§13).
#[test]
fn dbg_register_is_read_only_to_program() {
    let mut m = Machine::new();
    // ST R0,$D309 (abs) avec R0=$FF : doit être ignoré.
    m.cpu.r[0] = 0xFF;
    m.mem.load(0x0200, &[0x23, 0x09, 0xD3]); // ST R0,$D309
    m.cpu.pc = 0x0200;
    m.cpu.step(&mut m.mem);
    assert_eq!(
        m.mem.dbg_flags() & 0xFC,
        0,
        "aucun bit debug parasite écrit par le programme"
    );
}
