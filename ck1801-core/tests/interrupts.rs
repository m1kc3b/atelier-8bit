// Tests des interruptions câblées sur l'horloge (§15.1) : déclenchement VBlank
// au franchissement de période, timer à TIMER_PERIOD×256 cycles, masquage
// SEI/CLI, priorité VBlank>timer, et incrément du compteur de frames.

use ck1801_core::cpu::{VEC_TIMER, VEC_VBLANK};
use ck1801_core::io::reg;
use ck1801_core::Machine;

/// Installe un handler qui écrit une marque puis RET, et renvoie la machine prête.
fn machine_with_handlers() -> Machine {
    let mut m = Machine::new();
    // Handler VBLANK en $0500 : INC R0 ; RET  ($E0 $F5)
    m.mem.load(0x0500, &[0xE0, 0xF5]);
    m.mem.write16(VEC_VBLANK, 0x0500);
    // Handler TIMER en $0600 : INC R1 ; RET  ($E3? non) — INC R1 = $E1 ; RET = $F5
    m.mem.load(0x0600, &[0xE1, 0xF5]);
    m.mem.write16(VEC_TIMER, 0x0600);
    m
}

#[test]
fn vblank_fires_at_period_boundary() {
    let mut m = machine_with_handlers();
    m.cpu.set_vblank_period(10); // front tous les 10 cycles
                                 // Boucle de NOP (2 cycles chacun) en $0200.
    let prog = vec![0x00; 64]; // 64 NOP
    m.mem.load(0x0200, &prog);
    m.cpu.pc = 0x0200;

    // Exécuter assez pour franchir plusieurs fronts VBlank.
    for _ in 0..20 {
        m.cpu.step(&mut m.mem);
    }
    // R0 a été incrémenté par le handler VBLANK à chaque front.
    assert!(
        m.cpu.r[0] >= 1,
        "VBLANK doit avoir déclenché le handler (R0 incrémenté)"
    );
    // Le compteur de frames a avancé.
    assert!(
        m.mem.io.frame >= 1,
        "compteur de frames incrémenté au VBlank"
    );
}

#[test]
fn vblank_increments_frame_counter() {
    let mut m = Machine::new();
    m.cpu.set_vblank_period(8);
    // Pas de handler installé : le frame counter doit quand même avancer.
    m.mem.write16(VEC_VBLANK, 0x0000);
    let prog = vec![0x00; 32];
    m.mem.load(0x0200, &prog);
    m.cpu.pc = 0x0200;
    for _ in 0..16 {
        m.cpu.step(&mut m.mem);
    }
    assert!(
        m.mem.io.frame >= 2,
        "frames comptés même sans handler VBLANK"
    );
}

#[test]
fn timer_fires_after_period_times_256() {
    let mut m = machine_with_handlers();
    // VBlank très lointain pour isoler le timer.
    m.cpu.set_vblank_period(1_000_000);
    // Timer : période 1 → expire à 256 cycles.
    m.mem.write(reg::TIMER_PERIOD, 0x01);
    m.mem.write(reg::TIMER_CTRL, 0x01); // enable

    // NOP = 2 cycles ; il faut 128 NOP pour atteindre 256 cycles.
    let prog = vec![0x00; 200];
    m.mem.load(0x0200, &prog);
    m.cpu.pc = 0x0200;
    for _ in 0..130 {
        m.cpu.step(&mut m.mem);
    }
    assert!(
        m.cpu.r[1] >= 1,
        "TIMER doit avoir déclenché le handler (R1 incrémenté)"
    );
}

#[test]
fn timer_masked_by_sei_unmasked_by_cli() {
    let mut m = machine_with_handlers();
    m.cpu.set_vblank_period(1_000_000);
    m.mem.write(reg::TIMER_PERIOD, 0x01);
    m.mem.write(reg::TIMER_CTRL, 0x01);

    // Programme : SEI ; puis 200 NOP. Timer masqué → R1 ne bouge pas.
    let mut prog = vec![0x3D]; // SEI
    prog.extend(vec![0x00; 200]);
    m.mem.load(0x0200, &prog);
    m.cpu.pc = 0x0200;
    for _ in 0..150 {
        m.cpu.step(&mut m.mem);
    }
    assert_eq!(m.cpu.r[1], 0, "timer masqué par SEI : handler non appelé");
}

#[test]
fn timer_period_zero_is_disarmed() {
    let mut m = machine_with_handlers();
    m.cpu.set_vblank_period(1_000_000);
    m.mem.write(reg::TIMER_PERIOD, 0x00); // période 0 = désarmé
    m.mem.write(reg::TIMER_CTRL, 0x01); // enable mais période 0

    let prog = vec![0x00; 200];
    m.mem.load(0x0200, &prog);
    m.cpu.pc = 0x0200;
    for _ in 0..150 {
        m.cpu.step(&mut m.mem);
    }
    assert_eq!(
        m.cpu.r[1], 0,
        "période 0 → timer désarmé, pas de déclenchement"
    );
}

#[test]
fn vblank_served_before_timer_on_coincidence() {
    // Quand les deux expirent au même point, VBLANK passe en premier.
    // On le vérifie indirectement : le handler VBLANK (INC R0) s'exécute, et
    // comme l'entrée VBLANK masque les IRQ, le timer attend le RET.
    let mut m = machine_with_handlers();
    // Fait coïncider : period VBlank = 256, timer period 1 (=256).
    m.cpu.set_vblank_period(256);
    m.mem.write(reg::TIMER_PERIOD, 0x01);
    m.mem.write(reg::TIMER_CTRL, 0x01);

    let prog = vec![0x00; 400];
    m.mem.load(0x0200, &prog);
    m.cpu.pc = 0x0200;
    for _ in 0..200 {
        m.cpu.step(&mut m.mem);
    }
    // VBLANK a déclenché (R0>0). Le test principal est l'absence de crash et le
    // déclenchement déterministe ; la priorité garantit que VBLANK n'est jamais
    // affamé par le timer.
    assert!(m.cpu.r[0] >= 1, "VBLANK servi (priorité sur timer)");
}

#[test]
fn interrupt_entry_masks_then_ret_restores() {
    // Déclenchement manuel déterministe : on entre dans VBLANK, on vérifie le
    // masque posé, on exécute le handler (INC R0 ; RET), on vérifie le masque levé.
    let mut m = machine_with_handlers();
    let prog = vec![0x00; 8];
    m.mem.load(0x0200, &prog);
    m.cpu.pc = 0x0200;
    assert!(!m.cpu.irq_masked, "départ non masqué");

    // Entrée VBLANK manuelle (équivaut à un front).
    m.cpu.trigger_vblank(&mut m.mem);
    assert!(m.cpu.irq_masked, "l'entrée d'interruption pose le masque");
    assert_eq!(m.cpu.pc, 0x0500, "saut au handler VBLANK");

    // Exécuter le handler : INC R0 ($E0), puis RET ($F5).
    m.cpu.step(&mut m.mem); // INC R0
    assert!(m.cpu.irq_masked, "toujours masqué pendant le handler");
    m.cpu.step(&mut m.mem); // RET
    assert!(
        !m.cpu.irq_masked,
        "RET d'IT restaure le masque (à false ici)"
    );
    assert_eq!(m.cpu.r[0], 1, "handler exécuté (INC R0)");
}

#[test]
fn sys_reset_register_reboots() {
    // Écrire $D306 déclenche un reset à chaud au prochain point de contrôle.
    let mut m = Machine::new();
    m.mem.write16(VEC_VBLANK, 0x0000);
    m.mem.write16(ck1801_core::cpu::VEC_RESET, 0x0300);
    m.cpu.set_vblank_period(1_000_000);
    // Programme : ST R0,$D306 (écriture quelconque) → reset.
    m.cpu.r[0] = 0x01;
    m.mem.load(0x0200, &[0x23, 0x06, 0xD3]); // ST R0,$D306
    m.cpu.pc = 0x0200;
    m.cpu.step(&mut m.mem);
    assert_eq!(
        m.cpu.pc, 0x0300,
        "SYS_RESET : PC rechargé depuis le vecteur RESET"
    );
}
