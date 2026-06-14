# CHUCK-8 COMPUTER SYSTEM SPECIFICATION
## Version 1.0 — Draft

```
  ██████╗██╗  ██╗██╗   ██╗ ██████╗██╗  ██╗      █████╗
 ██╔════╝██║  ██║██║   ██║██╔════╝██║ ██╔╝     ██╔══██╗
 ██║     ███████║██║   ██║██║     █████╔╝      ╚█████╔╝
 ██║     ██╔══██║██║   ██║██║     ██╔═██╗      ██╔══██╗
 ╚██████╗██║  ██║╚██████╔╝╚██████╗██║  ██╗     ╚█████╔╝
  ╚═════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝     ╚════╝
  C O M P U T E R   S Y S T E M   S P E C I F I C A T I O N
```

**Révision :** 1.0-DRAFT  
**Date :** 2025  
**Statut :** Reference Document

---

## PRÉAMBULE

Le Chuck-8 est un ordinateur personnel 8-bit imaginaire à vocation pédagogique.
Sa conception s'inspire directement des machines des années 1975–1985 (Apple II,
Commodore 64, Atari 800) tout en restant cohérente et accessible.

**Philosophie :**
- Fidélité au 6502 original — pas d'extensions, pas de raccourcis
- Règles fixes et documentées — la machine ne change pas
- Constructible en hardware — chaque décision est motivée par la faisabilité réelle
- Pédagogique avant tout — comprendre pourquoi, pas seulement comment

---

## CHAPITRE 1 — VUE D'ENSEMBLE

### 1.1 Caractéristiques principales

| Composant         | Spécification                                    |
|-------------------|--------------------------------------------------|
| CPU               | MOS 6502 (1 MHz simulé)                          |
| RAM               | 64 Ko (65 536 octets)                            |
| ROM               | 4 Ko ($F000–$FFFF) — système + vecteurs          |
| Vidéo             | 128×128 pixels, 16 couleurs, 2 modes             |
| VRAM              | 16 Ko ($4000–$7FFF)                              |
| Texte             | 32×32 caractères (mode texte)                    |
| Son               | 3 voix (carrée + triangle + bruit), 1 bit sample |
| Clavier           | ASCII complet + touches spéciales                |
| Manette           | 2 × 8 boutons (compatible NES)                   |
| Souris            | X/Y + 2 boutons                                  |
| Cartouche         | 16 Ko max ($8000–$BFFF)                          |
| Fréquence CPU     | 1 MHz (1 000 000 cycles/seconde)                 |
| Framerate cible   | 50 Hz (PAL) ou 60 Hz (NTSC) — configurable       |

### 1.2 Blocs fonctionnels

```
┌────────────────────────────────────────────────────────┐
│                    BUS PRINCIPAL 8-bit                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  6502    │  │  64 Ko   │  │  I/O Chip (virtuel)  │  │
│  │  CPU     │  │  RAM     │  │  $D000–$D0FF         │  │
│  │  1 MHz   │  │          │  │  clavier/pad/souris  │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │  VPU (Video)         │    │  SPU (Sound)         │  │
│  │  $4000–$7FFF VRAM    │    │  $D100–$D1FF regs    │  │
│  │  128×128 / 32×32 txt │    │  3 voix + enveloppe  │  │
│  └──────────────────────┘    └──────────────────────┘  │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │  CART ROM (optionnel)│    │  SYS ROM             │  │
│  │  $8000–$BFFF 16 Ko   │    │  $F000–$FFFF 4 Ko   │  │
│  └──────────────────────┘    └──────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## CHAPITRE 2 — CPU : MOS 6502

### 2.1 Registres

| Registre | Taille | Description                                  |
|----------|--------|----------------------------------------------|
| A        | 8 bits | Accumulateur — toutes les opérations passent ici |
| X        | 8 bits | Index — adressage indexé, compteurs          |
| Y        | 8 bits | Index — adressage indexé, compteurs          |
| PC       | 16 bits| Program Counter — adresse de la prochaine instruction |
| SP       | 8 bits | Stack Pointer — pointe dans $0100–$01FF      |
| P        | 8 bits | Processor Status — 7 flags                   |

### 2.2 Flags (registre P)

```
Bit : 7  6  5  4  3  2  1  0
      N  V  -  B  D  I  Z  C
      │  │  │  │  │  │  │  └── Carry
      │  │  │  │  │  │  └───── Zero
      │  │  │  │  │  └──────── Interrupt Disable
      │  │  │  │  └─────────── Decimal (BCD — actif mais rare)
      │  │  │  └────────────── Break
      │  │  └───────────────── (toujours 1)
      │  └──────────────────── oVerflow
      └─────────────────────── Negative
```

### 2.3 Modes d'adressage supportés (13 modes)

| Mode | Syntaxe ca65 | Exemple | Taille |
|------|-------------|---------|--------|
| Implicite | — | `CLC` | 1 octet |
| Accumulateur | `A` | `ASL A` | 1 octet |
| Immédiat | `#val` | `LDA #$42` | 2 octets |
| Zero Page | `$zz` | `LDA $10` | 2 octets |
| Zero Page,X | `$zz,X` | `LDA $10,X` | 2 octets |
| Zero Page,Y | `$zz,Y` | `LDX $10,Y` | 2 octets |
| Absolu | `$xxxx` | `LDA $1234` | 3 octets |
| Absolu,X | `$xxxx,X` | `LDA $1234,X` | 3 octets |
| Absolu,Y | `$xxxx,Y` | `LDA $1234,Y` | 3 octets |
| Indirect | `($xxxx)` | `JMP ($FFFE)` | 3 octets |
| (Indirect,X) | `($zz,X)` | `LDA ($10,X)` | 2 octets |
| (Indirect),Y | `($zz),Y` | `STA ($10),Y` | 2 octets |
| Relatif | `label` | `BEQ LOOP` | 2 octets |

### 2.4 Timing

- **Clock :** 1 MHz (1 µs par cycle)
- **Instruction la plus courte :** 2 cycles (NOP, CLC...)
- **Instruction la plus longue :** 7 cycles (BRK, interruptions)
- **Page cross :** +1 cycle sur Absolu,X / Absolu,Y / (Indirect),Y
- **Branch taken :** +1 cycle, +2 si page cross
- **VBlank :** toutes les 16 667 µs @ 60 Hz (16 667 cycles CPU)

### 2.5 Vecteurs d'interruption

| Adresse | Nom | Déclenchement |
|---------|-----|---------------|
| `$FFFA/$FFFB` | NMI | VBlank (chaque frame) — non masquable |
| `$FFFC/$FFFD` | RESET | Démarrage machine, appui bouton RESET |
| `$FFFE/$FFFF` | IRQ | Timer programmable (via $D080) |

---

## CHAPITRE 3 — MEMORY MAP

```
$0000  ┌─────────────────────────────────┐
       │  ZERO PAGE (256 octets)         │  Accès rapide, pointeurs
       │  $0000–$000F  Réservé système   │
       │  $0010–$007F  Variables libres  │
       │  $0080–$00EF  Zone paramètres   │  Convention ABI (voir ch.7)
       │  $00F0–$00FF  Pointeurs ZP      │  8 pointeurs 16-bit
$0100  ├─────────────────────────────────┤
       │  STACK (256 octets)             │  Hardware — ne pas utiliser autrement
$0200  ├─────────────────────────────────┤
       │  RAM PROGRAMME (512 octets)     │  Variables runtime, buffers
       │  $0200–$03FF                    │
$0400  ├─────────────────────────────────┤
       │  RAM LIBRE (15 Ko)              │  Heap, données, buffers
       │  $0400–$3FFF                    │
$4000  ├─────────────────────────────────┤
       │  VRAM — VIDEO RAM (16 Ko)       │
       │  $4000–$43FF  Framebuffer A     │  Mode graphique (voir ch.4)
       │  $4400–$47FF  Framebuffer B     │  Double buffering
       │  $4800–$4BFF  Tilemap           │  Mode texte (32×32 chars)
       │  $4C00–$4FFF  Attributs couleur │  Couleur par case texte
       │  $5000–$5FFF  Sprite Data       │  8 sprites × 256 octets
       │  $6000–$6FFF  Tile ROM          │  256 tuiles 8×8 (charset)
       │  $7000–$7FFF  Palette custom    │  16 entrées RGB (non utilisé v1)
$8000  ├─────────────────────────────────┤
       │  CARTOUCHE ROM (16 Ko)          │  Code + données cartouche
       │  $8000–$BFFF                    │  (0 si pas de cartouche)
$C000  ├─────────────────────────────────┤
       │  EXPANSION (8 Ko)               │  Réservé futures extensions
       │  $C000–$CFFF                    │
$D000  ├─────────────────────────────────┤
       │  I/O REGISTERS                  │  Lecture/écriture périphériques
       │  $D000–$D0FF  VPU Registers     │  Contrôle vidéo
       │  $D100–$D1FF  SPU Registers     │  Contrôle son
       │  $D200–$D2FF  INPUT Registers   │  Clavier, pad, souris
       │  $D300–$D3FF  SYSTEM Registers  │  Timer, IRQ, config
       │  $D400–$DFFF  Réservé           │
$E000  ├─────────────────────────────────┤
       │  RAM HAUTE / POINT D'ENTRÉE     │
       │  $E000–$EFFF  RAM haute         │  Code programme principal
       │  $E000         .org par défaut  │  ← Point d'entrée RESET
$F000  ├─────────────────────────────────┤
       │  SYS ROM (4 Ko)                 │  ROM système non modifiable
       │  $F000–$F7FF  API Jump Table    │  Routines système (voir ch.8)
       │  $F800–$FFEF  Charset ROM       │  Police 8×8 intégrée (128 chars)
       │  $FFF0–$FFF9  Config Boot       │  Paramètres démarrage
       │  $FFFA/$FFFB  Vecteur NMI       │  → $F010 (handler VBlank)
       │  $FFFC/$FFFD  Vecteur RESET     │  → $E000 (point d'entrée)
       │  $FFFE/$FFFF  Vecteur IRQ       │  → $F020 (handler timer)
$10000 └─────────────────────────────────┘
```

### 3.1 Règles d'accès mémoire

| Zone | CPU | VPU | SPU | Notes |
|------|-----|-----|-----|-------|
| $0000–$3FFF | R/W | — | — | RAM normale |
| $4000–$7FFF | R/W | R/W | — | VRAM — accès concurrent possible |
| $8000–$BFFF | R | — | — | ROM cartouche — écriture ignorée |
| $D000–$DFFF | R/W | — | — | I/O — effets de bord garantis |
| $F000–$FFFF | R | — | — | ROM système — écriture ignorée |

---

## CHAPITRE 4 — SYSTÈME VIDÉO (VPU)

### 4.1 Modes vidéo

Le VPU supporte deux modes sélectionnables via `$D000` (VPU_CTRL) :

#### Mode 0 — TEXTE (défaut au boot)

- **Résolution logique :** 32 colonnes × 32 lignes = 1024 caractères
- **Taille écran physique :** 128×128 pixels (chaque char = 4×4 pixels)

```
Mémoire texte : $4800–$4BFF (1024 octets)
  Un octet = un caractère (code ASCII $20–$7F + $80–$FF custom)
  Adresse = $4800 + ligne * 32 + colonne

Attributs couleur : $4C00–$4FFF (1024 octets)
  Un octet par case : bits 7-4 = couleur fond, bits 3-0 = couleur texte
  Adresse = $4C00 + ligne * 32 + colonne

Charset : $6000–$6FFF (4096 octets)
  256 caractères × 16 octets chacun
  Chaque char = 4×4 pixels dans un masque 4-bit × 4 lignes
  Octet N : bits 7-4 = pixel ligne(N/2), col 0-3
            bits 3-0 = pixel ligne(N/2), col 4-7... (si 8px wide)
  → Version simplifiée : 4 octets par char, 1 bit par pixel, 4×4
```

**Accès texte :**
```asm
; Écrire 'A' en colonne 5, ligne 3
LDA #$41           ; 'A'
STA $4800 + 3*32 + 5   ; = $4865
; Couleur : texte blanc (1) sur fond noir (0)
LDA #$01
STA $4C00 + 3*32 + 5   ; = $4C65
```

#### Mode 1 — GRAPHIQUE

- **Résolution :** 128×128 pixels
- **Couleurs :** 16 (palette fixe, voir §4.3)
- **Format :** 2 pixels par octet (nibble packing)
- **Taille framebuffer :** 128×128 / 2 = 8192 octets ($2000)
- **Framebuffer A :** $4000–$5FFF (actif)
- **Framebuffer B :** $6000–$7FFF (backbuffer — double buffering)

**Calcul d'adresse pixel(x, y) :**
```
adresse = $4000 + y * 64 + x / 2
Si x est pair  : octet = (couleur << 4) | (octet & $0F)
Si x est impair: octet = (octet & $F0) | (couleur & $0F)
```

**Accès pixel :**
```asm
; Écrire pixel(10, 5) en couleur 7 (jaune)
; adresse = $4000 + 5*64 + 10/2 = $4000 + 320 + 5 = $4145
; x=10 est pair → nibble haut
LDA $4145
AND #$0F           ; efface nibble haut
ORA #$70           ; couleur 7 dans bits 7-4
STA $4145
```

**Via l'API (recommandé) :**
```asm
LDA #7             ; couleur
LDX #10            ; x
LDY #5             ; y
JSR DRAW_PIXEL     ; $F003
```

### 4.2 Registres VPU ($D000–$D0FF)

```
$D000  VPU_CTRL      Bits : 7=enable 1=flip_now 0=mode(0=txt/1=gfx)
$D001  VPU_BORDER    Couleur de la bordure (0–15)
$D002  VPU_SCROLL_X  Décalage horizontal (0–127, mode gfx uniquement)
$D003  VPU_SCROLL_Y  Décalage vertical   (0–127)
$D004  VPU_STATUS    Lecture : bit7=vblank en cours, bit0=frame pair/impair
$D005  VPU_SPR_CTRL  Contrôle sprites (bit0=enable, bit1=priority)
$D006  VPU_SPR_IDX   Index sprite actif (0–7)
$D007  VPU_SPR_X     Position X du sprite actif
$D008  VPU_SPR_Y     Position Y du sprite actif
$D009  VPU_SPR_FLAGS Bits: 3=visible 2=flip_h 1=flip_v 0=priority
$D00A  VPU_SPR_TILE  Numéro de tuile source (0–255)
$D00B  VPU_CURSOR_X  Colonne curseur texte (0–31)
$D00C  VPU_CURSOR_Y  Ligne curseur texte (0–31)
$D00D  VPU_INK       Couleur texte courante (0–15)
$D00E  VPU_PAPER     Couleur fond texte courante (0–15)
$D00F  VPU_CHAR_OUT  Écriture : affiche un char à la position curseur + avance
```

**$D00F VPU_CHAR_OUT — écriture directe de caractère :**
```asm
; Écrire 'Hello' sans JSR
LDA #'H' : STA $D00F
LDA #'e' : STA $D00F
LDA #'l' : STA $D00F
LDA #'l' : STA $D00F
LDA #'o' : STA $D00F
; Le curseur avance automatiquement. Newline ($0A) fait un retour chariot.
```

### 4.3 Palette de couleurs (fixe v1.0)

```
Index  Couleur           R    G    B    Hex
──────────────────────────────────────────────
  0    Noir              $00  $00  $00  #000000
  1    Blanc             $FF  $FF  $FF  #FFFFFF
  2    Rouge             $CC  $00  $00  #CC0000
  3    Cyan              $00  $CC  $CC  #00CCCC
  4    Violet/Magenta    $CC  $00  $CC  #CC00CC
  5    Vert              $00  $CC  $00  #00CC00
  6    Bleu              $00  $00  $CC  #0000CC
  7    Jaune             $CC  $CC  $00  #CCCC00
  8    Orange            $CC  $88  $00  #CC8800
  9    Brun              $88  $44  $00  #884400
 10    Rose/Saumon       $FF  $88  $88  #FF8888
 11    Gris foncé        $44  $44  $44  #444444
 12    Gris moyen        $88  $88  $88  #888888
 13    Vert clair        $88  $FF  $88  #88FF88
 14    Bleu clair        $88  $88  $FF  #8888FF
 15    Gris clair        $CC  $CC  $CC  #CCCCCC
```

### 4.4 Double buffering

```asm
; Dessiner dans le backbuffer (B), puis flipper
; Activer le mode graphique + backbuffer
LDA #%00000011     ; mode gfx, backbuffer actif
STA $D000

; ... dessiner dans $6000–$7FFF ...

; Flip : swap A ↔ B au prochain VBlank
LDA $D000
ORA #%00000010     ; bit1 = flip_now (effectif au VBlank)
STA $D000
```

---

## CHAPITRE 5 — SYSTÈME SONORE (SPU)

### 5.1 Architecture

Le SPU dispose de **3 voix** indépendantes + **1 canal sample** :

```
Voix 0 : Onde carrée   (fréquence + durée + volume + enveloppe)
Voix 1 : Onde triangle (fréquence + durée + volume + enveloppe)
Voix 2 : Bruit blanc   (registre de décalage 16-bit)
Canal 3 : 1-bit sample (PCM 8 kHz, data en RAM)
```

### 5.2 Registres SPU ($D100–$D1FF)

Chaque voix occupe 8 registres consécutifs :

```
Voix N (N = 0, 1, 2) — base = $D100 + N*8

$D100+N*8+0  SPU_FREQ_LO   Fréquence octet bas (période = 1MHz / (freq+1))
$D100+N*8+1  SPU_FREQ_HI   Fréquence octet haut
$D100+N*8+2  SPU_VOL       Volume (0–15, bits 7-4 = gauche, bits 3-0 = droit)
$D100+N*8+3  SPU_ATTACK    Durée attaque (0–15, en frames)
$D100+N*8+4  SPU_DECAY     Durée decay (0–15)
$D100+N*8+5  SPU_SUSTAIN   Niveau sustain (0–15)
$D100+N*8+6  SPU_RELEASE   Durée release (0–15, en frames)
$D100+N*8+7  SPU_CTRL      bit7=gate(1=note on) bit3-0=forme d'onde

  Formes d'onde (voix 0 et 1) :
    $01 = Carrée 50%
    $02 = Carrée 25%
    $03 = Triangle
    $04 = Sawtooth (dent de scie)
    $08 = Noise (voix 2 uniquement)
```

**Registres globaux SPU :**
```
$D118  SPU_MASTER_VOL   Volume master (0–15)
$D119  SPU_STATUS       Lecture : bit N = voix N active
$D11A  SPU_SAMPLE_LO    Adresse sample (lo) — canal 3
$D11B  SPU_SAMPLE_HI    Adresse sample (hi)
$D11C  SPU_SAMPLE_LEN   Longueur sample (256 octets × valeur)
$D11D  SPU_SAMPLE_CTRL  bit7=start bit6=loop bit0=8kHz/4kHz
```

**Jouer une note :**
```asm
; Note La 440 Hz sur voix 0 (onde carrée)
; Période = 1 000 000 / 440 = 2272 → $08E0
LDA #$E0 : STA $D100     ; fréquence lo
LDA #$08 : STA $D101     ; fréquence hi
LDA #$FF : STA $D102     ; volume max (gauche + droit)
LDA #$02 : STA $D103     ; attack = 2 frames
LDA #$04 : STA $D104     ; decay = 4 frames
LDA #$08 : STA $D105     ; sustain = niveau 8
LDA #$08 : STA $D106     ; release = 8 frames
LDA #$81 : STA $D107     ; gate=1, forme=carrée 50%
; Note ON. Pour arrêter : LDA #$01 : STA $D107 (gate=0)
```

---

## CHAPITRE 6 — I/O REGISTERS ($D200–$D3FF)

### 6.1 Clavier ($D200–$D20F)

```
$D200  KEY_ASCII     Lecture : ASCII de la touche enfoncée (0 si aucune)
$D201  KEY_STATUS    Lecture : bit7=touche enfoncée ce frame
                     Écriture : $00 = acquitter (clear)
$D202  KEY_MOD       Modificateurs : bit0=Shift bit1=Ctrl bit2=Alt
$D203  KEY_RAW       Scancode brut (indépendant de la langue)

; Codes spéciaux (KEY_RAW, valeurs > $7F)
$80 = Flèche haut    $84 = F1      $88 = Insert
$81 = Flèche bas     $85 = F2      $89 = Delete
$82 = Flèche gauche  $86 = F3      $8A = Home
$83 = Flèche droite  $87 = F4      $8B = End
```

**Lire le clavier :**
```asm
; Attendre et lire une touche
WAIT_KEY:
  LDA $D201
  BPL WAIT_KEY      ; bit7 = 0 → pas de touche
  LDA $D200         ; lire le char ASCII
  STA $00           ; stocker
  LDA #$00
  STA $D201         ; acquitter
```

### 6.2 Manette ($D210–$D21F)

```
$D210  PAD1_STATE   Manette 1 — lecture snapshot
$D211  PAD2_STATE   Manette 2 — lecture snapshot
$D212  PAD_CTRL     bit0=latch(lire maintenant)

; Bits de PAD_STATE :
; bit 7 : A        bit 3 : Droite
; bit 6 : B        bit 2 : Gauche
; bit 5 : Select   bit 1 : Bas
; bit 4 : Start    bit 0 : Haut
; bit = 0 → bouton enfoncé (logique inversée, comme la NES)
```

**Lire la manette :**
```asm
; Lire l'état de la manette 1
LDA #$01 : STA $D212   ; latch
LDA $D210              ; snapshot
STA $10                ; stocker l'état

; Tester le bouton A (bit 7)
AND #$80
BEQ BOUTON_A_PRESSE    ; 0 = enfoncé
```

### 6.3 Souris ($D220–$D22F)

```
$D220  MOUSE_X      Position X (0–127 en mode gfx, 0–31 en mode txt)
$D221  MOUSE_Y      Position Y
$D222  MOUSE_DX     Delta X depuis dernière lecture (signé, -128/+127)
$D223  MOUSE_DY     Delta Y
$D224  MOUSE_BTN    bit0=gauche bit1=droit bit2=milieu (0=enfoncé)
$D225  MOUSE_SCROLL Delta molette signé (-127/+127)
```

### 6.4 Système ($D300–$D3FF)

```
$D300  SYS_TIMER_LO  Timer 16-bit (cycles CPU), octet bas
$D301  SYS_TIMER_HI  octet haut (reset à 0 à chaque lecture de $D301)
$D302  SYS_IRQ_RATE  Fréquence IRQ : 0=désactivé, N=toutes les N*256 cycles
$D303  SYS_IRQ_CTRL  bit0=enable IRQ timer
$D304  SYS_FRAME_LO  Compteur frames (16-bit), lo
$D305  SYS_FRAME_HI  hi
$D306  SYS_RAND      Octet pseudo-aléatoire (LFSR 16-bit, nouveau à chaque lecture)
$D307  SYS_RAND_SEED Écriture : réinitialise le LFSR
$D308  SYS_RESET     Écriture $C7 → RESET logiciel
$D309  SYS_CAPS      Capacités machine (lecture seule)
                     bit0=cartouche présente
                     bit1=mode émulateur (1) / hardware (0)
                     bit2=manette 2 présente
```

---

## CHAPITRE 7 — CALLING CONVENTION & ABI

### 7.1 Principes fondamentaux

La Chuck-8 ABI définit des règles strictes pour l'interopérabilité entre
routines. Tout code conforme à la spec DOIT respecter ces règles.

```
RÈGLE 1 : A est le registre de retour.
           La valeur de A après un JSR est la valeur de retour.

RÈGLE 2 : X et Y sont des registres d'index libres.
           Une routine PEUT les modifier sans les sauvegarder.
           L'appelant doit sauvegarder X et Y s'il en a besoin.

RÈGLE 3 : La Zero Page $0080–$00EF est la zone de paramètres.
           Paramètre 0 : $0080/$0081 (lo/hi)
           Paramètre 1 : $0082/$0083
           Paramètre 2 : $0084/$0085
           Paramètre 3 : $0086/$0087
           ... (jusqu'à $00EF)

RÈGLE 4 : Les pointeurs temporaires sont en $00F0–$00FF.
           $F0/$F1 : pointeur P0  $F2/$F3 : pointeur P1
           $F4/$F5 : pointeur P2  $F6/$F7 : pointeur P3
           $F8/$F9 : pointeur P4  $FA/$FB : pointeur P5
           $FC/$FD : pointeur P6  $FE/$FF : pointeur P7
           Ces pointeurs appartiennent à la routine appelée.
           L'appelant doit les sauvegarder si besoin.

RÈGLE 5 : La pile est sacrée.
           Toute routine doit retourner avec le même SP qu'à l'entrée.
           JSR pousse 2 octets, RTS en retire 2 — équilibre garanti
           si la routine ne manipule pas SP autrement.
```

### 7.2 Passage de paramètres

**Cas 1 — Paramètre unique 8-bit → via A**
```asm
; Appel : couleur dans A
  LDA #$07           ; couleur jaune
  JSR MA_ROUTINE

MA_ROUTINE:
  ; A = couleur à l'entrée
  RTS
```

**Cas 2 — 2 ou 3 paramètres 8-bit → via A, X, Y**
```asm
; Convention : 1er=A 2ème=X 3ème=Y
  LDA #$07           ; couleur
  LDX #$10           ; x
  LDY #$08           ; y
  JSR DRAW_PIXEL_AXY
```

**Cas 3 — Paramètres larges ou nombreux → via Zone Paramètres**
```asm
; Passer (x=$0010, y=$0008, largeur=$0020, hauteur=$0010, couleur=3)
  LDA #$10 : STA $80   ; x lo
  LDA #$00 : STA $81   ; x hi
  LDA #$08 : STA $82   ; y lo
  LDA #$00 : STA $83   ; y hi
  LDA #$20 : STA $84   ; w lo
  LDA #$00 : STA $85   ; w hi
  LDA #$10 : STA $86   ; h lo
  LDA #$00 : STA $87   ; h hi
  LDA #$03             ; couleur (dans A car dernier paramètre)
  JSR DRAW_RECT
```

**Cas 4 — Valeur de retour 16-bit → A (lo) + X (hi)**
```asm
JSR RAND16             ; retourne 16-bit dans A/X
STA $10                ; lo
STX $11                ; hi
```

### 7.3 Sauvegarde des registres

```asm
MA_ROUTINE:
  ; Si j'ai besoin de X pour mon usage interne
  ; mais que l'appelant s'attend à le récupérer intact :
  ; → X N'EST PAS préservé par convention (règle 2)
  ; → L'appelant doit sauvegarder X avant JSR si besoin

  ; Si j'ai besoin de sauvegarder A (valeur courante de l'appelant)
  PHA                ; push A
  ; ... utiliser A librement ...
  PLA                ; restaurer A
  RTS
```

### 7.4 Convention de nommage des labels

```
MAJUSCULES           → labels globaux (fonctions, données publiques)
minuscules           → labels locaux (privés à une fonction)
@minuscules          → labels très locaux (boucles, branchements courts)
_UNDERSCORE_DEBUT    → labels réservés système (ne pas utiliser)

Exemples :
  DRAW_PIXEL         → fonction publique
  draw_line_clip     → fonction interne au module video
  @loop              → label de boucle locale
  _VBL_HANDLER       → routine système (ROM)
```

---

## CHAPITRE 8 — API SYSTÈME (ROM $F000–$F7FF)

La ROM contient une **jump table** : chaque entrée fait 3 octets (JMP $xxxx).
L'adresse de chaque routine est donc fixe pour toujours, même si
l'implémentation interne change.

### 8.1 Table des routines

**Vidéo :**
```
$F000  SYS_CLEAR       Efface l'écran. A=couleur (mode gfx) ou A=char (mode txt)
$F003  SYS_DRAW_PIXEL  Pixel(X,Y)=couleur A. Mode gfx uniquement.
$F006  SYS_DRAW_LINE   Ligne de ($80,$81) à ($82,$83), couleur A
$F009  SYS_DRAW_RECT   Rect x=$80 y=$81 w=$82 h=$83, couleur A (contour)
$F00C  SYS_FILL_RECT   Rect rempli (mêmes params que DRAW_RECT)
$F00F  SYS_BLIT        Copie zone : src=$80/$81 dst=$82/$83 w=$84 h=$85
$F012  SYS_DRAW_SPR    Sprite: tile=A, x=X, y=Y (8×8 pixels depuis TileROM)
$F015  SYS_SET_PIXEL   Lecture couleur pixel(X,Y) → A (non destructif)
$F018  SYS_FLIP        Swap framebuffer A↔B au prochain VBlank
$F01B  SYS_SET_MODE    Mode vidéo : A=0 (texte) A=1 (graphique)
```

**Texte :**
```
$F01E  SYS_PRINT_CHAR  Affiche char A à position curseur, avance
$F021  SYS_PRINT_STR   Affiche chaîne null-terminated à $80/$81
$F024  SYS_PRINT_NUM   Affiche entier 8-bit A en décimal à cursor
$F027  SYS_PRINT_HEX   Affiche A en hexadécimal "$XX" à cursor
$F02A  SYS_SET_CURSOR  Curseur à colonne X, ligne Y
$F02D  SYS_GET_CURSOR  Retourne col → X, ligne → Y
$F030  SYS_SET_COLOR   INK=A bits 7-4, PAPER=A bits 3-0
$F033  SYS_SCROLL_UP   Fait défiler le texte d'une ligne vers le haut
```

**Son :**
```
$F036  SYS_PLAY_NOTE   Voix=X, note MIDI=A (21–108), durée=$80 frames
$F039  SYS_STOP_VOICE  Arrête la voix X (gate=0)
$F03C  SYS_STOP_ALL    Arrête toutes les voix
$F03F  SYS_PLAY_SFX    Joue effet sonore N (banque ROM) dans voix X
$F042  SYS_SET_VOL     Volume voix X = A (0–15)
$F045  SYS_MASTER_VOL  Volume master = A (0–15)
```

**Input :**
```
$F048  SYS_READ_PAD    Lit manette A (0 ou 1) → A=état boutons
$F04B  SYS_READ_KEY    Lit clavier → A=ASCII (0 si aucune touche)
$F04E  SYS_WAIT_KEY    Bloque jusqu'à pression d'une touche → A=ASCII
$F051  SYS_READ_MOUSE  Retourne X=mouseX Y=mouseY A=boutons
$F054  SYS_KEY_DOWN    A=scancode → A=$FF si enfoncé, $00 sinon
```

**Système :**
```
$F057  SYS_WAIT_VBLANK Bloque jusqu'au prochain VBlank (sync frame)
$F05A  SYS_RAND        Retourne octet aléatoire dans A
$F05D  SYS_RAND16      Retourne 16-bit aléatoire dans A (lo) + X (hi)
$F060  SYS_MEMCPY      Copie $84/$85 octets de $80/$81 vers $82/$83
$F063  SYS_MEMSET      Remplit $82/$83 octets à partir de $80/$81 avec A
$F066  SYS_MEMCMP      Compare $84 octets à $80/$81 vs $82/$83 → Z=1 si égal
$F069  SYS_FRAME_NUM   Retourne compteur de frames 16-bit : A=lo X=hi
$F06C  SYS_RESET       Reset logiciel (équivalent bouton RESET)
$F06F  SYS_VERSION     Retourne version ROM : A=major X=minor
```

### 8.2 Note MIDI → fréquence

```
La routine SYS_PLAY_NOTE accepte des notes MIDI standard :
  21 = La0 (27.5 Hz)     69 = La4 (440 Hz)
  60 = Do4 (261.6 Hz)   108 = Do8 (4186 Hz)
La conversion en valeur registre est faite par la ROM.
```

---

## CHAPITRE 9 — STRUCTURE D'UN PROGRAMME

### 9.1 Structure minimale

```asm
; ── mon_programme.asm ────────────────────────────────────────
  .include "chuck.inc"   ; constantes et macros système
  .org $E000             ; point d'entrée standard

; ── INIT ─────────────────────────────────────────────────────
; Appelé une fois au démarrage (via vecteur RESET → $E000)
INIT:
  JSR SYS_SET_MODE_GFX   ; ou macro : SET_MODE GFX
  LDA #COLOR_BLACK
  JSR SYS_CLEAR
  ; ... initialisation ...
  ; FALL THROUGH vers MAIN_LOOP

; ── BOUCLE PRINCIPALE ────────────────────────────────────────
MAIN_LOOP:
  JSR SYS_WAIT_VBLANK    ; sync 50/60 Hz
  JSR UPDATE             ; logique
  JSR DRAW               ; rendu
  JMP MAIN_LOOP

; ── UPDATE ───────────────────────────────────────────────────
UPDATE:
  ; Lire les entrées
  LDA #0 : JSR SYS_READ_PAD
  STA PAD_STATE
  ; ... logique jeu ...
  RTS

; ── DRAW ─────────────────────────────────────────────────────
DRAW:
  ; ... dessiner le frame ...
  RTS

; ── DONNÉES ──────────────────────────────────────────────────
  .org $F800             ; section données (avant ROM)
PAD_STATE: .byte 0
```

### 9.2 Structure avec NMI (interruption VBlank)

```asm
  .include "chuck.inc"
  .org $E000

INIT:
  SEI                    ; désactive IRQ pendant l'init
  ; ... setup ...
  CLI                    ; réactive IRQ
  JMP MAIN_LOOP

; Handler NMI — appelé AUTOMATIQUEMENT à chaque VBlank
; DOIT être rapide (< 1000 cycles recommandé)
; DOIT commencer par PHA et finir par PLA + RTI
  .org $E100
NMI_HANDLER:
  PHA : TXA : PHA : TYA : PHA  ; sauvegarde registres
  ; ... tâches critiques : update sprites, flip buffer ...
  PLA : TAY : PLA : TAX : PLA  ; restaure registres
  RTI

; Déclarer le handler dans la zone RESET config ($E000–$E007)
; (la ROM lit ces adresses au démarrage pour configurer les vecteurs)
; → fait automatiquement par chuck.inc si NMI_HANDLER est défini

MAIN_LOOP:
  ; ici on peut travailler sans se soucier du timing
  JMP MAIN_LOOP
```

---

## CHAPITRE 10 — FORMAT CARTOUCHE .chuck

### 10.1 Format fichier texte

```
chuck-cartridge-1.0
title: Mon Jeu
author: Jean Dupont
version: 1.0.0
entry: $E000
nmi: $E100

--- code ---
  .include "chuck.inc"
  .org $E000
INIT:
  ...

--- data ---
  .org $EC00
SPRITES:
  .byte $00, $7E, $FF, $FF, $FF, $FF, $7E, $00
  ...

--- charset ---
; (optionnel — remplace le charset ROM pour ce programme)
  .org $6000
MY_FONT:
  ...

--- meta ---
; (commentaires libres, ignorés par l'émulateur)
; Contrôles :
;   Manette 1 : A=sauter B=tirer
;   Start : pause
```

### 10.2 Chargement d'une cartouche

Le vecteur RESET pointe vers `entry` (défaut $E000).
Si `nmi` est déclaré, le vecteur NMI pointe vers cette adresse.
Le code de la cartouche est chargé à partir de l'adresse `.org` déclarée.

---

## ANNEXE A — chuck.inc (header standard)

```asm
; ── chuck.inc — Chuck-8 System Header v1.0 ───────────────────
; À inclure en tête de tout programme Chuck-8
; .include "chuck.inc"

; ── Couleurs ─────────────────────────────────────────────────
COLOR_BLACK    = 0
COLOR_WHITE    = 1
COLOR_RED      = 2
COLOR_CYAN     = 3
COLOR_PURPLE   = 4
COLOR_GREEN    = 5
COLOR_BLUE     = 6
COLOR_YELLOW   = 7
COLOR_ORANGE   = 8
COLOR_BROWN    = 9
COLOR_PINK     = 10
COLOR_DKGRAY   = 11
COLOR_MDGRAY   = 12
COLOR_LTGREEN  = 13
COLOR_LTBLUE   = 14
COLOR_LTGRAY   = 15

; ── VPU Registres ────────────────────────────────────────────
VPU_CTRL       = $D000
VPU_BORDER     = $D001
VPU_SCROLL_X   = $D002
VPU_SCROLL_Y   = $D003
VPU_STATUS     = $D004
VPU_CURSOR_X   = $D00B
VPU_CURSOR_Y   = $D00C
VPU_INK        = $D00D
VPU_PAPER      = $D00E
VPU_CHAR_OUT   = $D00F

; ── SPU Registres ────────────────────────────────────────────
SPU_V0_FREQ_LO = $D100
SPU_V0_FREQ_HI = $D101
SPU_V0_VOL     = $D102
SPU_V0_ATK     = $D103
SPU_V0_DCY     = $D104
SPU_V0_SUS     = $D105
SPU_V0_REL     = $D106
SPU_V0_CTRL    = $D107
SPU_V1_BASE    = $D108   ; + mêmes offsets
SPU_V2_BASE    = $D110
SPU_MASTER_VOL = $D118

; ── INPUT Registres ──────────────────────────────────────────
KEY_ASCII      = $D200
KEY_STATUS     = $D201
KEY_MOD        = $D202
PAD1_STATE     = $D210
PAD2_STATE     = $D211
PAD_CTRL       = $D212
MOUSE_X        = $D220
MOUSE_Y        = $D221
MOUSE_BTN      = $D224

; ── SYSTEM Registres ─────────────────────────────────────────
SYS_RAND       = $D306
SYS_FRAME_LO   = $D304
SYS_FRAME_HI   = $D305

; ── Pad boutons (bits) ───────────────────────────────────────
PAD_A          = %10000000
PAD_B          = %01000000
PAD_SELECT     = %00100000
PAD_START      = %00010000
PAD_RIGHT      = %00001000
PAD_LEFT       = %00000100
PAD_DOWN       = %00000010
PAD_UP         = %00000001

; ── API Jump Table ───────────────────────────────────────────
SYS_CLEAR      = $F000
SYS_DRAW_PIXEL = $F003
SYS_DRAW_LINE  = $F006
SYS_DRAW_RECT  = $F009
SYS_FILL_RECT  = $F00C
SYS_BLIT       = $F00F
SYS_DRAW_SPR   = $F012
SYS_FLIP       = $F018
SYS_SET_MODE   = $F01B
SYS_PRINT_CHAR = $F01E
SYS_PRINT_STR  = $F021
SYS_PRINT_NUM  = $F024
SYS_PRINT_HEX  = $F027
SYS_SET_CURSOR = $F02A
SYS_GET_CURSOR = $F02D
SYS_SET_COLOR  = $F030
SYS_SCROLL_UP  = $F033
SYS_PLAY_NOTE  = $F036
SYS_STOP_VOICE = $F039
SYS_STOP_ALL   = $F03C
SYS_SET_VOL    = $F042
SYS_READ_PAD   = $F048
SYS_READ_KEY   = $F04B
SYS_WAIT_KEY   = $F04E
SYS_READ_MOUSE = $F051
SYS_KEY_DOWN   = $F054
SYS_WAIT_VBLANK= $F057
SYS_RAND_API   = $F05A
SYS_MEMCPY     = $F060
SYS_MEMSET     = $F063
SYS_FRAME_NUM  = $F069

; ── Zone mémoire ─────────────────────────────────────────────
ZP_PARAMS      = $0080    ; zone paramètres ABI
ZP_PTR0        = $00F0    ; pointeur 0 (lo/hi)
ZP_PTR1        = $00F2
ZP_PTR2        = $00F4
ZP_PTR3        = $00F6

FRAMEBUF_A     = $4000
FRAMEBUF_B     = $6000
VRAM_TEXT      = $4800
VRAM_ATTR      = $4C00
VRAM_SPRITES   = $5000
VRAM_TILES     = $6000

; ── Macros ───────────────────────────────────────────────────

; SET_COLOR ink, paper
.macro SET_COLOR ink, paper
  LDA #((.ink << 4) | .paper)
  JSR SYS_SET_COLOR
.endmacro

; CURSOR col, row
.macro CURSOR col, row
  LDX #.col
  LDY #.row
  JSR SYS_SET_CURSOR
.endmacro

; PRINT string_label
.macro PRINT str
  LDA #<.str
  STA ZP_PARAMS
  LDA #>.str
  STA ZP_PARAMS+1
  JSR SYS_PRINT_STR
.endmacro

; PIXEL x, y, color
.macro PIXEL x, y, color
  LDA #.color
  LDX #.x
  LDY #.y
  JSR SYS_DRAW_PIXEL
.endmacro

; WAIT_PAD pad_number
.macro WAIT_PAD num
  LDA #.num
  JSR SYS_READ_PAD
.endmacro

; PAD_PRESSED button_mask (teste le résultat de READ_PAD dans A)
; Positionne Z=1 si le bouton EST enfoncé (logique inversée hardware)
.macro PAD_PRESSED btn
  EOR #$FF         ; inverse (0=enfoncé → 1=enfoncé)
  AND #.btn
.endmacro
```

---

## ANNEXE B — EXEMPLE COMPLET : PONG MINIMAL

```asm
; pong.asm — Démo Chuck-8 : balle rebondissante + raquette
  .include "chuck.inc"
  .org $E000

; ── Variables ────────────────────────────────────────────────
  .segment "BSS"          ; (ou .org $0200 pour variables)
BALL_X:   .byte 0
BALL_Y:   .byte 0
BALL_DX:  .byte 0        ; +1 ou $FF (-1)
BALL_DY:  .byte 0
PAD_Y:    .byte 0
SCORE:    .byte 0

; ── Init ─────────────────────────────────────────────────────
  .org $E000
INIT:
  LDA #1 : JSR SYS_SET_MODE   ; mode graphique
  LDA #COLOR_BLACK : JSR SYS_CLEAR

  ; Position initiale balle
  LDA #64 : STA BALL_X
  LDA #64 : STA BALL_Y
  LDA #1  : STA BALL_DX
  LDA #1  : STA BALL_DY
  LDA #56 : STA PAD_Y          ; raquette au centre

MAIN_LOOP:
  JSR SYS_WAIT_VBLANK          ; sync frame

  ; ── INPUT ────────────────────────────────────────────────
  LDA #0 : JSR SYS_READ_PAD
  STA $10                       ; état manette

  ; Déplacer raquette (haut/bas)
  LDA $10 : EOR #$FF : AND #PAD_UP
  BEQ @no_up
  LDA PAD_Y : BEQ @no_up
  DEC PAD_Y
@no_up:
  LDA $10 : EOR #$FF : AND #PAD_DOWN
  BEQ @no_down
  LDA PAD_Y : CMP #118 : BCS @no_down
  INC PAD_Y
@no_down:

  ; ── UPDATE BALLE ─────────────────────────────────────────
  ; Effacer
  LDA #COLOR_BLACK
  LDX BALL_X : LDY BALL_Y : JSR SYS_DRAW_PIXEL

  ; Déplacer
  LDA BALL_X : CLC : ADC BALL_DX : STA BALL_X
  LDA BALL_Y : CLC : ADC BALL_DY : STA BALL_Y

  ; Rebond bords haut/bas
  LDA BALL_Y : BEQ @flip_dy
  CMP #127   : BEQ @flip_dy
  JMP @no_flip_dy
@flip_dy:
  LDA #0 : SEC : SBC BALL_DY : STA BALL_DY
@no_flip_dy:

  ; Rebond bord droit
  LDA BALL_X : CMP #127 : BNE @no_right
  LDA #0 : SEC : SBC BALL_DX : STA BALL_DX
@no_right:

  ; Collision raquette (x=8, y=PAD_Y à PAD_Y+10)
  LDA BALL_X : CMP #8 : BNE @no_pad
  LDA BALL_Y : CMP PAD_Y : BCC @no_pad
  LDA BALL_Y : LDX PAD_Y : TXA : CLC : ADC #10 : CMP BALL_Y : BCC @no_pad
  LDA #0 : SEC : SBC BALL_DX : STA BALL_DX
@no_pad:

  ; Sortie à gauche → reset
  LDA BALL_X : BNE @no_reset
  LDA #64 : STA BALL_X
  LDA #64 : STA BALL_Y
@no_reset:

  ; ── DRAW ─────────────────────────────────────────────────
  ; Balle
  LDA #COLOR_WHITE
  LDX BALL_X : LDY BALL_Y : JSR SYS_DRAW_PIXEL

  ; Raquette (ligne verticale x=8, y=PAD_Y à PAD_Y+10)
  LDA #COLOR_WHITE
  LDX #8
  LDY PAD_Y
@draw_pad:
  JSR SYS_DRAW_PIXEL
  INY
  TYA : SEC : SBC PAD_Y : CMP #10 : BCC @draw_pad

  JMP MAIN_LOOP
```

---

## ANNEXE C — TABLEAU DE RÉFÉRENCE RAPIDE

```
ADRESSES CLÉS
─────────────────────────────────────────
$0010–$007F    Variables utilisateur (ZP)
$0080–$00EF    Paramètres ABI (ZP)
$00F0–$00FF    Pointeurs (ZP)
$0200–$03FF    RAM programme
$4000–$5FFF    Framebuffer A (graphique)
$4800–$4BFF    Mémoire texte
$4C00–$4FFF    Attributs couleur texte
$6000–$7FFF    Framebuffer B / TileROM
$D000          VPU_CTRL
$D200          KEY_ASCII
$D210          PAD1_STATE
$D220          MOUSE_X
$D306          SYS_RAND
$E000          Point d'entrée programme
$F000–$F06F    Jump table API
$FFFA–$FFFF    Vecteurs NMI/RESET/IRQ

INSTRUCTIONS LES PLUS UTILES
─────────────────────────────────────────
LDA #val       A ← val (immédiat)
STA addr       mem[addr] ← A
LDX / LDY      Charger X ou Y
TAX/TAY/TXA/TYA Transferts entre registres
PHA / PLA      Sauvegarder / restaurer A
CLC : ADC #n   A ← A + n (propre)
SEC : SBC #n   A ← A - n (propre)
CMP #val       Compare A (N, Z, C)
BEQ / BNE      Sauter si égal / non égal
BCC / BCS      Sauter si < ou >=
JSR addr       Appel de routine
RTS            Retour de routine
JMP addr       Saut inconditionnel
INX/INY/DEX/DEY Incrément/décrément X ou Y
```

---

*Chuck-8 Computer System Specification v1.0*
*Ce document est la référence canonique de la plateforme.*
*Toute implémentation (émulateur ou hardware) doit s'y conformer.*