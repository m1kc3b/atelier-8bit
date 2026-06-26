// memory.rs — Bus mémoire 64 Kio du CK-1801.
//
// Référence normative : §16 (memory map), §13 (cas limites déterministes),
// §19 (adresse du registre debug $D309).
//
// Périmètre « cœur CPU » : la RAM 64 Kio est pleinement modélisée. Les
// périphériques (VPU/SPU/I-O, RNG/LFSR, timer) ne sont PAS câblés ici ; ils
// viendront dans un module `io` ultérieur. Les seules règles d'I-O appliquées
// à ce stade sont celles que §13 impose pour le déterminisme :
//   - écriture en zone clavier lecture seule ($D200–$D2FF) : ignorée (no-op) ;
//   - registre debug $D309 : lecture seule côté programme, écriture ignorée ;
//   - lecture d'une zone non mappée : $00 (garanti par la RAM zéro-initialisée).
//
// Invariant : aucune opération mémoire ne peut paniquer — toute adresse 16 bits
// est valide par construction (RAM de 0x10000 octets, indexation u16).

pub const MEM_SIZE: usize = 0x1_0000;

// Registre de drapeaux d'erreur debug ($D309, §13/§19), hors RAM pour rester
// strictement en lecture seule côté programme.
pub const DBG_FLAGS_ADDR: u16 = 0xD309;
pub const ILL_BIT: u8 = 0b0000_0001; // bit0 : instruction illégale rencontrée
pub const STKERR_BIT: u8 = 0b0000_0010; // bit1 : erreur de pile (wrap)

/// Zone clavier en lecture seule ($D200–$D2FF, §16/§19).
const RO_KBD_START: u16 = 0xD200;
const RO_KBD_END: u16 = 0xD2FF;

pub struct Memory {
    ram: Box<[u8; MEM_SIZE]>,
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
            dbg_flags: 0,
        }
    }

    /// Lecture côté programme. Zone non mappée → $00 (RAM zéro-init). $D309 lisible.
    #[inline]
    pub fn read(&self, addr: u16) -> u8 {
        if addr == DBG_FLAGS_ADDR {
            return self.dbg_flags;
        }
        self.ram[addr as usize]
    }

    /// Écriture côté programme, avec règles §13 (clavier RO ignoré, $D309 RO).
    #[inline]
    pub fn write(&mut self, addr: u16, val: u8) {
        if (RO_KBD_START..=RO_KBD_END).contains(&addr) {
            return; // §13 : écriture en zone clavier ignorée
        }
        if addr == DBG_FLAGS_ADDR {
            return; // §13 : $D309 lecture seule côté programme
        }
        self.ram[addr as usize] = val;
    }

    /// Lecture 16 bits little-endian (vecteurs §14, immédiats 16 bits).
    /// Le wrap d'adresse à $FFFF→$0000 est défini (jamais de panic).
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

    // ── Accès direct harnais (bypass des règles RO : chargement programme/état) ──
    /// Charge des octets en mémoire sans appliquer les règles RO (usage harnais).
    pub fn load(&mut self, addr: u16, bytes: &[u8]) {
        for (i, &b) in bytes.iter().enumerate() {
            let a = addr.wrapping_add(i as u16) as usize;
            self.ram[a] = b;
        }
    }
    /// Écriture brute (harnais/tests), ignore les règles RO.
    pub fn poke(&mut self, addr: u16, val: u8) {
        self.ram[addr as usize] = val;
    }
    /// Lecture brute (harnais/tests), renvoie l'octet RAM sous-jacent.
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
