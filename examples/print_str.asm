; ═══════════════════════════════════════════════════════
; PRINT_CHAR : affiche un caractère à une position donnée
;
; Entrée :
;   A = caractère à afficher (code ASCII)
;   X = colonne (0–31)
;   Y = ligne (0–31)
;
; Registres modifiés : A, X, Y (non sauvegardés)
; ═══════════════════════════════════════════════════════

SYS_SET_MODE = $F01B

.org $E000

RESET:
    LDA #0
    JSR SYS_SET_MODE

    ; Afficher 'H' en (colonne=0, ligne=0)
    LDA #'H'     ; ca65 accepte les littéraux de caractères
    LDX #0
    LDY #0
    JSR PRINT_CHAR

    ; Afficher 'I' en (colonne=1, ligne=0)
    LDA #'I'
    LDX #1
    LDY #0
    JSR PRINT_CHAR

    ; Afficher '!' en (colonne=5, ligne=2)
    LDA #'!'
    LDX #5
    LDY #2
    JSR PRINT_CHAR

    JMP *

; ── Routine PRINT_CHAR ──────────────────────────────────
PRINT_CHAR:
    ; Sauvegarder le caractère (A va être utilisé pour le calcul)
    PHA

    ; Calculer l'offset = ligne * 32 + colonne
    ; On a : Y = ligne, X = colonne
    TYA             ; A ← Y (ligne)
    ASL A           ; A = ligne * 2
    ASL A           ; A = ligne * 4
    ASL A           ; A = ligne * 8
    ASL A           ; A = ligne * 16
    ASL A           ; A = ligne * 32
    STA $10         ; Sauvegarder en Zero Page $10
    TXA             ; A ← X (colonne)
    CLC
    ADC $10         ; A = ligne*32 + colonne = offset
    TAY             ; Y ← offset (on va utiliser l'adressage absolu,Y)

    ; Écrire le caractère
    PLA             ; Récupérer le caractère (PLA restaure A depuis la pile)
    STA $4800,Y     ; mémoire[$4800 + offset] ← caractère

    ; Écrire l'attribut couleur (blanc sur noir)
    LDA #%00000001  ; INK=1 (blanc), PAPER=0 (noir)
    STA $4C00,Y     ; mémoire[$4C00 + offset] ← couleur

    RTS

; ── Routine PRINT_STR ──────────────────────────────────
PRINT_STR:
    ; $80/$81 = adresse de la chaîne
    ; X = colonne de départ, Y = ligne de départ
    ; → on va utiliser Y pour deux choses différentes :
    ;   d'abord comme ligne (pour SET_CURSOR), puis comme index dans la chaîne.
    ;   Il faut donc sauvegarder la ligne avant de l'écraser.

    STX $82         ; sauvegarder colonne
    STY $83         ; sauvegarder ligne

    LDY #0          ; Y = index dans la chaîne (commence à 0)
BOUCLE:
    LDA ($80),Y     ; lire le caractère à adresse[$80/$81 + Y]
    BEQ FIN         ; si c'est $00, on a fini
    ; ... appeler SET_CURSOR puis PRINT_CHAR ...
    ; ... incrémenter X et Y ...
    JMP BOUCLE
FIN:
    RTS

; La chaîne dans les données :
MESSAGE: .byte "HELLO", 0   ; $48 $45 $4C $4C $4F $00


.org $FFFC
.word RESET