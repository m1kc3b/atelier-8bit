// memory.rs — Bus mémoire 64 Kio du CK-1801.
//
// Référence normative : §16 (memory map), §13 (cas limites déterministes),
// §19 (registres device, $D309 debug).
//
// Architecture : la RAM 64 Kio couvre tout l'espace d'adressage ; les accès aux
// plages de périphériques (§19) sont délégués à `Io`. Le registre debug $D309
// est maintenu hors RAM (lecture seule côté programme).
//
// Invariant : aucune opération mémoire ne peut paniquer (adresses u16 bornées).

use crate::io::Io;

pub const MEM_SIZE: usize = 0x1_0000;

// Registre de drapeaux d'erreur debug ($D309, §13/§19).
pub const DBG_FLAGS_ADDR: u16 = 0xD309;
pub const ILL_BIT: u8 = 0b0000_0001; // bit0 : instruction illégale rencontrée
pub const STKERR_BIT: u8 = 0b0000_0010; // bit1 : erreur de pile (wrap)

pub struct Memory {
    ram: Box<[u8; MEM_SIZE]>,
    /// Périphériques mémoire-mappés (VPU, entrées, timer, frames, RNG).
    pub io: Io,
    /// Drapeaux d'erreur debug ($D309) ; lecture seule côté programme.
    dbg_flags: u8,
}

impl Default for Memory {
    fn default() -> Self {
        Self::new()
    }
}

impl Memory {
    pub fn new() -> Self {
        Memory {
            ram: Box::new([0u8; MEM_SIZE]),
            io: Io::new(),
            dbg_flags: 0,
        }
    }

    /// Lecture côté programme. Ordre : $D309 debug, plages device, sinon RAM.
    /// Zone non mappée → $00 (garanti par la RAM zéro-init et les défauts device).
    #[inline]
    pub fn read(&self, addr: u16) -> u8 {
        if addr == DBG_FLAGS_ADDR {
            return self.dbg_flags;
        }
        if Io::handles(addr) {
            return self.io.read(addr);
        }
        self.ram[addr as usize]
    }

    /// Écriture côté programme, avec règles §13 ($D309 RO, entrées RO via Io).
    #[inline]
    pub fn write(&mut self, addr: u16, val: u8) {
        if addr == DBG_FLAGS_ADDR {
            return; // §13 : $D309 lecture seule côté programme
        }
        if Io::handles(addr) {
            self.io.write(addr, val); // Io applique la RO des entrées (§13)
            return;
        }
        self.ram[addr as usize] = val;
    }

    /// Lecture 16 bits little-endian (vecteurs §14, immédiats 16 bits).
    /// Le wrap d'adresse $FFFF→$0000 est défini (jamais de panic).
    #[inline]
    pub fn read16(&self, addr: u16) -> u16 {
        let lo = self.read(addr) as u16;
        let hi = self.read(addr.wrapping_add(1)) as u16;
        (hi << 8) | lo
    }

    /// Écriture 16 bits little-endian.
    #[inline]
    pub fn write16(&mut self, addr: u16, val: u16) {
        self.write(addr, (val & 0xFF) as u8);
        self.write(addr.wrapping_add(1), (val >> 8) as u8);
    }

    // ── Accès direct harnais (bypass des règles RO et du routage device) ──────
    /// Charge des octets en RAM brute sans appliquer les règles RO (usage harnais).
    /// N.B. : écrit la RAM sous-jacente, pas les registres device.
    pub fn load(&mut self, addr: u16, bytes: &[u8]) {
        for (i, &b) in bytes.iter().enumerate() {
            let a = addr.wrapping_add(i as u16) as usize;
            self.ram[a] = b;
        }
    }
    /// Écriture RAM brute (harnais/tests), ignore RO et routage device.
    pub fn poke(&mut self, addr: u16, val: u8) {
        self.ram[addr as usize] = val;
    }
    /// Lecture RAM brute (harnais/tests), renvoie l'octet RAM sous-jacent.
    pub fn peek(&self, addr: u16) -> u8 {
        self.ram[addr as usize]
    }

    // ── Drapeaux debug ($D309) ───────────────────────────────────────────────
    #[inline]
    pub fn raise_ill(&mut self) {
        self.dbg_flags |= ILL_BIT;
    }
    #[inline]
    pub fn raise_stkerr(&mut self) {
        self.dbg_flags |= STKERR_BIT;
    }
    #[inline]
    pub fn dbg_flags(&self) -> u8 {
        self.dbg_flags
    }
    #[inline]
    pub fn clear_dbg(&mut self) {
        self.dbg_flags = 0;
    }
}
