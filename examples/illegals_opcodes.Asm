; ═══════════════════════════════════════════════════════
; TEST — Opcodes illégaux & secrets du Chuck-8
;
; Chaque test exécute un opcode non documenté avec des
; entrées connues, puis affiche le résultat en hexadécimal.
; Compare la valeur affichée à l'ATTENDU noté en commentaire.
;
; Affichage (une ligne par test) :
;   <label> <valeur obtenue>
; ═══════════════════════════════════════════════════════

SYS_CLEAR      = $F000
SYS_SET_MODE   = $F01B
SYS_PRINT_CHAR = $F01E
SYS_PRINT_HEX  = $F027
SYS_SET_CURSOR = $F02A

.org $E000

RESET:
    LDA #0
    JSR SYS_SET_MODE        ; mode texte
    LDA #0
    JSR SYS_CLEAR

    LDA #0
    STA LINE                ; compteur de ligne pour l'affichage

; ── LAX : A = X = M ─────────────────────────────────────
; M=$3C  ATTENDU : $3C
    LDA #$3C
    STA $40
    LDA #'L'
    JSR LABEL
    LDA #$00
    LDX #$00
    LAX $40                 ; A=$3C, X=$3C
    JSR SYS_PRINT_HEX       ; → $3C

; ── SAX : M = A & X (aucun flag) ────────────────────────
; A=$CC X=$F0  ATTENDU : $C0
    LDA #'S'
    JSR LABEL
    LDA #$CC
    LDX #$F0
    SAX $41                 ; M[$41] = $CC & $F0 = $C0
    LDA $41
    JSR SYS_PRINT_HEX       ; → $C0

; ── DCP : M = M-1 puis CMP A ────────────────────────────
; M=$10→$0F, A=$0F  ATTENDU M : $0F  (et Z=1,C=1)
    LDA #'D'
    JSR LABEL
    LDA #$10
    STA $42
    LDA #$0F
    DCP $42                 ; M[$42] = $0F
    LDA $42
    JSR SYS_PRINT_HEX       ; → $0F

; ── ISC : M = M+1 puis SBC A ────────────────────────────
; M=$0F→$10, A=$20, C=1  ATTENDU A : $10
    LDA #'I'
    JSR LABEL
    LDA #$0F
    STA $43
    SEC
    LDA #$20
    ISC $43                 ; A = $20 - $10 = $10
    JSR SYS_PRINT_HEX       ; → $10

; ── SLO : ASL M puis ORA A ──────────────────────────────
; M=$81→$02 (C=1), A=$10  ATTENDU A : $12
    LDA #'O'
    JSR LABEL
    LDA #$81
    STA $44
    LDA #$10
    SLO $44                 ; A = $10 | $02 = $12
    JSR SYS_PRINT_HEX       ; → $12

; ── RLA : ROL M puis AND A ──────────────────────────────
; M=$81, Cin=0 → M=$02 (C=1), A=$03  ATTENDU A : $02
    LDA #'R'
    JSR LABEL
    LDA #$81
    STA $45
    CLC
    LDA #$03
    RLA $45                 ; A = $03 & $02 = $02
    JSR SYS_PRINT_HEX       ; → $02

; ── SRE : LSR M puis EOR A ──────────────────────────────
; M=$03→$01 (C=1), A=$FF  ATTENDU A : $FE
    LDA #'E'
    JSR LABEL
    LDA #$03
    STA $46
    LDA #$FF
    SRE $46                 ; A = $FF ^ $01 = $FE
    JSR SYS_PRINT_HEX       ; → $FE

; ── RRA : ROR M puis ADC A ──────────────────────────────
; M=$02, Cin=0 → M=$01 (newC=0), A=$10  ATTENDU A : $11
    LDA #'A'
    JSR LABEL
    LDA #$02
    STA $47
    CLC
    LDA #$10
    RRA $47                 ; A = $10 + $01 + 0 = $11
    JSR SYS_PRINT_HEX       ; → $11

; ── ANC : A &= imm ; C = bit7 ───────────────────────────
; A=$F0 & $FF = $F0  ATTENDU A : $F0 (C=1)
    LDA #'N'
    JSR LABEL
    LDA #$F0
    ANC #$FF               ; A = $F0
    JSR SYS_PRINT_HEX       ; → $F0

; ── ALR : A &= imm ; LSR A ──────────────────────────────
; A=$FF & $03 = $03 → LSR → $01 (C=1)  ATTENDU A : $01
    LDA #'l'
    JSR LABEL
    LDA #$FF
    ALR #$03               ; A = $01
    JSR SYS_PRINT_HEX       ; → $01

; ── ARR : A &= imm ; ROR A ; flags spéciaux ─────────────
; A=$FF & $FF = $FF, Cin=0 → ROR → $7F  ATTENDU A : $7F (C=1)
    LDA #'r'
    JSR LABEL
    CLC
    LDA #$FF
    ARR #$FF               ; A = $7F
    JSR SYS_PRINT_HEX       ; → $7F

; ── AXS : X = (A & X) - imm ; C = NOT borrow ────────────
; A=$FF X=$0F → (A&X)=$0F - $05 = $0A  ATTENDU X : $0A (C=1)
    LDA #'X'
    JSR LABEL
    LDA #$FF
    LDX #$0F
    AXS #$05               ; X = $0A
    TXA
    JSR SYS_PRINT_HEX       ; → $0A

; ── MUL (secret) : A*X → A=lo, X=hi ─────────────────────
; A=$10 X=$10 = $0100  ATTENDU A : $00, X : $01
    LDA #'M'
    JSR LABEL
    LDA #$10
    LDX #$10
    MUL                    ; A=$00, X=$01
    JSR SYS_PRINT_HEX       ; → $00 (lo)
    TXA
    JSR SYS_PRINT_HEX       ; → $01 (hi)

; ── MCP (secret) : memcpy X octets src→dst ──────────────
; src=$0070 dst=$0080, X=3 octets $AA $BB $CC  ATTENDU dst[0] : $AA
    LDA #'C'
    JSR LABEL
    LDA #$AA
    STA $70
    LDA #$BB
    STA $71
    LDA #$CC
    STA $72
    LDA #$70               ; src lo
    STA $FB
    LDA #$00               ; src hi
    STA $FC
    LDA #$80               ; dst lo
    STA $FD
    LDA #$00               ; dst hi
    STA $FE
    LDX #3
    MCP                    ; copie $70-$72 → $80-$82
    LDA $80
    JSR SYS_PRINT_HEX       ; → $AA

    BRK                    ; fin — validable headless

; ═══════════════════════════════════════════════════════
; LABEL — affiche le caractère dans A en début de ligne,
;         positionne le curseur après pour la valeur hex.
;         Incrémente le compteur de ligne.
; Entrée : A = caractère du label
; ═══════════════════════════════════════════════════════
LABEL:
    PHA                    ; sauve le caractère
    LDX #0
    LDY LINE
    JSR SYS_SET_CURSOR     ; curseur en (col 0, ligne LINE)
    PLA
    JSR SYS_PRINT_CHAR     ; affiche le label
    ; curseur en col 4 pour la valeur
    LDX #4
    LDY LINE
    JSR SYS_SET_CURSOR
    INC LINE               ; ligne suivante au prochain test
    RTS

LINE: .byte 0

.org $FFFC
.word RESET