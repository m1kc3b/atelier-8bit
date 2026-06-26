// Tests de l'API système SYS #n (§18) : effets déterministes + coûts cycles.
// Le coût total d'un SYS est 8 (opcode) + coût routine (barème §18) ; les tests
// vérifient ce total, car c'est l'assiette du barème de notation.

use ck1801_core::sys;
use ck1801_core::Machine;

/// Appelle directement une routine et renvoie (machine, coût routine).
fn call(n: u8, setup: impl FnOnce(&mut Machine)) -> (Machine, u64) {
    let mut m = Machine::new();
    setup(&mut m);
    let cost = sys::dispatch(&mut m.cpu, &mut m.mem, n);
    (m, cost)
}

// ── Système / calcul ─────────────────────────────────────────────────────────

#[test]
fn sys_version_returns_2_1() {
    let (m, cost) = call(70, |_| {});
    assert_eq!(m.cpu.r[0], 2, "majeur");
    assert_eq!(m.cpu.r[1], 1, "mineur");
    assert_eq!(cost, 4);
}

#[test]
fn sys_get_rand_advances_lfsr_deterministically() {
    let seq = |seed: u16| {
        let mut m = Machine::new();
        m.mem.io.lfsr = seed;
        (0..4)
            .map(|_| {
                sys::dispatch(&mut m.cpu, &mut m.mem, 65);
                m.cpu.r[0]
            })
            .collect::<Vec<u8>>()
    };
    assert_eq!(seq(0x1234), seq(0x1234), "RNG reproductible depuis un seed");
    let (_, cost) = call(65, |_| {});
    assert_eq!(cost, 4);
}

#[test]
fn sys_rand16_returns_full_state() {
    let (m, cost) = call(66, |mm| mm.mem.io.lfsr = 0xBEEF);
    let combined = (m.cpu.r[1] as u16) << 8 | m.cpu.r[0] as u16;
    assert_eq!(combined, m.mem.io.lfsr, "R0=lo, R1=hi de l'état LFSR");
    assert_eq!(cost, 6);
}

#[test]
fn sys_frame_num_reads_counter() {
    let (m, cost) = call(67, |mm| mm.mem.io.frame = 0x0102);
    assert_eq!(m.cpu.r[0], 0x02);
    assert_eq!(m.cpu.r[1], 0x01);
    assert_eq!(cost, 4);
}

#[test]
fn sys_memcpy_copies_len_bytes() {
    let (m, cost) = call(68, |mm| {
        mm.mem.load(0x1000, &[1, 2, 3, 4, 5]);
        mm.mem.write16(0x80, 0x1000); // src
        mm.mem.write16(0x82, 0x2000); // dst
        mm.mem.write16(0x84, 5); // len
    });
    for i in 0..5 {
        assert_eq!(m.mem.read(0x2000 + i), (i + 1) as u8);
    }
    assert_eq!(cost, 6 + 2 * 5, "6 + 2·len");
}

#[test]
fn sys_memset_fills_len_bytes() {
    let (m, cost) = call(69, |mm| {
        mm.mem.write16(0x80, 0x2000); // dst
        mm.mem.write16(0x82, 4); // len
        mm.cpu.r[0] = 0xAA; // valeur
    });
    for i in 0..4 {
        assert_eq!(m.mem.read(0x2000 + i), 0xAA);
    }
    assert_eq!(cost, 6 + 2 * 4);
}

#[test]
fn sys_reset_requests_reboot() {
    let (m, cost) = call(71, |_| {});
    assert!(m.mem.io.reset_requested);
    assert_eq!(cost, 8);
}

// ── Entrées (lues depuis l'état injecté) ─────────────────────────────────────

#[test]
fn sys_read_key_returns_injected_ascii() {
    let (m, cost) = call(49, |mm| mm.mem.io.set_key(0x41, 0x41));
    assert_eq!(m.cpu.r[0], 0x41, "READ_KEY renvoie l'ASCII injecté");
    assert_eq!(cost, 4);
}

#[test]
fn sys_key_down_does_not_arm_z_and_matches() {
    // R0=scancode → $FF si pressé. ⚠ n'arme pas Z (§18).
    let (m, _) = call(50, |mm| {
        mm.mem.io.key_raw = 0x80; // Haut pressé
        mm.cpu.r[0] = 0x80; // on teste le scancode Haut
    });
    assert_eq!(m.cpu.r[0], 0xFF, "touche pressée → $FF");
    // Z ne doit pas avoir été armé : FL inchangé (resté 0).
    assert_eq!(m.cpu.fl, 0, "KEY_DOWN n'arme pas Z");
}

#[test]
fn sys_read_pad_selects_pad() {
    let (m, _) = call(48, |mm| {
        mm.mem.io.set_pads(0x0F, 0xF0);
        mm.cpu.r[0] = 1; // pad 1
    });
    assert_eq!(m.cpu.r[0], 0xF0, "pad 1 sélectionné");
}

#[test]
fn sys_read_mouse_returns_xyz() {
    let (m, _) = call(51, |mm| mm.mem.io.set_mouse(10, 20, 0x01));
    assert_eq!((m.cpu.r[0], m.cpu.r[1], m.cpu.r[2]), (10, 20, 0x01));
}

// ── Texte ──────────────────────────────────────────────────────────────────

#[test]
fn sys_print_char_writes_vram_and_advances_cursor() {
    let (m, cost) = call(16, |mm| {
        mm.mem.io.cursor_x = 0;
        mm.mem.io.cursor_y = 0;
        mm.cpu.r[0] = b'A';
    });
    assert_eq!(m.mem.read(sys::VRAM_BASE), b'A', "char écrit en VRAM");
    assert_eq!(m.mem.io.cursor_x, 1, "curseur avancé");
    assert_eq!(cost, 6);
}

#[test]
fn sys_print_str_writes_until_nul() {
    let (m, cost) = call(17, |mm| {
        mm.mem.load(0x1000, b"HI\0");
        mm.mem.write16(0x80, 0x1000);
        mm.mem.io.cursor_x = 0;
        mm.mem.io.cursor_y = 0;
    });
    assert_eq!(m.mem.read(sys::VRAM_BASE), b'H');
    assert_eq!(m.mem.read(sys::VRAM_BASE + 1), b'I');
    assert_eq!(cost, 6 + 2 * 2, "6 + 2·longueur");
}

#[test]
fn sys_print_hex_emits_two_digits() {
    let (m, cost) = call(19, |mm| {
        mm.cpu.r[0] = 0xAB;
        mm.mem.io.cursor_x = 0;
        mm.mem.io.cursor_y = 0;
    });
    assert_eq!(m.mem.read(sys::VRAM_BASE), b'A');
    assert_eq!(m.mem.read(sys::VRAM_BASE + 1), b'B');
    assert_eq!(cost, 6 + 4 * 2);
}

#[test]
fn sys_set_get_cursor_roundtrip() {
    let (m, _) = call(20, |mm| {
        mm.cpu.r[0] = 5; // col
        mm.cpu.r[1] = 7; // ligne
    });
    assert_eq!((m.mem.io.cursor_x, m.mem.io.cursor_y), (5, 7));
    // GET_CURSOR relit
    let mut m2 = m;
    m2.cpu.r[0] = 0;
    m2.cpu.r[1] = 0;
    sys::dispatch(&mut m2.cpu, &mut m2.mem, 21);
    assert_eq!((m2.cpu.r[0], m2.cpu.r[1]), (5, 7));
}

// ── Vidéo ──────────────────────────────────────────────────────────────────

#[test]
fn sys_draw_get_pixel_roundtrip() {
    let mut m = Machine::new();
    m.mem.io.vpu_mode = 1; // gfx
                           // DRAW_PIXEL : R0=couleur, R1=x, R2=y
    m.cpu.r[0] = 0x07;
    m.cpu.r[1] = 10;
    m.cpu.r[2] = 5;
    let c1 = sys::dispatch(&mut m.cpu, &mut m.mem, 2);
    assert_eq!(c1, 4);
    // GET_PIXEL au même endroit
    m.cpu.r[0] = 0;
    m.cpu.r[1] = 10;
    m.cpu.r[2] = 5;
    sys::dispatch(&mut m.cpu, &mut m.mem, 3);
    assert_eq!(m.cpu.r[0], 0x07, "pixel relu = pixel écrit");
}

#[test]
fn sys_fill_rect_cost_proportional() {
    let (_, cost) = call(6, |mm| {
        mm.mem.write16(0x80, 0); // x
        mm.mem.write16(0x82, 0); // y
        mm.mem.write16(0x84, 4); // w
        mm.mem.write16(0x86, 3); // h
        mm.cpu.r[0] = 0xFF;
    });
    assert_eq!(cost, 8 + 2 * (4 * 3), "8 + 2·(w·h)");
}

#[test]
fn sys_clear_fills_text_grid() {
    let (m, _) = call(1, |mm| {
        mm.mem.io.vpu_mode = 0; // texte
        mm.cpu.r[0] = b' ';
    });
    // Quelques cellules doivent valoir l'espace.
    assert_eq!(m.mem.read(sys::VRAM_BASE), b' ');
    assert_eq!(m.mem.io.cursor_x, 0, "curseur réinitialisé");
}

// ── Son (état SPU) ───────────────────────────────────────────────────────────

#[test]
fn sys_play_then_stop_voice_updates_ctrl() {
    let mut m = Machine::new();
    m.cpu.r[0] = 0; // voix 0
    m.cpu.r[1] = 60; // note
    sys::dispatch(&mut m.cpu, &mut m.mem, 32); // PLAY_NOTE
    assert_eq!(
        m.mem.read(0xD103),
        0x01,
        "CTRL voix 0 actif après PLAY_NOTE"
    );
    m.cpu.r[0] = 0;
    sys::dispatch(&mut m.cpu, &mut m.mem, 33); // STOP_VOICE
    assert_eq!(
        m.mem.read(0xD103),
        0x00,
        "CTRL voix 0 inactif après STOP_VOICE"
    );
}

// ── Index non défini ─────────────────────────────────────────────────────────

#[test]
fn sys_undefined_index_is_noop_4_cycles() {
    let (m, cost) = call(200, |mm| mm.cpu.r[0] = 0x55);
    assert_eq!(cost, 4, "index non défini = no-op 4 cycles");
    assert_eq!(m.cpu.r[0], 0x55, "aucun effet sur les registres");
}

// ── SYS via exécution réelle (opcode + routine) ─────────────────────────────

#[test]
fn sys_via_opcode_total_cost() {
    // SYS #65 (GET_RAND) via l'opcode : 8 (opcode) + 4 (routine) = 12.
    let mut m = Machine::new();
    m.mem.load(0x0200, &[0x3C, 65]); // SYS #65
    m.cpu.pc = 0x0200;
    m.cpu.set_vblank_period(1_000_000); // pas de VBlank parasite
    m.cpu.step(&mut m.mem);
    assert_eq!(m.cpu.cycles, 12, "8 (opcode SYS) + 4 (GET_RAND)");
}