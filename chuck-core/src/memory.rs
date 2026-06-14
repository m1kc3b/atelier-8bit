// chuck-core/src/memory.rs
//
// Mémoire 64 Ko du Chuck-8 Computer selon la spec v1.0.
//
// Memory Map :
//   $0000–$3FFF   RAM (16 Ko) — Zero Page, Stack, variables, programme
//   $4000–$7FFF   VRAM (16 Ko) — framebuffer, texte, sprites, tiles
//   $8000–$BFFF   Cartouche ROM (16 Ko, lecture seule)
//   $C000–$CFFF   Expansion (réservé)
//   $D000–$DFFF   I/O Registers (effets de bord via IoState)
//   $E000–$EFFF   RAM haute (point d'entrée $E000)
//   $F000–$FFFF   ROM système (lecture seule)

use crate::io::{IoState, IoAction};
use crate::rom::{build_rom, ROM_START, ROM_SIZE};

pub const RAM_SIZE      : usize = 65536;

// ── Zones mémoire ─────────────────────────────────────────────────────────────
pub const VRAM_START    : u16 = 0x4000;
pub const VRAM_END      : u16 = 0x7FFF;

pub const FRAMEBUF_A    : u16 = 0x4000; // 128×128/2 = 8192 octets
pub const FRAMEBUF_A_END: u16 = 0x5FFF;
pub const FRAMEBUF_B    : u16 = 0x6000;
pub const FRAMEBUF_B_END: u16 = 0x7FFF;

pub const VRAM_TEXT     : u16 = 0x4800; // mode texte 32×32
pub const VRAM_TEXT_END : u16 = 0x4BFF;
pub const VRAM_ATTR     : u16 = 0x4C00; // attributs couleur
pub const VRAM_ATTR_END : u16 = 0x4FFF;
pub const VRAM_SPRITES  : u16 = 0x5000; // 8 sprites × 256 octets
pub const VRAM_SPR_END  : u16 = 0x5FFF;
pub const VRAM_TILES    : u16 = 0x6000; // 256 tuiles 8×8
pub const VRAM_TILES_END: u16 = 0x6FFF;

pub const CART_START    : u16 = 0x8000;
pub const CART_END      : u16 = 0xBFFF;

pub const IO_START      : u16 = 0xD000;
pub const IO_END        : u16 = 0xDFFF;

pub const HIGH_RAM_START: u16 = 0xE000;
pub const ENTRY_POINT   : u16 = 0xE000;

// ── Largeur et hauteur de l'écran ─────────────────────────────────────────────
pub const SCREEN_W      : u16 = 128;
pub const SCREEN_H      : u16 = 128;
pub const TEXT_COLS     : u16 = 32;
pub const TEXT_ROWS     : u16 = 32;

pub struct Memory {
    /// RAM principale 64 Ko (inclut VRAM, ROM mappée, tout)
    pub ram:  [u8; RAM_SIZE],
    /// ROM système 4 Ko ($F000–$FFFF) — lecture seule
    rom:      [u8; ROM_SIZE],
    /// Cartouche optionnelle 16 Ko ($8000–$BFFF) — lecture seule
    cart:     Option<Box<[u8; 0x4000]>>,
    /// État des périphériques I/O
    pub io:   IoState,
    /// Dirty tracking VRAM (min/max adresses modifiées)
    dirty_min: u16,
    dirty_max: u16,
}

impl Default for Memory {
    fn default() -> Self { Self::new() }
}

impl Memory {
    pub fn new() -> Self {
        let mut mem = Self {
            ram:       [0u8; RAM_SIZE],
            rom:       build_rom(),
            cart:      None,
            io:        IoState::new(),
            dirty_min: 0xFFFF,
            dirty_max: 0x0000,
        };
        // Copie la ROM dans la zone $F000–$FFFF de la RAM pour le peek()
        // (le CPU lit toujours depuis self.ram en mode peek)
        mem.ram[0xF000..=0xFFFF].copy_from_slice(&mem.rom);
        mem
    }

    /// Charge une cartouche (max 16 Ko)
    pub fn load_cart(&mut self, data: &[u8]) {
        let mut cart = Box::new([0u8; 0x4000]);
        let len = data.len().min(0x4000);
        cart[..len].copy_from_slice(&data[..len]);
        // Mappe la cartouche dans la RAM pour peek() et disassemble
        self.ram[0x8000..0x8000 + len].copy_from_slice(&data[..len]);
        self.cart = Some(cart);
    }

    /// Réinitialise la RAM (garde la ROM et la cartouche)
    pub fn reset(&mut self) {
        self.ram[0x0000..0xE000].fill(0);  // RAM basse + VRAM
        self.ram[0xE000..0xF000].fill(0);  // RAM haute (code programme)
        // Restaure la ROM dans la RAM
        self.ram[0xF000..=0xFFFF].copy_from_slice(&self.rom);
        // Restaure la cartouche si présente
        if let Some(ref cart) = self.cart {
            self.ram[0x8000..0xC000].copy_from_slice(cart.as_ref());
        }
        self.io        = IoState::new();
        self.dirty_min = 0xFFFF;
        self.dirty_max = 0x0000;
    }

    // ── Lecture CPU (avec effets de bord) ─────────────────────────────────────

    #[inline]
    pub fn read(&mut self, addr: u16) -> u8 {
        match addr {
            // I/O registers — effets de bord
            IO_START..=IO_END => self.io.read_register(addr),

            // ROM système — lecture directe depuis le buffer ROM
            0xF000..=0xFFFF => self.rom[(addr - ROM_START) as usize],

            // Cartouche
            CART_START..=CART_END => {
                if let Some(ref cart) = self.cart {
                    cart[(addr - CART_START) as usize]
                } else {
                    0
                }
            }

            // Tout le reste (RAM, VRAM, RAM haute) — lecture directe
            _ => self.ram[addr as usize],
        }
    }

    /// Lecture sans effet de bord (debug, disassemble, tests)
    #[inline]
    pub fn peek(&self, addr: u16) -> u8 {
        // Tout est déjà dans self.ram (ROM copiée au boot, cart aussi)
        self.ram[addr as usize]
    }

    // ── Écriture CPU (avec effets de bord) ────────────────────────────────────

    #[inline]
    pub fn write(&mut self, addr: u16, val: u8) {
        match addr {
            // ROM système — ignoré silencieusement
            0xF000..=0xFFFF => {}

            // Cartouche — ignoré silencieusement
            CART_START..=CART_END => {}

            // I/O registers
            IO_START..=IO_END => {
                if let Some(action) = self.io.write_register(addr, val) {
                    self.handle_io_action(action);
                }
            }

            // VRAM — dirty tracking
            VRAM_START..=VRAM_END => {
                self.ram[addr as usize] = val;
                self.mark_dirty(addr);
            }

            // RAM normale
            _ => {
                self.ram[addr as usize] = val;
            }
        }
    }

    /// Écriture directe sans effets de bord (assembleur, init ROM)
    #[inline]
    pub fn write_raw(&mut self, addr: u16, val: u8) {
        self.ram[addr as usize] = val;
    }

    /// Écriture d'un bloc (assembleur)
    pub fn write_slice(&mut self, start: u16, bytes: &[u8]) {
        let end = (start as usize) + bytes.len();
        assert!(end <= RAM_SIZE, "write_slice dépasse les 64 Ko");
        self.ram[start as usize..end].copy_from_slice(bytes);
    }

    // ── Stack ─────────────────────────────────────────────────────────────────

    #[inline]
    pub fn stack_read(&self, sp: u8) -> u8 {
        self.ram[0x0100 | sp as usize]
    }

    #[inline]
    pub fn stack_write(&mut self, sp: u8, val: u8) {
        self.ram[0x0100 | sp as usize] = val;
    }

    // ── Lecture 16-bit ────────────────────────────────────────────────────────

    #[inline]
    pub fn read16(&mut self, addr: u16) -> u16 {
        let lo = self.read(addr) as u16;
        let hi = self.read(addr.wrapping_add(1)) as u16;
        (hi << 8) | lo
    }

    #[inline]
    pub fn peek16(&self, addr: u16) -> u16 {
        let lo = self.peek(addr) as u16;
        let hi = self.peek(addr.wrapping_add(1)) as u16;
        (hi << 8) | lo
    }

    /// Bug JMP ($xxFF) — hi vient de $xx00 au lieu de $xx01
    #[inline]
    pub fn read16_page_bug(&mut self, addr: u16) -> u16 {
        let lo      = self.read(addr) as u16;
        let hi_addr = (addr & 0xFF00) | ((addr.wrapping_add(1)) & 0x00FF);
        let hi      = self.read(hi_addr) as u16;
        (hi << 8) | lo
    }

    // ── VRAM helpers ──────────────────────────────────────────────────────────

    /// Calcule l'adresse dans le framebuffer A pour le pixel (x, y)
    /// Format nibble-packed : 2 pixels par octet
    pub fn pixel_addr(x: u8, y: u8) -> u16 {
        FRAMEBUF_A + (y as u16) * 64 + (x as u16) / 2
    }

    /// Lit la couleur du pixel (x, y) dans le framebuffer A
    pub fn get_pixel(&self, x: u8, y: u8) -> u8 {
        let addr  = Self::pixel_addr(x, y);
        let byte  = self.peek(addr);
        if x & 1 == 0 {
            (byte >> 4) & 0x0F  // pixel pair → nibble haut
        } else {
            byte & 0x0F         // pixel impair → nibble bas
        }
    }

    /// Écrit la couleur du pixel (x, y) dans le framebuffer A
    pub fn set_pixel(&mut self, x: u8, y: u8, color: u8) {
        let addr  = Self::pixel_addr(x, y);
        let byte  = self.ram[addr as usize];
        let color = color & 0x0F;
        let new_byte = if x & 1 == 0 {
            (byte & 0x0F) | (color << 4)
        } else {
            (byte & 0xF0) | color
        };
        self.ram[addr as usize] = new_byte;
        self.mark_dirty(addr);
    }

    /// Efface le framebuffer A avec une couleur
    pub fn clear_gfx(&mut self, color: u8) {
        let color  = color & 0x0F;
        let packed = (color << 4) | color;
        for addr in FRAMEBUF_A..=FRAMEBUF_A_END {
            self.ram[addr as usize] = packed;
        }
        self.mark_dirty(FRAMEBUF_A);
        self.mark_dirty(FRAMEBUF_A_END);
    }

    /// Efface la mémoire texte avec un caractère
    pub fn clear_text(&mut self, ch: u8, ink: u8, paper: u8) {
        for addr in VRAM_TEXT..=VRAM_TEXT_END {
            self.ram[addr as usize] = ch;
        }
        let attr = (paper << 4) | (ink & 0x0F);
        for addr in VRAM_ATTR..=VRAM_ATTR_END {
            self.ram[addr as usize] = attr;
        }
        self.mark_dirty(VRAM_TEXT);
        self.mark_dirty(VRAM_ATTR_END);
    }

    /// Affiche un caractère à (col, row) en mode texte
    pub fn put_char(&mut self, ch: u8, col: u8, row: u8, ink: u8, paper: u8) {
        if col >= 32 || row >= 32 { return; }
        let text_addr = VRAM_TEXT + (row as u16) * 32 + (col as u16);
        let attr_addr = VRAM_ATTR + (row as u16) * 32 + (col as u16);
        self.ram[text_addr as usize] = ch;
        self.ram[attr_addr as usize] = (paper << 4) | (ink & 0x0F);
        self.mark_dirty(text_addr);
    }

    // ── Dirty tracking ────────────────────────────────────────────────────────

    #[inline]
    fn mark_dirty(&mut self, addr: u16) {
        if addr < self.dirty_min { self.dirty_min = addr; }
        if addr > self.dirty_max { self.dirty_max = addr; }
    }

    /// Retourne la plage VRAM modifiée et la réinitialise
    pub fn take_dirty(&mut self) -> Option<(u16, u16)> {
        if self.dirty_min > self.dirty_max { return None; }
        let range = (self.dirty_min, self.dirty_max);
        self.dirty_min = 0xFFFF;
        self.dirty_max = 0x0000;
        Some(range)
    }

    // ── Effets de bord I/O ────────────────────────────────────────────────────

    fn handle_io_action(&mut self, action: IoAction) {
        match action {
            IoAction::PrintChar(ch) => {
                let col  = self.io.vpu.cursor_x;
                let row  = self.io.vpu.cursor_y;
                let ink  = self.io.vpu.ink;
                let paper= self.io.vpu.paper;

                if ch == b'\n' || ch == 0x0A {
                    // Newline : retour chariot + avance ligne
                    self.io.vpu.cursor_x = 0;
                    let next_row = row + 1;
                    if next_row >= 32 {
                        self.scroll_text_up();
                        self.io.vpu.cursor_y = 31;
                    } else {
                        self.io.vpu.cursor_y = next_row;
                    }
                } else if ch == b'\r' || ch == 0x0D {
                    self.io.vpu.cursor_x = 0;
                } else if ch == 0x08 {
                    // Backspace
                    if col > 0 {
                        self.io.vpu.cursor_x -= 1;
                        self.put_char(0x20, self.io.vpu.cursor_x, row, ink, paper);
                    }
                } else {
                    self.put_char(ch, col, row, ink, paper);
                    // Avancer le curseur
                    let next_col = col + 1;
                    if next_col >= 32 {
                        self.io.vpu.cursor_x = 0;
                        let next_row = row + 1;
                        if next_row >= 32 {
                            self.scroll_text_up();
                            self.io.vpu.cursor_y = 31;
                        } else {
                            self.io.vpu.cursor_y = next_row;
                        }
                    } else {
                        self.io.vpu.cursor_x = next_col;
                    }
                }
            }
        }
    }

    /// Fait défiler le texte d'une ligne vers le haut
    fn scroll_text_up(&mut self) {
        // Copie lignes 1-31 → lignes 0-30
        for row in 0u16..31 {
            for col in 0u16..32 {
                let src_t = VRAM_TEXT + (row + 1) * 32 + col;
                let dst_t = VRAM_TEXT +  row      * 32 + col;
                let src_a = VRAM_ATTR + (row + 1) * 32 + col;
                let dst_a = VRAM_ATTR +  row      * 32 + col;
                self.ram[dst_t as usize] = self.ram[src_t as usize];
                self.ram[dst_a as usize] = self.ram[src_a as usize];
            }
        }
        // Efface la dernière ligne
        let ink   = self.io.vpu.ink;
        let paper = self.io.vpu.paper;
        for col in 0u16..32 {
            let t = VRAM_TEXT + 31 * 32 + col;
            let a = VRAM_ATTR + 31 * 32 + col;
            self.ram[t as usize] = 0x20;
            self.ram[a as usize] = (paper << 4) | ink;
        }
        self.mark_dirty(VRAM_TEXT);
        self.mark_dirty(VRAM_ATTR_END);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rom_is_readonly() {
        let mut m = Memory::new();
        let before = m.peek(0xF000);
        m.write(0xF000, 0xAA);
        assert_eq!(m.peek(0xF000), before, "ROM ne doit pas être modifiable");
    }

    #[test]
    fn reset_vector_readable() {
        let m = Memory::new();
        let vec = m.peek16(0xFFFC);
        assert_eq!(vec, 0xE000, "Vecteur RESET doit pointer vers $E000");
    }

    #[test]
    fn io_registers_read_write() {
        let mut m = Memory::new();
        // Écrire VPU_CTRL
        m.write(0xD000, 0x81); // enable + mode gfx
        assert_eq!(m.io.vpu.ctrl, 0x81);
        assert_eq!(m.read(0xD000), 0x81);
    }

    #[test]
    fn ram_read_write() {
        let mut m = Memory::new();
        m.write(0x0010, 0x42);
        assert_eq!(m.read(0x0010), 0x42);
    }

    #[test]
    fn high_ram_read_write() {
        let mut m = Memory::new();
        m.write(0xE000, 0xA9); // LDA
        assert_eq!(m.read(0xE000), 0xA9);
    }

    #[test]
    fn vram_dirty_tracking() {
        let mut m = Memory::new();
        assert!(m.take_dirty().is_none());
        m.write(0x4100, 0x07);
        let dirty = m.take_dirty();
        assert!(dirty.is_some());
        let (lo, hi) = dirty.unwrap();
        assert_eq!(lo, 0x4100);
        assert_eq!(hi, 0x4100);
    }

    #[test]
    fn set_get_pixel() {
        let mut m = Memory::new();
        m.set_pixel(10, 5, 7); // couleur jaune, pixel pair
        assert_eq!(m.get_pixel(10, 5), 7);
    }

    #[test]
    fn set_pixel_odd() {
        let mut m = Memory::new();
        m.set_pixel(11, 5, 3); // pixel impair
        assert_eq!(m.get_pixel(11, 5), 3);
        // Le pixel pair adjacent ne doit pas être affecté
        m.set_pixel(10, 5, 7);
        assert_eq!(m.get_pixel(10, 5), 7);
        assert_eq!(m.get_pixel(11, 5), 3);
    }

    #[test]
    fn clear_gfx() {
        let mut m = Memory::new();
        m.clear_gfx(5); // vert
        let packed = (5 << 4) | 5;
        assert_eq!(m.peek(0x4000), packed);
        assert_eq!(m.peek(0x5FFF), packed);
    }

    #[test]
    fn put_char_mode_text() {
        let mut m = Memory::new();
        m.put_char(b'A', 3, 2, 1, 0);
        let text_addr = VRAM_TEXT + 2 * 32 + 3;
        let attr_addr = VRAM_ATTR + 2 * 32 + 3;
        assert_eq!(m.peek(text_addr), b'A');
        assert_eq!(m.peek(attr_addr), 0x01); // paper=0<<4 | ink=1
    }

    #[test]
    fn vpu_char_out_advances_cursor() {
        let mut m = Memory::new();
        m.io.vpu.cursor_x = 0;
        m.io.vpu.cursor_y = 0;
        m.write(0xD00F, b'H'); // VPU_CHAR_OUT
        assert_eq!(m.io.vpu.cursor_x, 1);
        assert_eq!(m.peek(VRAM_TEXT), b'H');
    }

    #[test]
    fn newline_resets_cursor_x() {
        let mut m = Memory::new();
        m.io.vpu.cursor_x = 10;
        m.io.vpu.cursor_y = 5;
        m.write(0xD00F, b'\n');
        assert_eq!(m.io.vpu.cursor_x, 0);
        assert_eq!(m.io.vpu.cursor_y, 6);
    }

    #[test]
    fn scroll_on_last_row() {
        let mut m = Memory::new();
        m.io.vpu.cursor_x = 31;
        m.io.vpu.cursor_y = 31;
        // Écrire un char en dernière position
        m.put_char(b'X', 0, 0, 1, 0);
        m.write(0xD00F, b'Z'); // force avance à la fin de la ligne
        // Le curseur y reste à 31 (scroll a eu lieu)
        assert_eq!(m.io.vpu.cursor_y, 31);
    }

    #[test]
    fn pixel_addr_correct() {
        // px=0, py=0 → $4000
        assert_eq!(Memory::pixel_addr(0, 0), 0x4000);
        // px=1, py=0 → $4000 (même octet)
        assert_eq!(Memory::pixel_addr(1, 0), 0x4000);
        // px=2, py=0 → $4001
        assert_eq!(Memory::pixel_addr(2, 0), 0x4001);
        // px=0, py=1 → $4000 + 64 = $4040
        assert_eq!(Memory::pixel_addr(0, 1), 0x4040);
        // px=127, py=127 → $4000 + 127*64 + 63 = $4000 + 8128 + 63 = $5FFF
        assert_eq!(Memory::pixel_addr(127, 127), 0x5FFF);
    }

    #[test]
    fn reset_clears_ram_keeps_rom() {
        let mut m = Memory::new();
        m.write_raw(0x0010, 0xFF);
        m.reset();
        assert_eq!(m.peek(0x0010), 0x00, "RAM doit être effacée");
        assert_eq!(m.peek16(0xFFFC), 0xE000, "ROM doit être préservée");
    }

    #[test]
    fn rand_from_io() {
        let mut m = Memory::new();
        let a = m.read(0xD306);
        let b = m.read(0xD306);
        let c = m.read(0xD306);
        assert!(a != b || b != c, "Le PRNG doit varier");
    }

    #[test]
    fn page_bug_jmp() {
        let mut m = Memory::new();
        m.write_raw(0x01FF, 0x40);
        m.write_raw(0x0200, 0x99); // ne doit pas être lu
        m.write_raw(0x0100, 0x80); // hi (bug)
        assert_eq!(m.read16_page_bug(0x01FF), 0x8040);
    }
}
