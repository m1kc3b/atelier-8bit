// chuck-core/src/memory.rs
//
// RAM 64 Ko du 6502.
// Adresses spéciales :
//   $00FE — générateur pseudo-aléatoire (LFSR 16-bit)
//   $00FF — clavier (dernier octet écrit par le JS)
//   $0200–$05FF — framebuffer (32×32 pixels, palette 4 bits)

pub const RAM_SIZE:       usize = 65536;
pub const DISPLAY_START:  u16   = 0x0200;
pub const DISPLAY_END:    u16   = 0x05FF;
pub const RANDOM_ADDR:    u16   = 0x00FE;
pub const KEYBOARD_ADDR:  u16   = 0x00FF;

pub struct Memory {
    pub data:    [u8; RAM_SIZE],
    /// LFSR pour la génération pseudo-aléatoire à $FE
    lfsr:        u16,
    /// Callback appelé quand un pixel de l'écran change.
    /// `index` = offset dans le framebuffer (0..1023), `value` = couleur (0..15)
    dirty_min:   u16,
    dirty_max:   u16,
}

impl Default for Memory {
    fn default() -> Self { Self::new() }
}

impl Memory {
    pub fn new() -> Self {
        Self {
            data:      [0u8; RAM_SIZE],
            lfsr:      0xACE1,
            dirty_min: 0xFFFF,
            dirty_max: 0x0000,
        }
    }

    /// Remet la RAM à zéro (garde le LFSR)
    pub fn reset(&mut self) {
        self.data.fill(0);
        self.dirty_min = 0xFFFF;
        self.dirty_max = 0x0000;
    }

    /// Lecture depuis le CPU
    #[inline]
    pub fn read(&mut self, addr: u16) -> u8 {
        if addr == RANDOM_ADDR {
            return self.next_rand();
        }
        self.data[addr as usize]
    }

    /// Lecture depuis le CPU sans effet de bord (debug/disassemble)
    #[inline]
    pub fn peek(&self, addr: u16) -> u8 {
        self.data[addr as usize]
    }

    /// Écriture depuis le CPU
    #[inline]
    pub fn write(&mut self, addr: u16, val: u8) {
        self.data[addr as usize] = val;
        if addr >= DISPLAY_START && addr <= DISPLAY_END {
            if addr < self.dirty_min { self.dirty_min = addr; }
            if addr > self.dirty_max { self.dirty_max = addr; }
        }
    }

    /// Écriture directe (assembleur, pas de dirty tracking)
    #[inline]
    pub fn write_raw(&mut self, addr: u16, val: u8) {
        self.data[addr as usize] = val;
    }

    /// Écriture d'un bloc (assembleur)
    pub fn write_slice(&mut self, start: u16, bytes: &[u8]) {
        let end = (start as usize) + bytes.len();
        assert!(end <= RAM_SIZE, "write_slice dépasse les 64 Ko");
        self.data[start as usize..end].copy_from_slice(bytes);
    }

    /// Lecture stack ($0100–$01FF)
    #[inline]
    pub fn stack_read(&self, sp: u8) -> u8 {
        self.data[0x0100 | sp as usize]
    }

    #[inline]
    pub fn stack_write(&mut self, sp: u8, val: u8) {
        self.data[0x0100 | sp as usize] = val;
    }

    /// Lecture 16-bit little-endian
    #[inline]
    pub fn read16(&mut self, addr: u16) -> u16 {
        let lo = self.read(addr) as u16;
        let hi = self.read(addr.wrapping_add(1)) as u16;
        (hi << 8) | lo
    }

    /// Lecture 16-bit sans effet de bord (debug)
    #[inline]
    pub fn peek16(&self, addr: u16) -> u16 {
        let lo = self.peek(addr) as u16;
        let hi = self.peek(addr.wrapping_add(1)) as u16;
        (hi << 8) | lo
    }

    /// Bug original du 6502 : JMP ($xxFF) lit lo depuis $xxFF, hi depuis $xx00
    #[inline]
    pub fn read16_page_bug(&mut self, addr: u16) -> u16 {
        let lo = self.read(addr) as u16;
        // Le bug : le carry ne se propage pas vers l'octet haut
        let hi_addr = (addr & 0xFF00) | ((addr.wrapping_add(1)) & 0x00FF);
        let hi = self.read(hi_addr) as u16;
        (hi << 8) | lo
    }

    /// Indique si des pixels ont changé depuis le dernier appel
    pub fn take_dirty(&mut self) -> Option<(u16, u16)> {
        if self.dirty_min > self.dirty_max {
            return None;
        }
        let range = (self.dirty_min, self.dirty_max);
        self.dirty_min = 0xFFFF;
        self.dirty_max = 0x0000;
        Some(range)
    }

    // ── Générateur pseudo-aléatoire (LFSR Galois 16-bit) ──────────
    fn next_rand(&mut self) -> u8 {
        // Polynôme : x^16 + x^14 + x^13 + x^11 + 1
        let bit = self.lfsr & 1;
        self.lfsr >>= 1;
        if bit != 0 {
            self.lfsr ^= 0xB400;
        }
        (self.lfsr & 0xFF) as u8
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn random_changes_each_read() {
        let mut m = Memory::new();
        let a = m.read(RANDOM_ADDR);
        let b = m.read(RANDOM_ADDR);
        let c = m.read(RANDOM_ADDR);
        // Pas toujours vrai mais statistiquement fiable
        assert!(a != b || b != c, "Le LFSR devrait produire des valeurs différentes");
    }

    #[test]
    fn read_write_roundtrip() {
        let mut m = Memory::new();
        m.write(0x0010, 0x42);
        assert_eq!(m.read(0x0010), 0x42);
    }

    #[test]
    fn read16_little_endian() {
        let mut m = Memory::new();
        m.write_raw(0x0020, 0x34);
        m.write_raw(0x0021, 0x12);
        assert_eq!(m.peek16(0x0020), 0x1234);
    }

    #[test]
    fn page_bug() {
        let mut m = Memory::new();
        // Simule JMP ($01FF)
        m.write_raw(0x01FF, 0x40); // lo
        m.write_raw(0x0200, 0x99); // ne doit PAS être lu
        m.write_raw(0x0100, 0x80); // hi (bug : wrap vers $0100)
        assert_eq!(m.read16_page_bug(0x01FF), 0x8040);
    }

    #[test]
    fn dirty_tracking() {
        let mut m = Memory::new();
        assert!(m.take_dirty().is_none());
        m.write(0x0300, 1);
        m.write(0x0400, 2);
        let dirty = m.take_dirty();
        assert_eq!(dirty, Some((0x0300, 0x0400)));
        assert!(m.take_dirty().is_none());
    }

    #[test]
    fn reset_clears_ram() {
        let mut m = Memory::new();
        m.write_raw(0x1234, 0xFF);
        m.reset();
        assert_eq!(m.peek(0x1234), 0x00);
    }
}
