// sys.rs — API système `SYS #n` (§18) du CK-1801.
//
// Référence normative : §17 (ABI), §18 (table SYS + barème de coûts), §19 (registres).
//
// Modèle déterministe pour la notation : pas de pipeline graphique/sonore réel.
// Les routines de rendu écrivent un état reproductible (VRAM $4000–$5FFF, registres
// SPU) ; les routines de calcul/lecture retournent des valeurs exactes. Chaque
// routine renvoie son coût en cycles (hors les 8 cycles de l'opcode SYS, ajoutés
// par l'appelant) selon le barème normatif §18.
//
// Invariant : aucune routine ne panique ; toutes les adresses sont bornées (u16).

use crate::cpu::Cpu;
use crate::memory::Memory;

// ── Disposition VRAM (déterministe) ─────────────────────────────────────────
// Mode texte : grille 32×32 cellules, 1 octet/caractère, base $4000.
// Mode gfx : framebuffer linéaire 1 octet/pixel, 128×64, base $4000.
pub const VRAM_BASE: u16 = 0x4000;
pub const TEXT_COLS: u16 = 32;
pub const TEXT_ROWS: u16 = 32;
pub const GFX_W: u16 = 128;
pub const GFX_H: u16 = 64;

// Zone paramètres page zéro (§16/§17) : param0=$80/$81 … param3=$86/$87.
const PARAM0: u16 = 0x80;
const PARAM1: u16 = 0x82;
const PARAM2: u16 = 0x84;
const PARAM3: u16 = 0x86;

// Version exposée par SYS_VERSION.
const VERSION_MAJOR: u8 = 2;
const VERSION_MINOR: u8 = 1;

/// Lit un mot 16 bits little-endian en page zéro (zone paramètres).
#[inline]
fn pz16(mem: &Memory, addr: u16) -> u16 {
    mem.read16(addr)
}

/// Adresse VRAM d'une cellule texte (col, ligne), bornée à la grille.
#[inline]
fn text_cell(col: u16, row: u16) -> u16 {
    let c = col % TEXT_COLS;
    let r = row % TEXT_ROWS;
    VRAM_BASE
        .wrapping_add(r.wrapping_mul(TEXT_COLS))
        .wrapping_add(c)
}

/// Adresse VRAM d'un pixel (x, y) en mode gfx, bornée au framebuffer.
#[inline]
fn gfx_pixel(x: u16, y: u16) -> u16 {
    let px = x % GFX_W;
    let py = y % GFX_H;
    VRAM_BASE
        .wrapping_add(py.wrapping_mul(GFX_W))
        .wrapping_add(px)
}

/// Exécute la routine `n` (§18). Retourne le coût en cycles de la ROUTINE
/// (les 8 cycles de l'opcode SYS sont ajoutés séparément par l'appelant).
pub fn dispatch(cpu: &mut Cpu, mem: &mut Memory, n: u8) -> u64 {
    match n {
        // ── Vidéo ────────────────────────────────────────────────────────────
        0 => sys_set_mode(cpu, mem).into_cycles(),
        1 => sys_clear(cpu, mem).into_cycles(),
        2 => sys_draw_pixel(cpu, mem).into_cycles(),
        3 => sys_get_pixel(cpu, mem).into_cycles(),
        4 => sys_draw_line(cpu, mem).into_cycles(),
        5 => sys_draw_rect(cpu, mem).into_cycles(),
        6 => sys_fill_rect(cpu, mem).into_cycles(),
        7 => sys_blit(cpu, mem).into_cycles(),
        8 => sys_draw_spr(cpu, mem).into_cycles(),
        9 => sys_flip(cpu, mem).into_cycles(),

        // ── Texte ──────────────────────────────────────────────────────────────
        16 => sys_print_char(cpu, mem).into_cycles(),
        17 => sys_print_str(cpu, mem).into_cycles(),
        18 => sys_print_num(cpu, mem).into_cycles(),
        19 => sys_print_hex(cpu, mem).into_cycles(),
        20 => sys_set_cursor(cpu, mem).into_cycles(),
        21 => sys_get_cursor(cpu, mem).into_cycles(),
        22 => sys_set_color(cpu, mem).into_cycles(),
        23 => sys_scroll_up(cpu, mem).into_cycles(),

        // ── Son ────────────────────────────────────────────────────────────────
        32 => sys_play_note(cpu, mem).into_cycles(),
        33 => sys_stop_voice(cpu, mem).into_cycles(),
        34 => sys_stop_all(cpu, mem).into_cycles(),
        35 => sys_set_vol(cpu, mem).into_cycles(),
        36 => sys_master_vol(cpu, mem).into_cycles(),

        // ── Entrées ──────────────────────────────────────────────────────────────
        48 => sys_read_pad(cpu, mem).into_cycles(),
        49 => sys_read_key(cpu, mem).into_cycles(),
        50 => sys_key_down(cpu, mem).into_cycles(),
        51 => sys_read_mouse(cpu, mem).into_cycles(),

        // ── Système ──────────────────────────────────────────────────────────────
        64 => sys_wait_vblank(cpu, mem).into_cycles(),
        65 => sys_get_rand(cpu, mem).into_cycles(),
        66 => sys_rand16(cpu, mem).into_cycles(),
        67 => sys_frame_num(cpu, mem).into_cycles(),
        68 => sys_memcpy(cpu, mem).into_cycles(),
        69 => sys_memset(cpu, mem).into_cycles(),
        70 => sys_version(cpu, mem).into_cycles(),
        71 => sys_reset(cpu, mem).into_cycles(),

        // Index non défini : no-op déterministe, 4 cycles (§18).
        _ => 4,
    }
}

// ── Vidéo ────────────────────────────────────────────────────────────────────

fn sys_set_mode(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    mem.io.vpu_mode = cpu.r[0] & 0x01; // 0=texte, 1=gfx
    4
}

fn sys_clear(cpu: &mut Cpu, mem: &mut Memory) -> u64 {
    // Remplit toute la VRAM avec R0 (couleur/char).
    let fill = cpu.r[0];
    let count = if mem.io.vpu_mode == 0 {
        (TEXT_COLS * TEXT_ROWS) as u32
    } else {
        (GFX_W * GFX_H) as u32
    };
    for i in 0..count {
        mem.write(VRAM_BASE.wrapping_add(i as u16), fill);
    }
    // Remet le curseur en haut à gauche.
    mem.io.cursor_x = 0;
    mem.io.cursor_y = 0;
    8 + 2 * count as u64
}

fn sys_draw_pixel(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    // R0=couleur, R1=x, R2=y
    let addr = gfx_pixel(cpu.r[1] as u16, cpu.r[2] as u16);
    mem.write(addr, cpu.r[0]);
    4
}

fn sys_get_pixel(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    // R1=x, R2=y → R0
    let addr = gfx_pixel(cpu.r[1] as u16, cpu.r[2] as u16);
    cpu.r[0] = mem.read(addr);
    4
}

fn sys_draw_line(cpu: &mut Cpu, mem: &mut Memory) -> u64 {
    // $80=x0,$82=y0,$84=x1,$86=y1, R0=couleur. Bresenham déterministe.
    let x0 = pz16(mem, PARAM0) as i32;
    let y0 = pz16(mem, PARAM1) as i32;
    let x1 = pz16(mem, PARAM2) as i32;
    let y1 = pz16(mem, PARAM3) as i32;
    let color = cpu.r[0];

    let dx = (x1 - x0).abs();
    let dy = -(y1 - y0).abs();
    let sx = if x0 < x1 { 1 } else { -1 };
    let sy = if y0 < y1 { 1 } else { -1 };
    let mut err = dx + dy;
    let (mut x, mut y) = (x0, y0);
    let mut cells = 0u64;

    loop {
        let addr = gfx_pixel((x & 0xFFFF) as u16, (y & 0xFFFF) as u16);
        mem.write(addr, color);
        cells += 1;
        if x == x1 && y == y1 {
            break;
        }
        if cells > (GFX_W as u64) * (GFX_H as u64) {
            break; // garde-fou anti-boucle (déterminisme, jamais d'infini)
        }
        let e2 = 2 * err;
        if e2 >= dy {
            err += dy;
            x += sx;
        }
        if e2 <= dx {
            err += dx;
            y += sy;
        }
    }
    8 + 2 * cells
}

fn sys_draw_rect(cpu: &mut Cpu, mem: &mut Memory) -> u64 {
    // $80=x,$82=y,$84=w,$86=h, R0=couleur. Contour.
    fill_or_outline(cpu, mem, false)
}

fn sys_fill_rect(cpu: &mut Cpu, mem: &mut Memory) -> u64 {
    fill_or_outline(cpu, mem, true)
}

fn fill_or_outline(cpu: &mut Cpu, mem: &mut Memory, fill: bool) -> u64 {
    let x = pz16(mem, PARAM0);
    let y = pz16(mem, PARAM1);
    let w = pz16(mem, PARAM2);
    let h = pz16(mem, PARAM3);
    let color = cpu.r[0];
    let mut cells = 0u64;
    for dy in 0..h {
        for dx in 0..w {
            let edge = dx == 0 || dy == 0 || dx + 1 == w || dy + 1 == h;
            if fill || edge {
                let addr = gfx_pixel(x.wrapping_add(dx), y.wrapping_add(dy));
                mem.write(addr, color);
            }
            cells += 1;
        }
    }
    8 + 2 * cells
}

fn sys_blit(_cpu: &mut Cpu, mem: &mut Memory) -> u64 {
    // $80=src,$82=dst,$84=w,$86=h. Copie rectangulaire en VRAM.
    let src = pz16(mem, PARAM0);
    let dst = pz16(mem, PARAM1);
    let w = pz16(mem, PARAM2);
    let h = pz16(mem, PARAM3);
    let mut cells = 0u64;
    for row in 0..h {
        for col in 0..w {
            let s = src.wrapping_add(row.wrapping_mul(GFX_W)).wrapping_add(col);
            let d = dst.wrapping_add(row.wrapping_mul(GFX_W)).wrapping_add(col);
            let v = mem.read(s);
            mem.write(d, v);
            cells += 1;
        }
    }
    8 + 2 * cells
}

fn sys_draw_spr(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    // R0=tile, R1=x, R2=y. Pose un octet « tile » à la position (déterministe).
    let addr = gfx_pixel(cpu.r[1] as u16, cpu.r[2] as u16);
    mem.write(addr, cpu.r[0]);
    4
}

fn sys_flip(_cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    // Bascule de buffer : pose le bit VBlank consommé (modèle déterministe).
    mem.io.vpu_status &= !0x01;
    4
}

// ── Texte ──────────────────────────────────────────────────────────────────

fn put_char_at_cursor(mem: &mut Memory, ch: u8) {
    let col = mem.io.cursor_x as u16;
    let row = mem.io.cursor_y as u16;
    let addr = text_cell(col, row);
    mem.write(addr, ch);
    // Avance le curseur, retour à la ligne en fin de colonne.
    let mut nc = col + 1;
    let mut nr = row;
    if nc >= TEXT_COLS {
        nc = 0;
        nr = (row + 1) % TEXT_ROWS;
    }
    mem.io.cursor_x = nc as u8;
    mem.io.cursor_y = nr as u8;
}

fn sys_print_char(cpu: &mut Cpu, mem: &mut Memory) -> u64 {
    put_char_at_cursor(mem, cpu.r[0]);
    6
}

fn sys_print_str(_cpu: &mut Cpu, mem: &mut Memory) -> u64 {
    // $80/$81 = pointeur ; chaîne terminée par $00.
    let mut ptr = pz16(mem, PARAM0);
    let mut n = 0u64;
    loop {
        let ch = mem.read(ptr);
        if ch == 0 {
            break;
        }
        put_char_at_cursor(mem, ch);
        ptr = ptr.wrapping_add(1);
        n += 1;
        if n > 0x1_0000 {
            break; // garde-fou anti-chaîne non terminée
        }
    }
    6 + 2 * n
}

fn sys_print_num(cpu: &mut Cpu, mem: &mut Memory) -> u64 {
    // R0 en décimal (0–255).
    let v = cpu.r[0];
    let s = v.to_string();
    for b in s.bytes() {
        put_char_at_cursor(mem, b);
    }
    6 + 4 * s.len() as u64
}

fn sys_print_hex(cpu: &mut Cpu, mem: &mut Memory) -> u64 {
    // R0 en hexa deux chiffres.
    let v = cpu.r[0];
    let hex = b"0123456789ABCDEF";
    put_char_at_cursor(mem, hex[(v >> 4) as usize]);
    put_char_at_cursor(mem, hex[(v & 0x0F) as usize]);
    6 + 4 * 2
}

fn sys_set_cursor(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    // R0=col, R1=ligne
    mem.io.cursor_x = cpu.r[0];
    mem.io.cursor_y = cpu.r[1];
    4
}

fn sys_get_cursor(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    cpu.r[0] = mem.io.cursor_x;
    cpu.r[1] = mem.io.cursor_y;
    4
}

fn sys_set_color(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    // R0 : INK bits 7-4, PAPER bits 3-0. Stocké dans l'état io (couleur courante).
    mem.io.text_color = cpu.r[0];
    4
}

fn sys_scroll_up(_cpu: &mut Cpu, mem: &mut Memory) -> u64 {
    // Décale la grille texte d'une ligne vers le haut ; vide la dernière ligne.
    for row in 1..TEXT_ROWS {
        for col in 0..TEXT_COLS {
            let from = text_cell(col, row);
            let to = text_cell(col, row - 1);
            let v = mem.read(from);
            mem.write(to, v);
        }
    }
    for col in 0..TEXT_COLS {
        let addr = text_cell(col, TEXT_ROWS - 1);
        mem.write(addr, 0x20); // espace
    }
    6 + 2 * TEXT_COLS as u64
}

// ── Son (état SPU déterministe) ──────────────────────────────────────────────

fn spu_voice_base(voice: u8) -> u16 {
    // SPU $D100–$D1FF : blocs de 4 par voix (FREQ_LO, FREQ_HI, VOL, CTRL).
    0xD100u16.wrapping_add((voice as u16 % 4).wrapping_mul(4))
}

fn sys_play_note(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    // R0=voix, R1=note(21–108), $80=durée. Écrit l'état SPU.
    let base = spu_voice_base(cpu.r[0]);
    mem.write(base, cpu.r[1]); // FREQ_LO ← note (modèle simplifié)
    mem.write(base.wrapping_add(3), 0x01); // CTRL ← actif
    4
}

fn sys_stop_voice(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    let base = spu_voice_base(cpu.r[0]);
    mem.write(base.wrapping_add(3), 0x00); // CTRL ← inactif
    4
}

fn sys_stop_all(_cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    for v in 0..4 {
        let base = spu_voice_base(v);
        mem.write(base.wrapping_add(3), 0x00);
    }
    4
}

fn sys_set_vol(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    let base = spu_voice_base(cpu.r[0]);
    mem.write(base.wrapping_add(2), cpu.r[1]); // VOL
    4
}

fn sys_master_vol(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    mem.write(0xD1F0, cpu.r[0]); // MASTER
    4
}

// ── Entrées (lues depuis l'état injecté par le harnais) ──────────────────────

fn sys_read_pad(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    // R0=numéro → R0=boutons
    cpu.r[0] = if cpu.r[0] == 0 {
        mem.io.pad0
    } else {
        mem.io.pad1
    };
    4
}

fn sys_read_key(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    cpu.r[0] = mem.io.key_ascii; // 0 si rien
    4
}

fn sys_key_down(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    // R0=scancode → R0=$FF/$00. ⚠ n'arme PAS Z (§18).
    let scancode = cpu.r[0];
    cpu.r[0] = if mem.io.key_raw == scancode && scancode != 0 {
        0xFF
    } else {
        0x00
    };
    4
}

fn sys_read_mouse(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    cpu.r[0] = mem.io.mouse_x;
    cpu.r[1] = mem.io.mouse_y;
    cpu.r[2] = mem.io.mouse_btn;
    4
}

// ── Système ──────────────────────────────────────────────────────────────────

fn sys_wait_vblank(_cpu: &mut Cpu, _mem: &mut Memory) -> u8 {
    // Retour immédiat (§18, ⚠ ne bloque pas).
    4
}

fn sys_get_rand(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    cpu.r[0] = mem.io.rand8();
    4
}

fn sys_rand16(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    let v = mem.io.lfsr_step();
    cpu.r[0] = (v & 0xFF) as u8;
    cpu.r[1] = (v >> 8) as u8;
    6
}

fn sys_frame_num(cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    cpu.r[0] = (mem.io.frame & 0xFF) as u8;
    cpu.r[1] = (mem.io.frame >> 8) as u8;
    4
}

fn sys_memcpy(_cpu: &mut Cpu, mem: &mut Memory) -> u64 {
    // $80=src, $82=dst, $84=len
    let src = pz16(mem, PARAM0);
    let dst = pz16(mem, PARAM1);
    let len = pz16(mem, PARAM2);
    for i in 0..len {
        let v = mem.read(src.wrapping_add(i));
        mem.write(dst.wrapping_add(i), v);
    }
    6 + 2 * len as u64
}

fn sys_memset(cpu: &mut Cpu, mem: &mut Memory) -> u64 {
    // $80=dst, $82=len, R0=valeur
    let dst = pz16(mem, PARAM0);
    let len = pz16(mem, PARAM1);
    let val = cpu.r[0];
    for i in 0..len {
        mem.write(dst.wrapping_add(i), val);
    }
    6 + 2 * len as u64
}

fn sys_version(cpu: &mut Cpu, _mem: &mut Memory) -> u8 {
    cpu.r[0] = VERSION_MAJOR;
    cpu.r[1] = VERSION_MINOR;
    4
}

fn sys_reset(_cpu: &mut Cpu, mem: &mut Memory) -> u8 {
    mem.io.reset_requested = true; // traité au point de contrôle (cpu.step)
    8
}

// Permet à l'appelant de typer le retour uniformément en u64.
trait IntoCycles {
    fn into_cycles(self) -> u64;
}
impl IntoCycles for u8 {
    fn into_cycles(self) -> u64 {
        self as u64
    }
}
impl IntoCycles for u64 {
    fn into_cycles(self) -> u64 {
        self
    }
}