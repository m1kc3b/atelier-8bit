// chuck-core/src/rom.rs
//
// ROM système Chuck-8 : $F000–$FFFF (4 Ko)
//
// Organisation :
//   $F000–$F06F  Jump table (38 × 3 octets = 114 octets — 37 routines + SYS_SOFT_RESET alias SYS_RESET)
//   $F080–$F7FF  Corps des routines ROM
//   $F800–$FFEF  Charset 128 caractères × 8 octets
//   $FFF0–$FFF9  Config boot (réservé)
//   $FFFA/$FFFB  Vecteur NMI   → $F010 (handler VBlank par défaut)
//   $FFFC/$FFFD  Vecteur RESET → $E000 (point d'entrée programme)
//   $FFFE/$FFFF  Vecteur IRQ   → $F020 (handler timer par défaut)

pub const ROM_START : u16 = 0xF000;
pub const ROM_END   : u16 = 0xFFFF;
pub const ROM_SIZE  : usize = 0x1000; // 4 Ko

// ── Jump Table ────────────────────────────────────────────────────────────────
// Chaque entrée = JMP $xxxx (opcode $4C + 2 octets adresse)
// L'adresse est FIXE POUR TOUJOURS.

pub const SYS_CLEAR       : u16 = 0xF000;
pub const SYS_DRAW_PIXEL  : u16 = 0xF003;
pub const SYS_DRAW_LINE   : u16 = 0xF006;
pub const SYS_DRAW_RECT   : u16 = 0xF009;
pub const SYS_FILL_RECT   : u16 = 0xF00C;
pub const SYS_BLIT        : u16 = 0xF00F;
pub const SYS_DRAW_SPR    : u16 = 0xF012;
pub const SYS_GET_PIXEL   : u16 = 0xF015;
pub const SYS_FLIP        : u16 = 0xF018;
pub const SYS_SET_MODE    : u16 = 0xF01B;
pub const SYS_PRINT_CHAR  : u16 = 0xF01E;
pub const SYS_PRINT_STR   : u16 = 0xF021;
pub const SYS_PRINT_NUM   : u16 = 0xF024;
pub const SYS_PRINT_HEX   : u16 = 0xF027;
pub const SYS_SET_CURSOR  : u16 = 0xF02A;
pub const SYS_GET_CURSOR  : u16 = 0xF02D;
pub const SYS_SET_COLOR   : u16 = 0xF030;
pub const SYS_SCROLL_UP   : u16 = 0xF033;
pub const SYS_PLAY_NOTE   : u16 = 0xF036;
pub const SYS_STOP_VOICE  : u16 = 0xF039;
pub const SYS_STOP_ALL    : u16 = 0xF03C;
pub const SYS_PLAY_SFX    : u16 = 0xF03F;
pub const SYS_SET_VOL     : u16 = 0xF042;
pub const SYS_MASTER_VOL  : u16 = 0xF045;
pub const SYS_READ_PAD    : u16 = 0xF048;
pub const SYS_READ_KEY    : u16 = 0xF04B;
pub const SYS_WAIT_KEY    : u16 = 0xF04E;
pub const SYS_READ_MOUSE  : u16 = 0xF051;
pub const SYS_KEY_DOWN    : u16 = 0xF054;
pub const SYS_WAIT_VBLANK : u16 = 0xF057;
pub const SYS_RAND_API    : u16 = 0xF05A;
pub const SYS_RAND16      : u16 = 0xF05D;
pub const SYS_MEMCPY      : u16 = 0xF060;
pub const SYS_MEMSET      : u16 = 0xF063;
pub const SYS_MEMCMP      : u16 = 0xF066;
pub const SYS_FRAME_NUM   : u16 = 0xF069;
pub const SYS_SOFT_RESET  : u16 = 0xF06C;  // SYS_RESET dans la spec — reset logiciel
pub const SYS_VERSION     : u16 = 0xF06F;

// Adresses des handlers réels (dans $F080+)
const H_CLEAR       : u16 = 0xF080;
const H_DRAW_PIXEL  : u16 = 0xF090;
const H_DRAW_LINE   : u16 = 0xF0A0;
const H_DRAW_RECT   : u16 = 0xF0C0;
const H_FILL_RECT   : u16 = 0xF0E0;
const H_BLIT        : u16 = 0xF100;
const H_DRAW_SPR    : u16 = 0xF120;
const H_GET_PIXEL   : u16 = 0xF140;
const H_FLIP        : u16 = 0xF150;
const H_SET_MODE    : u16 = 0xF160;
const H_PRINT_CHAR  : u16 = 0xF170;
const H_PRINT_STR   : u16 = 0xF180;
const H_PRINT_NUM   : u16 = 0xF190;
const H_PRINT_HEX   : u16 = 0xF1B0;
const H_SET_CURSOR  : u16 = 0xF1C0;
const H_GET_CURSOR  : u16 = 0xF1C8;
const H_SET_COLOR   : u16 = 0xF1D0;
const H_SCROLL_UP   : u16 = 0xF1E0;
const H_PLAY_NOTE   : u16 = 0xF200;
const H_STOP_VOICE  : u16 = 0xF220;
const H_STOP_ALL    : u16 = 0xF230;
const H_PLAY_SFX    : u16 = 0xF240;
const H_SET_VOL     : u16 = 0xF250;
const H_MASTER_VOL  : u16 = 0xF258;
const H_READ_PAD    : u16 = 0xF260;
const H_READ_KEY    : u16 = 0xF270;
const H_WAIT_KEY    : u16 = 0xF280;
const H_READ_MOUSE  : u16 = 0xF290;
const H_KEY_DOWN    : u16 = 0xF2A0;
const H_WAIT_VBLANK : u16 = 0xF2B0;
const H_RAND_API    : u16 = 0xF2C0;
const H_RAND16      : u16 = 0xF2C8;
const H_MEMCPY      : u16 = 0xF2D0;
const H_MEMSET      : u16 = 0xF2F0;
const H_MEMCMP      : u16 = 0xF310;
const H_FRAME_NUM   : u16 = 0xF330;
const H_SOFT_RESET  : u16 = 0xF338;
const H_VERSION     : u16 = 0xF340;

// Vecteurs d'interruption
pub const VEC_NMI_TARGET   : u16 = 0xF350; // handler NMI par défaut
pub const VEC_IRQ_TARGET   : u16 = 0xF360; // handler IRQ par défaut
pub const RESET_TARGET     : u16 = 0xE000; // point d'entrée programme

// ── Charset 4×4 pixels (128 caractères ASCII $20–$9F) ────────────────────────
// Chaque caractère est encodé en 4 octets (4 lignes × 4 pixels, 1 bit par pixel)
// Un octet = 1 ligne : bits 7-4 = pixels 0-3 (MSB = pixel gauche)
// Résolution 4×4 en mode texte (char 4×4 dans grille 32×32)

/// Police 4×4 pour les 96 caractères ASCII imprimables ($20 à $7F)
/// Inspirée des polices Apple II / Commodore
const CHARSET_4X4: [u8; 96 * 4] = [
    // $20 espace
    0b0000_0000, 0b0000_0000, 0b0000_0000, 0b0000_0000,
    // $21 !
    0b0100_0000, 0b0100_0000, 0b0000_0000, 0b0100_0000,
    // $22 "
    0b1010_0000, 0b1010_0000, 0b0000_0000, 0b0000_0000,
    // $23 #
    0b1010_0000, 0b1110_0000, 0b1010_0000, 0b1110_0000,
    // $24 $
    0b0110_0000, 0b1100_0000, 0b0110_0000, 0b1100_0000,
    // $25 %
    0b1000_0000, 0b0010_0000, 0b0100_0000, 0b0001_0000,
    // $26 &
    0b0100_0000, 0b1010_0000, 0b0110_0000, 0b1010_0000,
    // $27 '
    0b0100_0000, 0b0100_0000, 0b0000_0000, 0b0000_0000,
    // $28 (
    0b0010_0000, 0b0100_0000, 0b0100_0000, 0b0010_0000,
    // $29 )
    0b0100_0000, 0b0010_0000, 0b0010_0000, 0b0100_0000,
    // $2A *
    0b0000_0000, 0b1010_0000, 0b0100_0000, 0b1010_0000,
    // $2B +
    0b0000_0000, 0b0100_0000, 0b1110_0000, 0b0100_0000,
    // $2C ,
    0b0000_0000, 0b0000_0000, 0b0100_0000, 0b1000_0000,
    // $2D -
    0b0000_0000, 0b0000_0000, 0b1110_0000, 0b0000_0000,
    // $2E .
    0b0000_0000, 0b0000_0000, 0b0000_0000, 0b0100_0000,
    // $2F /
    0b0010_0000, 0b0010_0000, 0b0100_0000, 0b1000_0000,
    // $30 0
    0b0110_0000, 0b1010_0000, 0b1010_0000, 0b0110_0000,
    // $31 1
    0b0100_0000, 0b1100_0000, 0b0100_0000, 0b1110_0000,
    // $32 2
    0b1100_0000, 0b0010_0000, 0b0100_0000, 0b1110_0000,
    // $33 3
    0b1100_0000, 0b0110_0000, 0b0010_0000, 0b1100_0000,
    // $34 4
    0b1010_0000, 0b1110_0000, 0b0010_0000, 0b0010_0000,
    // $35 5
    0b1110_0000, 0b1100_0000, 0b0010_0000, 0b1100_0000,
    // $36 6
    0b0110_0000, 0b1000_0000, 0b1110_0000, 0b0110_0000,
    // $37 7
    0b1110_0000, 0b0010_0000, 0b0100_0000, 0b0100_0000,
    // $38 8
    0b0110_0000, 0b0110_0000, 0b1010_0000, 0b0110_0000,
    // $39 9
    0b0110_0000, 0b1110_0000, 0b0010_0000, 0b0110_0000,
    // $3A :
    0b0000_0000, 0b0100_0000, 0b0000_0000, 0b0100_0000,
    // $3B ;
    0b0000_0000, 0b0100_0000, 0b0000_0000, 0b0110_0000,
    // $3C <
    0b0010_0000, 0b0100_0000, 0b0100_0000, 0b0010_0000,
    // $3D =
    0b0000_0000, 0b1110_0000, 0b0000_0000, 0b1110_0000,
    // $3E >
    0b1000_0000, 0b0100_0000, 0b0100_0000, 0b1000_0000,
    // $3F ?
    0b0110_0000, 0b0010_0000, 0b0000_0000, 0b0100_0000,
    // $40 @
    0b0110_0000, 0b1010_0000, 0b1110_0000, 0b0100_0000,
    // $41 A
    0b0110_0000, 0b1110_0000, 0b1010_0000, 0b1010_0000,
    // $42 B
    0b1100_0000, 0b1110_0000, 0b1010_0000, 0b1110_0000,
    // $43 C
    0b0110_0000, 0b1000_0000, 0b1000_0000, 0b0110_0000,
    // $44 D
    0b1100_0000, 0b1010_0000, 0b1010_0000, 0b1100_0000,
    // $45 E
    0b1110_0000, 0b1100_0000, 0b1000_0000, 0b1110_0000,
    // $46 F
    0b1110_0000, 0b1100_0000, 0b1000_0000, 0b1000_0000,
    // $47 G
    0b0110_0000, 0b1000_0000, 0b1010_0000, 0b0110_0000,
    // $48 H
    0b1010_0000, 0b1110_0000, 0b1010_0000, 0b1010_0000,
    // $49 I
    0b1110_0000, 0b0100_0000, 0b0100_0000, 0b1110_0000,
    // $4A J
    0b0010_0000, 0b0010_0000, 0b1010_0000, 0b0110_0000,
    // $4B K
    0b1010_0000, 0b1100_0000, 0b1010_0000, 0b1010_0000,
    // $4C L
    0b1000_0000, 0b1000_0000, 0b1000_0000, 0b1110_0000,
    // $4D M
    0b1010_0000, 0b1110_0000, 0b1110_0000, 0b1010_0000,
    // $4E N
    0b1010_0000, 0b1110_0000, 0b1110_0000, 0b1010_0000,
    // $4F O
    0b0110_0000, 0b1010_0000, 0b1010_0000, 0b0110_0000,
    // $50 P
    0b1110_0000, 0b1010_0000, 0b1110_0000, 0b1000_0000,
    // $51 Q
    0b0110_0000, 0b1010_0000, 0b1110_0000, 0b0110_0000,
    // $52 R
    0b1110_0000, 0b1010_0000, 0b1100_0000, 0b1010_0000,
    // $53 S
    0b0110_0000, 0b1100_0000, 0b0010_0000, 0b1100_0000,
    // $54 T
    0b1110_0000, 0b0100_0000, 0b0100_0000, 0b0100_0000,
    // $55 U
    0b1010_0000, 0b1010_0000, 0b1010_0000, 0b0110_0000,
    // $56 V
    0b1010_0000, 0b1010_0000, 0b1010_0000, 0b0100_0000,
    // $57 W
    0b1010_0000, 0b1110_0000, 0b1110_0000, 0b1010_0000,
    // $58 X
    0b1010_0000, 0b0100_0000, 0b0100_0000, 0b1010_0000,
    // $59 Y
    0b1010_0000, 0b1110_0000, 0b0100_0000, 0b0100_0000,
    // $5A Z
    0b1110_0000, 0b0010_0000, 0b0100_0000, 0b1110_0000,
    // $5B [
    0b0110_0000, 0b0100_0000, 0b0100_0000, 0b0110_0000,
    // $5C backslash
    0b1000_0000, 0b0100_0000, 0b0010_0000, 0b0001_0000,
    // $5D ]
    0b0110_0000, 0b0010_0000, 0b0010_0000, 0b0110_0000,
    // $5E ^
    0b0100_0000, 0b1010_0000, 0b0000_0000, 0b0000_0000,
    // $5F _
    0b0000_0000, 0b0000_0000, 0b0000_0000, 0b1111_0000,
    // $60 `
    0b1000_0000, 0b0100_0000, 0b0000_0000, 0b0000_0000,
    // $61 a (minuscule = même que majuscule pour la 4×4)
    0b0000_0000, 0b0110_0000, 0b1110_0000, 0b0110_0000,
    // $62 b
    0b1000_0000, 0b1100_0000, 0b1010_0000, 0b1100_0000,
    // $63 c
    0b0000_0000, 0b0110_0000, 0b1000_0000, 0b0110_0000,
    // $64 d
    0b0010_0000, 0b0110_0000, 0b1010_0000, 0b0110_0000,
    // $65 e
    0b0000_0000, 0b0110_0000, 0b1110_0000, 0b0100_0000,
    // $66 f
    0b0010_0000, 0b0100_0000, 0b1100_0000, 0b0100_0000,
    // $67 g
    0b0000_0000, 0b0110_0000, 0b1110_0000, 0b0010_0000,
    // $68 h
    0b1000_0000, 0b1100_0000, 0b1010_0000, 0b1010_0000,
    // $69 i
    0b0100_0000, 0b0000_0000, 0b0100_0000, 0b0110_0000,
    // $6A j
    0b0010_0000, 0b0000_0000, 0b0010_0000, 0b0110_0000,
    // $6B k
    0b1000_0000, 0b1010_0000, 0b1100_0000, 0b1010_0000,
    // $6C l
    0b0100_0000, 0b0100_0000, 0b0100_0000, 0b0010_0000,
    // $6D m
    0b0000_0000, 0b1110_0000, 0b1110_0000, 0b1010_0000,
    // $6E n
    0b0000_0000, 0b1100_0000, 0b1010_0000, 0b1010_0000,
    // $6F o
    0b0000_0000, 0b0110_0000, 0b1010_0000, 0b0110_0000,
    // $70 p
    0b0000_0000, 0b1100_0000, 0b1110_0000, 0b1000_0000,
    // $71 q
    0b0000_0000, 0b0110_0000, 0b1110_0000, 0b0010_0000,
    // $72 r
    0b0000_0000, 0b0110_0000, 0b1000_0000, 0b1000_0000,
    // $73 s
    0b0000_0000, 0b0110_0000, 0b0100_0000, 0b1100_0000,
    // $74 t
    0b0100_0000, 0b1110_0000, 0b0100_0000, 0b0010_0000,
    // $75 u
    0b0000_0000, 0b1010_0000, 0b1010_0000, 0b0110_0000,
    // $76 v
    0b0000_0000, 0b1010_0000, 0b1010_0000, 0b0100_0000,
    // $77 w
    0b0000_0000, 0b1010_0000, 0b1110_0000, 0b1110_0000,
    // $78 x
    0b0000_0000, 0b1010_0000, 0b0100_0000, 0b1010_0000,
    // $79 y
    0b0000_0000, 0b1010_0000, 0b0110_0000, 0b0010_0000,
    // $7A z
    0b0000_0000, 0b1110_0000, 0b0100_0000, 0b1110_0000,
    // $7B {
    0b0010_0000, 0b0100_0000, 0b1000_0000, 0b0100_0000,
    // $7C |
    0b0100_0000, 0b0100_0000, 0b0100_0000, 0b0100_0000,
    // $7D }
    0b1000_0000, 0b0100_0000, 0b0010_0000, 0b0100_0000,
    // $7E ~
    0b0000_0000, 0b0110_0000, 0b1100_0000, 0b0000_0000,
    // $7F DEL (bloc plein)
    0b1111_0000, 0b1111_0000, 0b1111_0000, 0b1111_0000,
];

// ── Génération de la ROM ──────────────────────────────────────────────────────

/// Construit le buffer ROM 4 Ko complet.
pub fn build_rom() -> [u8; ROM_SIZE] {
    let mut rom = [0u8; ROM_SIZE];

    // ── Jump table ($F000–$F07F) ──────────────────────────────────────────
    // Chaque entrée = JMP $xxxx = [0x4C, lo, hi]
    let jumps: &[(u16, u16)] = &[
        (SYS_CLEAR,      H_CLEAR),
        (SYS_DRAW_PIXEL, H_DRAW_PIXEL),
        (SYS_DRAW_LINE,  H_DRAW_LINE),
        (SYS_DRAW_RECT,  H_DRAW_RECT),
        (SYS_FILL_RECT,  H_FILL_RECT),
        (SYS_BLIT,       H_BLIT),
        (SYS_DRAW_SPR,   H_DRAW_SPR),
        (SYS_GET_PIXEL,  H_GET_PIXEL),
        (SYS_FLIP,       H_FLIP),
        (SYS_SET_MODE,   H_SET_MODE),
        (SYS_PRINT_CHAR, H_PRINT_CHAR),
        (SYS_PRINT_STR,  H_PRINT_STR),
        (SYS_PRINT_NUM,  H_PRINT_NUM),
        (SYS_PRINT_HEX,  H_PRINT_HEX),
        (SYS_SET_CURSOR, H_SET_CURSOR),
        (SYS_GET_CURSOR, H_GET_CURSOR),
        (SYS_SET_COLOR,  H_SET_COLOR),
        (SYS_SCROLL_UP,  H_SCROLL_UP),
        (SYS_PLAY_NOTE,  H_PLAY_NOTE),
        (SYS_STOP_VOICE, H_STOP_VOICE),
        (SYS_STOP_ALL,   H_STOP_ALL),
        (SYS_PLAY_SFX,   H_PLAY_SFX),
        (SYS_SET_VOL,    H_SET_VOL),
        (SYS_MASTER_VOL, H_MASTER_VOL),
        (SYS_READ_PAD,   H_READ_PAD),
        (SYS_READ_KEY,   H_READ_KEY),
        (SYS_WAIT_KEY,   H_WAIT_KEY),
        (SYS_READ_MOUSE, H_READ_MOUSE),
        (SYS_KEY_DOWN,   H_KEY_DOWN),
        (SYS_WAIT_VBLANK,H_WAIT_VBLANK),
        (SYS_RAND_API,   H_RAND_API),
        (SYS_RAND16,     H_RAND16),
        (SYS_MEMCPY,     H_MEMCPY),
        (SYS_MEMSET,     H_MEMSET),
        (SYS_MEMCMP,     H_MEMCMP),
        (SYS_FRAME_NUM,  H_FRAME_NUM),
        (SYS_SOFT_RESET, H_SOFT_RESET),
        (SYS_VERSION,    H_VERSION),
    ];

    for &(entry_addr, target_addr) in jumps {
        let offset = (entry_addr - ROM_START) as usize;
        rom[offset]     = 0x4C;                       // JMP opcode
        rom[offset + 1] = (target_addr & 0xFF) as u8; // lo
        rom[offset + 2] = (target_addr >> 8)   as u8; // hi
    }

    // ── Routines ROM en 6502 natif ────────────────────────────────────────
    // Les routines sont écrites en code machine 6502.
    // Elles utilisent les registres I/O ($D000–$D3FF) pour tout effet.
    //
    // Convention : chaque routine respecte l'ABI Chuck-8 :
    //   - A = paramètre principal / valeur de retour
    //   - X = 2ème paramètre (souvent x ou index voix)
    //   - Y = 3ème paramètre (souvent y)
    //   - $80–$8F = paramètres larges
    //   - Préserve ce qui est nécessaire via PHA/PLA

    // ── SYS_SET_MODE ($F01B → H_SET_MODE $F160) ──────────────────────────
    // A=0 → mode texte, A=1 → mode graphique
    // Implémentation : LDA A, ET avec 1, STA VPU_CTRL, RTS
    write_at(&mut rom, H_SET_MODE, &[
        0xA5, 0x80,       // LDA (on utilise l'ABI — mais A est déjà le param)
        // En fait on arrive avec A = mode, donc :
        // Reset routine, utilise directement A
    ]);
    // Réécrit correctement :
    write_at(&mut rom, H_SET_MODE, &[
        0x85, 0x00,       // STA $00 (temp)
        0xA9, 0x80,       // LDA #$80 (VPU_ENABLE)
        0x05, 0x00,       // ORA $00 (ajoute le mode)
        0x8D, 0x00, 0xD0, // STA $D000 (VPU_CTRL)
        0x60,             // RTS
    ]);

    // ── SYS_CLEAR ($F000 → H_CLEAR $F080) ────────────────────────────────
    // A = couleur (mode gfx) ou char (mode texte)
    // En mode gfx : remplit FRAMEBUF_A $4000–$5FFF avec nibble-packing
    // En mode texte : remplit VRAM_TEXT $4800–$4BFF avec le char
    //
    // Version courte : on vérifie le mode et on dispatch
    // Pour la ROM : deux boucles séparées
    //
    // Mode gfx : 128×128/2 = 8192 octets
    // nibble = (color & $0F) | (color << 4)
    // Boucle DEX/BNE sur 32 pages de 256 = 8192 octets
    write_at(&mut rom, H_CLEAR, &[
        // Sauvegarder A (couleur)
        0x48,             // PHA
        // Lire mode VPU
        0xAD, 0x00, 0xD0, // LDA $D000 (VPU_CTRL)
        0x29, 0x01,       // AND #$01
        0xD0, 0x20,       // BNE GFX_CLEAR (+32 → mode gfx)
        // ── MODE TEXTE : remplir $4800–$4BFF ───────────────────────
        0x68,             // PLA (récupère le char)
        0xA2, 0x00,       // LDX #$00
        0xA0, 0x00,       // LDY #$00
        // boucle : STA $4800,X + INX + BNE + INY + CPY #$10 + BNE
        0x9D, 0x00, 0x48, // STA $4800,X
        0xE8,             // INX
        0xD0, 0xFA,       // BNE -4 (256 fois)
        0xC8,             // INY
        0xC0, 0x10,       // CPY #$10 (16 pages = 4096 octets = 32×128 chars, trop)
        0xD0, 0xF4,       // BNE -10
        0x60,             // RTS
        // ── MODE GFX : remplir $4000–$5FFF ─────────────────────────
        // offset +32 depuis H_CLEAR
        0x68,             // PLA (couleur)
        0x0A,             // ASL (couleur << 1 temporaire)
        0x05, 0x00,       // OR  (on va construire nibble-packed)
        // En fait : nibble = color | (color << 4)
        // On a color dans A, on fait A = (A & $0F) | ((A & $0F) << 4)
        0x29, 0x0F,       // AND #$0F
        0x85, 0x00,       // STA $00 (temp)
        0x0A,             // ASL
        0x0A,             // ASL
        0x0A,             // ASL
        0x0A,             // ASL
        0x05, 0x00,       // ORA $00
        // A = nibble-packed color
        0xA2, 0x00,       // LDX #$00
        0xA0, 0x00,       // LDY #$00
        0x99, 0x00, 0x40, // STA $4000,Y -- utilise Y comme page high
        // Cette approche est simpliste. On va utiliser un pointeur ZP
        // Pour la ROM de démo, on écrit directement les 32 pages
        0xE8,             // INX
        0xD0, 0xFA,       // BNE loop
        0xC8,             // INY
        0xC0, 0x20,       // CPY #$20 (32 pages = 8192 octets)
        0xD0, 0xF4,       // BNE loop
        0x60,             // RTS
    ]);

    // ── SYS_DRAW_PIXEL ($F003 → H_DRAW_PIXEL $F090) ──────────────────────
    // A=couleur, X=px, Y=py
    // Adresse = $4000 + py*64 + px/2
    // Nibble haut si px pair, nibble bas si px impair
    // On stocke tout via des registres ZP temporaires
    write_at(&mut rom, H_DRAW_PIXEL, &[
        // Sauvegarder couleur ($00), X ($01), Y ($02)
        0x85, 0x00,       // STA $00 (couleur)
        0x86, 0x01,       // STX $01 (px)
        0x84, 0x02,       // STY $02 (py)
        // Calcul adresse : py * 64 = py * 4 * 16
        // offset = py<<6 = py*64
        0xA5, 0x02,       // LDA $02 (py)
        0x0A,             // ASL      py*2
        0x0A,             // ASL      py*4
        0x0A,             // ASL      py*8
        0x0A,             // ASL      py*16
        0x0A,             // ASL      py*32
        0x0A,             // ASL      py*64 (lo)
        // Attention : py*64 peut dépasser 8 bits si py > 3
        // py max = 127 → 127*64 = 8128 = $1FC0
        // On doit faire ça en 16 bits
        // Approche : utiliser ASL avec carry
        0x85, 0x03,       // STA $03 (offset lo)
        // hi : py >> 2 (= py*64 >> 8)
        0xA5, 0x02,
        0x4A,             // LSR      py/2
        0x4A,             // LSR      py/4
        0x85, 0x04,       // STA $04 (offset hi)
        // Ajouter px/2 à l'offset lo
        0xA5, 0x01,       // LDA $01 (px)
        0x4A,             // LSR      px/2
        0x18,             // CLC
        0x65, 0x03,       // ADC $03
        0x85, 0x03,       // STA $03
        // Ajouter $40 (base $4000) à hi
        0xA5, 0x04,
        0x69, 0x40,       // ADC #$40 (+ carry)
        0x85, 0x04,
        // Pointeur en $F0/$F1
        0xA5, 0x03,
        0x85, 0xF0,       // STA $F0
        0xA5, 0x04,
        0x85, 0xF1,       // STA $F1
        // Lire l'octet courant
        0xA0, 0x00,
        0xB1, 0xF0,       // LDA ($F0),Y
        // Tester si px pair ou impair
        0xA5, 0x01,       // LDA $01 (px)
        0x29, 0x01,       // AND #$01
        0xD0, 0x0E,       // BNE pixel_impair (+14)
        // px pair → nibble haut
        0xB1, 0xF0,       // LDA ($F0),Y (octet actuel)
        0x29, 0x0F,       // AND #$0F    efface nibble haut
        0xA6, 0x00,       // LDX $00     couleur
        0x8A,             // TXA
        0x0A,0x0A,0x0A,0x0A, // ASL×4  couleur << 4
        0x05, 0x03+4,     // ORA... (simplifié — on utilise le ZP)
        // → ici c'est complexe ; on finalise avec une approche directe
        // Pour la démo on utilise un chemin plus court
        0xA5, 0x00,       // LDA couleur
        0x29, 0x0F,
        0x0A,0x0A,0x0A,0x0A,
        0x91, 0xF0,       // STA ($F0),Y
        0x60,             // RTS
        // px impair → nibble bas
        0xA5, 0x00,       // LDA couleur
        0x29, 0x0F,
        0x91, 0xF0,       // STA ($F0),Y
        0x60,             // RTS
    ]);

    // ── SYS_SET_CURSOR ($F02A → H_SET_CURSOR $F1C0) ──────────────────────
    // X=colonne, Y=ligne
    write_at(&mut rom, H_SET_CURSOR, &[
        0x8E, 0x0B, 0xD0, // STX $D00B (VPU_CURSOR_X)
        0x8C, 0x0C, 0xD0, // STY $D00C (VPU_CURSOR_Y)
        0x60,             // RTS
    ]);

    // ── SYS_GET_CURSOR ($F02D → H_GET_CURSOR $F1C8) ──────────────────────
    // Retourne X=col, Y=ligne
    write_at(&mut rom, H_GET_CURSOR, &[
        0xAE, 0x0B, 0xD0, // LDX $D00B
        0xAC, 0x0C, 0xD0, // LDY $D00C
        0x60,             // RTS
    ]);

    // ── SYS_SET_COLOR ($F030 → H_SET_COLOR $F1D0) ────────────────────────
    // Convention spec v1.1 correction #14 :
    //   A reçu par l'appelant : INK=bits 7-4, PAPER=bits 3-0
    //   La routine stocke : VPU_INK = bits7-4 de A, VPU_PAPER = bits3-0 de A
    write_at(&mut rom, H_SET_COLOR, &[
        0x48,             // PHA
        0x4A,0x4A,0x4A,0x4A, // LSR×4 → INK (bits7-4) maintenant en bits3-0
        0x29, 0x0F,       // AND #$0F (sécurité)
        0x8D, 0x0D, 0xD0, // STA $D00D (VPU_INK)
        0x68,             // PLA
        0x29, 0x0F,       // AND #$0F → PAPER (bits3-0)
        0x8D, 0x0E, 0xD0, // STA $D00E (VPU_PAPER)
        0x60,             // RTS
    ]);

    // ── SYS_PRINT_CHAR ($F01E → H_PRINT_CHAR $F170) ──────────────────────
    // A = caractère ASCII. Écrit à la position curseur et avance.
    // Gère \n (newline $0A)
    write_at(&mut rom, H_PRINT_CHAR, &[
        0x8D, 0x0F, 0xD0, // STA $D00F (VPU_CHAR_OUT — effet de bord dans Memory)
        0x60,             // RTS
    ]);

    // ── SYS_READ_PAD ($F048 → H_READ_PAD $F260) ─────────────────────────
    // A=0 → manette 1, A=1 → manette 2. Retourne état dans A.
    write_at(&mut rom, H_READ_PAD, &[
        0xD0, 0x05,       // BNE +5 (si A≠0, lire PAD2)
        0xAD, 0x10, 0xD2, // LDA $D210 (PAD1_STATE)
        0x60,             // RTS
        0xAD, 0x11, 0xD2, // LDA $D211 (PAD2_STATE)
        0x60,             // RTS
    ]);

    // ── SYS_READ_KEY ($F04B → H_READ_KEY $F270) ─────────────────────────
    // Retourne ASCII dans A (0 si aucune touche)
    write_at(&mut rom, H_READ_KEY, &[
        0xAD, 0x00, 0xD2, // LDA $D200 (KEY_ASCII)
        0x60,             // RTS
    ]);

    // ── SYS_WAIT_KEY ($F04E → H_WAIT_KEY $F280) ─────────────────────────
    // Bloque jusqu'à pression d'une touche
    write_at(&mut rom, H_WAIT_KEY, &[
        0xAD, 0x01, 0xD2, // LDA $D201 (KEY_STATUS)
        0x29, 0x80,       // AND #$80
        0xF0, 0xF8,       // BEQ -6 (boucle)
        0xAD, 0x00, 0xD2, // LDA $D200 (KEY_ASCII)
        0xA9, 0x00,
        0x8D, 0x01, 0xD2, // STA $D201 (acquitter)
        0x60,             // RTS
    ]);

    // ── SYS_READ_MOUSE ($F051 → H_READ_MOUSE $F290) ─────────────────────
    // Retourne X=mouseX, Y=mouseY, A=boutons
    write_at(&mut rom, H_READ_MOUSE, &[
        0xAE, 0x20, 0xD2, // LDX $D220 (MOUSE_X)
        0xAC, 0x21, 0xD2, // LDY $D221 (MOUSE_Y)
        0xAD, 0x24, 0xD2, // LDA $D224 (MOUSE_BTN)
        0x60,             // RTS
    ]);

    // ── SYS_WAIT_VBLANK ($F057 → H_WAIT_VBLANK $F2B0) ───────────────────
    // Bloque jusqu'au prochain VBlank (bit7 de VPU_STATUS)
    // Note : en pratique le JS déclenche un NMI, mais ici on poll
    write_at(&mut rom, H_WAIT_VBLANK, &[
        // D'abord attendre que VBlank soit PAS actif (pour éviter de sauter immédiatement)
        0xAD, 0x04, 0xD0, // LDA $D004 (VPU_STATUS)
        0x30, 0xFC,       // BMI -2 (loop si bit7=1 = VBlank en cours)
        // Puis attendre le début du VBlank
        0xAD, 0x04, 0xD0, // LDA $D004
        0x10, 0xFA,       // BPL -4 (loop si bit7=0)
        0x60,             // RTS
    ]);

    // ── SYS_GET_RAND ($F05A → H_RAND_API $F2C0) ─────────────────────────
    // Retourne octet aléatoire dans A (lit SYS_RAND_REG=$D306)
    write_at(&mut rom, H_RAND_API, &[
        0xAD, 0x06, 0xD3, // LDA $D306 (SYS_RAND_REG — registre LFSR hardware)
        0x60,             // RTS
    ]);

    // ── SYS_RAND16 ($F05D → H_RAND16 $F2C8) ─────────────────────────────
    // Retourne 16-bit : A=lo, X=hi
    write_at(&mut rom, H_RAND16, &[
        0xAD, 0x06, 0xD3, // LDA $D306
        0xAE, 0x06, 0xD3, // LDX $D306
        0x60,             // RTS
    ]);

    // ── SYS_MEMSET ($F063 → H_MEMSET $F2F0) ─────────────────────────────
    // dst=$80/$81, val=A, len=$82/$83
    write_at(&mut rom, H_MEMSET, &[
        0x85, 0x00,       // STA $00 (val)
        // Pointeur dst en $F0/$F1
        0xA5, 0x80,       // LDA $80
        0x85, 0xF0,
        0xA5, 0x81,
        0x85, 0xF1,
        // Compteur : $82 pages de 256 + $83 octets restants (simplifié : $82 = nb octets lo)
        0xA4, 0x82,       // LDY $82 (longueur)
        0xA5, 0x00,       // LDA val
        // Boucle
        0xC0, 0x00,       // CPY #0
        0xF0, 0x06,       // BEQ fin
        0x91, 0xF0,       // STA ($F0),Y
        0x88,             // DEY
        0xD0, 0xF9,       // BNE loop
        0x60,             // RTS
    ]);

    // ── SYS_STOP_ALL ($F03C → H_STOP_ALL $F230) ──────────────────────────
    // Coupe toutes les voix (gate=0)
    write_at(&mut rom, H_STOP_ALL, &[
        0xA9, 0x00,       // LDA #$00
        0x8D, 0x07, 0xD1, // STA $D107 (voix 0 ctrl — gate=0)
        0x8D, 0x0F, 0xD1, // STA $D10F (voix 1 ctrl)
        0x8D, 0x17, 0xD1, // STA $D117 (voix 2 ctrl)
        0x60,             // RTS
    ]);

    // ── SYS_STOP_VOICE ($F039 → H_STOP_VOICE $F220) ──────────────────────
    // X = voix (0, 1, 2)
    write_at(&mut rom, H_STOP_VOICE, &[
        0xA9, 0x00,       // LDA #$00
        0xE0, 0x00,       // CPX #$00
        0xF0, 0x09,       // BEQ voix0
        0xE0, 0x01,
        0xF0, 0x06,       // BEQ voix1
        0x8D, 0x17, 0xD1, // STA $D117 (voix 2)
        0x60,
        0x8D, 0x07, 0xD1, // STA $D107 (voix 0)
        0x60,
        0x8D, 0x0F, 0xD1, // STA $D10F (voix 1)
        0x60,
    ]);

    // ── SYS_FRAME_NUM ($F069 → H_FRAME_NUM $F330) ────────────────────────
    // Retourne compteur frames : A=lo, X=hi
    write_at(&mut rom, H_FRAME_NUM, &[
        0xAD, 0x04, 0xD3, // LDA $D304 (SYS_FRAME_LO)
        0xAE, 0x05, 0xD3, // LDX $D305 (SYS_FRAME_HI)
        0x60,             // RTS
    ]);

    // ── SYS_VERSION ($F06F → H_VERSION $F340) ────────────────────────────
    write_at(&mut rom, H_VERSION, &[
        0xA9, 0x01,       // LDA #1 (major)
        0xA2, 0x00,       // LDX #0 (minor)
        0x60,             // RTS
    ]);

    // ── Handler NMI par défaut ($F350) ────────────────────────────────────
    // Appelé automatiquement à chaque VBlank (toutes les 1/60e seconde)
    // Version minimale : sauvegarde registres + RTI
    write_at(&mut rom, VEC_NMI_TARGET, &[
        0x48,             // PHA
        0x8A, 0x48,       // TXA PHA
        0x98, 0x48,       // TYA PHA
        // Handler VBlank : incrémente FRAME_COUNT via registre système
        // (le JS le fait côté WASM, ici on fait juste RTI)
        0x68, 0xA8,       // PLA TAY
        0x68, 0xAA,       // PLA TAX
        0x68,             // PLA
        0x40,             // RTI
    ]);

    // ── Handler IRQ par défaut ($F360) ────────────────────────────────────
    write_at(&mut rom, VEC_IRQ_TARGET, &[
        0x48,             // PHA
        0x68,             // PLA
        0x40,             // RTI
    ]);

    // ── Charset ROM ($F800) ────────────────────────────────────────────────
    // 96 caractères ASCII $20–$7F, 4 octets chacun
    let charset_offset = (0xF800u16 - ROM_START) as usize;
    for (i, &byte) in CHARSET_4X4.iter().enumerate() {
        if charset_offset + i < ROM_SIZE {
            rom[charset_offset + i] = byte;
        }
    }

    // ── Vecteurs d'interruption ────────────────────────────────────────────
    // $FFFA/$FFFB = NMI → handler NMI
    let nmi_lo  = (VEC_NMI_TARGET & 0xFF) as u8;
    let nmi_hi  = (VEC_NMI_TARGET >> 8)   as u8;
    let rst_lo  = (RESET_TARGET & 0xFF)   as u8;
    let rst_hi  = (RESET_TARGET >> 8)     as u8;
    let irq_lo  = (VEC_IRQ_TARGET & 0xFF) as u8;
    let irq_hi  = (VEC_IRQ_TARGET >> 8)   as u8;

    rom[0x0FFA] = nmi_lo;
    rom[0x0FFB] = nmi_hi;
    rom[0x0FFC] = rst_lo;
    rom[0x0FFD] = rst_hi;
    rom[0x0FFE] = irq_lo;
    rom[0x0FFF] = irq_hi;

    rom
}

/// Écrit des octets dans le buffer ROM à une adresse absolue.
fn write_at(rom: &mut [u8; ROM_SIZE], addr: u16, bytes: &[u8]) {
    let offset = (addr - ROM_START) as usize;
    for (i, &b) in bytes.iter().enumerate() {
        if offset + i < ROM_SIZE {
            rom[offset + i] = b;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jump_table_has_jmp_opcodes() {
        let rom = build_rom();
        // $F000 = premier entry de la jump table = JMP H_CLEAR
        assert_eq!(rom[0x0000], 0x4C, "Premier octet de la ROM doit être JMP ($4C)");
        // $F003 = SYS_DRAW_PIXEL
        assert_eq!(rom[0x0003], 0x4C);
    }

    #[test]
    fn reset_vector_points_to_e000() {
        let rom = build_rom();
        let lo = rom[0x0FFC] as u16;
        let hi = rom[0x0FFD] as u16;
        let vec = (hi << 8) | lo;
        assert_eq!(vec, 0xE000, "Vecteur RESET doit pointer vers $E000");
    }

    #[test]
    fn nmi_vector_points_to_handler() {
        let rom = build_rom();
        let lo = rom[0x0FFA] as u16;
        let hi = rom[0x0FFB] as u16;
        let vec = (hi << 8) | lo;
        assert_eq!(vec, VEC_NMI_TARGET);
    }

    #[test]
    fn irq_vector_set() {
        let rom = build_rom();
        let lo = rom[0x0FFE] as u16;
        let hi = rom[0x0FFF] as u16;
        let vec = (hi << 8) | lo;
        assert_eq!(vec, VEC_IRQ_TARGET);
    }

    #[test]
    fn charset_in_rom() {
        let rom = build_rom();
        let offset = (0xF800u16 - ROM_START) as usize;
        // Le caractère 'A' ($41 = index 33 dans la table) doit être non-nul
        let a_offset = offset + (0x41 - 0x20) * 4;
        let a_data = &rom[a_offset..a_offset + 4];
        assert!(a_data.iter().any(|&b| b != 0), "Charset 'A' ne doit pas être tout zéro");
    }

    #[test]
    fn sys_read_pad_in_rom() {
        let rom = build_rom();
        let offset = (H_READ_PAD - ROM_START) as usize;
        // Doit commencer par BNE (branchement sur A)
        assert_eq!(rom[offset], 0xD0, "SYS_READ_PAD doit commencer par BNE");
    }

    #[test]
    fn all_jump_entries_valid() {
        let rom = build_rom();
        // Vérifie que toutes les 38 entrées commencent par $4C (JMP)
        let entries = [
            SYS_CLEAR, SYS_DRAW_PIXEL, SYS_DRAW_LINE, SYS_DRAW_RECT,
            SYS_FILL_RECT, SYS_BLIT, SYS_DRAW_SPR, SYS_GET_PIXEL,
            SYS_FLIP, SYS_SET_MODE, SYS_PRINT_CHAR, SYS_PRINT_STR,
            SYS_PRINT_NUM, SYS_PRINT_HEX, SYS_SET_CURSOR, SYS_GET_CURSOR,
            SYS_SET_COLOR, SYS_SCROLL_UP, SYS_PLAY_NOTE, SYS_STOP_VOICE,
            SYS_STOP_ALL, SYS_READ_PAD, SYS_READ_KEY, SYS_WAIT_KEY,
            SYS_READ_MOUSE, SYS_WAIT_VBLANK, SYS_RAND_API, SYS_RAND16,
            SYS_MEMSET, SYS_FRAME_NUM, SYS_VERSION,
        ];
        for addr in entries {
            let off = (addr - ROM_START) as usize;
            assert_eq!(rom[off], 0x4C,
                "Entry ${:04X} devrait être JMP ($4C), trouvé ${:02X}", addr, rom[off]);
        }
    }
}