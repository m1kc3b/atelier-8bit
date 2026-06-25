# CHUCK-8 **Computer System Specification  —  v1.2.1
## Version 1.2.1 — Corrigée & Révisée*


```
  ██████╗██╗  ██╗██╗   ██╗ ██████╗██╗  ██╗      █████╗
 ██╔════╝██║  ██║██║   ██║██╔════╝██║ ██╔╝     ██╔══██╗
 ██║     ███████║██║   ██║██║     █████╔╝      ╚█████╔╝
 ██║     ██╔══██║██║   ██║██║     ██╔═██╗      ██╔══██╗
 ╚██████╗██║  ██║╚██████╔╝╚██████╗██║  ██╗     ╚█████╔╝
  ╚═════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝╚═╝  ╚═╝     ╚════╝
  C O M P U T E R   S Y S T E M   S P E C I F I C A T I O N
```


Révision : 1.2.1

Statut : Reference Document

*Modifications v1.2 → v1.2.1 : 4 corrections vérifiées contre le moteur réel chuck-core (macro SET_COLOR, démo Pong réécrite, idiomes garde-frame / piège du drapeau Z / effacement avant déplacement)*

# **CHANGELOG v1.0 → v1.1**

*Les corrections suivantes ont été apportées par rapport à la version 1.0-DRAFT.*

| **#** | **Sévérité** | **Problème corrigé**                                                         |
| ----- | ------------ | ---------------------------------------------------------------------------- |
| 1     | Critique     | Framebuffer A : carte mémoire déclarait 1 Ko au lieu de 8 Ko                 |
| 2     | Critique     | Zones texte/sprites dans Framebuffer A : chevauchement documenté et clarifié |
| 3     | Critique     | Collision $6000 Framebuffer B / Tile ROM / Charset : alias expliqué          |
| 4     | Critique     | Expansion : « 8 Ko » corrigé en 4 Ko ($C000–$CFFF)                           |
| 5     | Critique     | ROM : $F080–$F7FF (corps des routines) documenté                             |
| 6     | Critique     | VPU_CTRL : tous les bits 0–7 définis précisément                             |
| 7     | Critique     | Macros ca65 : .param → param (syntaxe correcte)                              |
| 8     | Critique     | Macros ca65 : << → .shl() (opérateur ca65 valide)                            |
| 9     | Critique     | .byte en BSS → .res (réservation sans émission)                              |
| 10    | Critique     | Double .org $E000 : variables déplacées en $0200                             |
| 11    | Important    | chuck.inc : SYS_FLIP et 11 autres routines ajoutées                          |
| 12    | Important    | SYS_RAND : collision nom registre/API résolue (→ SYS_GET_RAND)               |
| 13    | Important    | chuck.inc : MOUSE_DX / MOUSE_DY / MOUSE_SCROLL ajoutés                       |
| 14    | Important    | SYS_SET_COLOR : convention INK/PAPER alignée avec format attribut            |
| 15    | Important    | SYS_MEMSET : paramètre destination explicité                                 |
| 16    | Important    | Pong : logique rebond/reset balle corrigée                                   |
| 17    | Important    | VPU_CTRL bit 1 : comportement auto-clear documenté                           |
| 18    | Incohérence  | Charset : format unique 8 octets/char 8×8 retenu                             |
| 19    | Incohérence  | Mode texte : taille caractère fixée à 4×4 px (4 oct/char)                    |
| 20    | Incohérence  | .org $F800 dans exemple → .org $EC00 (RAM haute)                             |
| 21    | Incohérence  | chuck.inc : registres SPU sample ajoutés                                     |
| 22    | Incohérence  | Macro WAIT_PAD renommée READ_PAD_MACRO                                       |
| 23    | Mineur       | JMP ($FFFE) → JMP ($0080) comme exemple indirect                             |
| 24    | Mineur       | Registre P : « 7 flags + 1 bit constant » précisé                            |
| 25    | Mineur       | VBlank PAL (20 000 cycles) documenté                                         |
| 26    | Conformité   | SYS_SET_MODE_GFX → SYS_SET_MODE corrigé dans exemples                        |
| 27    | Conformité   | Bus : « bus données 8-bit / bus adresses 16-bit » précisé                    |
| 28    | Conformité   | DRAW_PIXEL → SYS_DRAW_PIXEL dans exemple §4.1                                |

---

# **CHANGELOG v1.1 → v1.2**

*Corrections de cohérence interne : le document v1.1 affirmait dans son changelog avoir unifié certaines valeurs, mais des valeurs divergentes coexistaient encore selon les chapitres. v1.2 tranche définitivement.*

| **#** | **Sévérité** | **Problème corrigé**                                                                       |
| ----- | ------------ | ------------------------------------------------------------------------------------------ |
| 1     | Critique     | Glyphe texte : valeur unique fixée à **8×8 px (8 oct/char)** partout (ch.1 disait 4×4)     |
| 2     | Critique     | Grille texte : **16×16 caractères** (8×8 px sur écran 128×128), remplace 32×32 incohérent  |
| 3     | Critique     | Mémoire texte : **$4800–$48FF (256 oct)** et attributs **$4900–$49FF** (16×16 = 256 cases) |
| 4     | Critique     | Charset ROM : adresse unique **$F800–$FFEF** (ROM système). $6000 réservé Framebuffer B    |
| 5     | Important    | Décompte jump table : **38 entrées** ($F000–$F071, pas de 3), « 37×3=111 » corrigé en « 38×3=114 » |
| 6     | Important    | Curseur texte VPU_CURSOR_X/Y : plage **0–15** (16 colonnes/lignes), remplace 0–31          |
| 7     | Important    | MOUSE_X/Y en mode texte : plage **0–15**, remplace 0–31                                     |
| 8     | Mineur       | Exemple SYS_PLAY_NOTE : ordre des registres clarifié (note dans A en dernier avant JSR)     |

---

# **CHANGELOG v1.2 → v1.2.1**

*Corrections vérifiées par assemblage et exécution contre le moteur réel chuck-core (assembleur + CPU + I/O). Chaque point a été reproduit puis revalidé.*

| **#** | **Sévérité** | **Problème corrigé**                                                                                          |
| ----- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| 1     | Critique     | Macro SET_COLOR : `.shl()` **et** `<<` rejetés par l'assembleur (« `)` attendu »). CORRIGÉ : multiplication `* 16` |
| 2     | Critique     | Démo Pong (Annexe B) : entrée via `SYS_READ_PAD` impilotable au clavier → remplacée par `SYS_KEY_DOWN`         |
| 3     | Critique     | Démo Pong : raquette dessinée en boucle pixel — `TYA` écrasait la couleur (dégradé arc-en-ciel). CORRIGÉ : bloc `SYS_FILL_RECT` |
| 4     | Critique     | Démo Pong : `SYS_WAIT_VBLANK` ne bloque pas → boucle ×milliers/frame (raquette trop rapide, traînée balle). CORRIGÉ : garde-frame `SYS_FRAME_NUM` + effacement avant déplacement |

---

# PRÉAMBULE

Le Chuck-8 est un ordinateur personnel 8-bit imaginaire à vocation pédagogique. Sa conception s'inspire directement des machines des années 1975–1985 (Apple II, Commodore 64, Atari 800) tout en restant cohérente et accessible.

### Philosophie

Fidélité au 6502 original — pas d'extensions, pas de raccourcis

Règles fixes et documentées — la machine ne change pas

Constructible en hardware — chaque décision est motivée par la faisabilité réelle

Pédagogique avant tout — comprendre pourquoi, pas seulement comment

# CHAPITRE 1 — VUE D'ENSEMBLE

## 1.1 Caractéristiques principales

| **Composant**   | **Spécification**                                                       |
| --------------- | ----------------------------------------------------------------------- |
| CPU             | MOS 6502 (1 MHz simulé)                                                 |
| RAM             | 64 Ko (65 536 octets)                                                   |
| ROM système     | 4 Ko ($F000–$FFFF) — API + vecteurs                                     |
| Vidéo           | 128×128 pixels, 16 couleurs, 2 modes                                    |
| VRAM            | 16 Ko ($4000–$7FFF)                                                     |
| Texte           | 16×16 caractères, glyphes 8×8 px                                        |
| Son             | 3 voix (carrée + triangle + bruit), 1 canal sample                      |
| Clavier         | ASCII complet + touches spéciales                                       |
| Manette         | 2 × 8 boutons (compatible NES)                                          |
| Souris          | X/Y + 3 boutons + molette                                               |
| Cartouche       | 16 Ko max ($8000–$BFFF)                                                 |
| Fréquence CPU   | 1 MHz (1 000 000 cycles/seconde)                                        |
| Framerate cible | 50 Hz (PAL) = 20 000 cycles/frame ou 60 Hz (NTSC) = 16 667 cycles/frame |

## 1.2 Blocs fonctionnels

| **⚠️  ATTENTION : ** Le bus d'adresses est 16-bit (capacité 64 Ko). Le bus de données est 8-bit. Les deux composent le « bus principal ». |
| ----------------------------------------------------------------------------------------------------------------------------------------- |

┌────────────────────────────────────────────────────────────┐
│         BUS DONNÉES 8-bit / BUS ADRESSES 16-bit            │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────┐  │
│  │  6502    │  │  64 Ko   │  │  I/O Chip (virtuel)      │  │
│  │  CPU     │  │  RAM     │  │  $D000–$D0FF VPU regs    │  │
│  │  1 MHz   │  │          │  │  $D100–$D1FF SPU regs    │  │
│  └──────────┘  └──────────┘  │  $D200–$D3FF Input/Sys   │  │
│                              └──────────────────────────┘  │
│  ┌──────────────────────────┐  ┌─────────────────────────┐ │
│  │  VPU (Video)             │  │ SPU (Sound)             │ │
│  │  $4000–$5FFF Framebuf A  │  │ 3 voix + enveloppe ADSR │ │
│  │  $6000–$7FFF Framebuf B  │  │ 1 canal sample PCM      │ │
│  │  (alias texte/sprites)   │  └─────────────────────────┘ │
│  └──────────────────────────┘                              │
│  ┌──────────────────────────┐  ┌─────────────────────────┐ │
│  │  CART ROM (optionnel)    │  │  SYS ROM                │ │
│  │  $8000–$BFFF 16 Ko       │  │  $F000–$FFFF 4 Ko       │ │
│  └──────────────────────────┘  └─────────────────────────┘ │
└────────────────────────────────────────────────────────────┘

# CHAPITRE 2 — CPU : MOS 6502

## 2.1 Registres

| **Registre** | **Taille** | **Description**                                                  |
| ------------ | ---------- | ---------------------------------------------------------------- |
| A            | 8 bits     | Accumulateur — toutes les opérations arithmétiques               |
| X            | 8 bits     | Index — adressage indexé, compteurs                              |
| Y            | 8 bits     | Index — adressage indexé, compteurs                              |
| PC           | 16 bits    | Program Counter — adresse de la prochaine instruction            |
| SP           | 8 bits     | Stack Pointer — pointe dans $0100–$01FF (décroit)                |
| P            | 8 bits     | Processor Status — 7 flags + 1 bit constant (bit 5 = toujours 1) |

## 2.2 Flags (registre P)

| **✅ CORRECTION : ** Le registre P comporte 7 flags actifs + 1 bit constant (bit 5 toujours à 1, jamais modifiable par programme). |
| --------------------------------------------------------------------------------------------------------------------------------- |

Bit : 7  6  5  4  3  2  1  0
      N  V  1  B  D  I  Z  C

      │  │  │  │  │  │  │  └── Carry

      │  │  │  │  │  │  └───── Zero

      │  │  │  │  │  └──────── Interrupt Disable

      │  │  │  │  └─────────── Decimal (BCD — actif mais rarement utilisé)

      │  │  │  └────────────── Break (positionné par BRK, pas par IRQ)

      │  │  └───────────────── Toujours 1 (bit constant, non modifiable)

      │  └──────────────────── oVerflow

      └─────────────────────── Negative

## 2.3 Modes d'adressage supportés (13 modes)

| **Mode**     | **Syntaxe ca65** | **Exemple** | **Taille** |
| ------------ | ---------------- | ----------- | ---------- |
| Implicite    | —                | CLC         | 1 octet    |
| Accumulateur | A                | ASL A       | 1 octet    |
| Immédiat     | #val             | LDA #$42    | 2 octets   |
| Zero Page    | $zz              | LDA $10     | 2 octets   |
| Zero Page,X  | $zz,X            | LDA $10,X   | 2 octets   |
| Zero Page,Y  | $zz,Y            | LDX $10,Y   | 2 octets   |
| Absolu       | $xxxx            | LDA $1234   | 3 octets   |
| Absolu,X     | $xxxx,X          | LDA $1234,X | 3 octets   |
| Absolu,Y     | $xxxx,Y          | LDA $1234,Y | 3 octets   |
| Indirect     | ($xxxx)          | JMP ($0080) | 3 octets   |
| (Indirect,X) | ($zz,X)          | LDA ($10,X) | 2 octets   |
| (Indirect),Y | ($zz),Y          | STA ($10),Y | 2 octets   |
| Relatif      | label            | BEQ LOOP    | 2 octets   |

| **⚠️  ATTENTION : ** Note sur l'exemple Indirect : JMP ($FFFE) est volontairement évité comme exemple pédagogique car $FFFE est le vecteur IRQ. JMP ($0080) utilise un pointeur en Zero Page, usage le plus courant. |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

## 2.4 Timing

| **Condition**                    | **Cycles**                         |
| -------------------------------- | ---------------------------------- |
| Clock                            | 1 MHz (1 µs par cycle)             |
| Instruction la plus courte       | 2 cycles (NOP, CLC, SEC…)          |
| Instruction la plus longue       | 7 cycles (BRK, RTI, interruptions) |
| Page cross (Absolu,X/Y, (Ind),Y) | + 1 cycle                          |
| Branch taken (même page)         | + 1 cycle                          |
| Branch taken (page cross)        | + 2 cycles                         |
| VBlank @ 60 Hz (NTSC)            | 16 667 cycles (16 667 µs)          |
| VBlank @ 50 Hz (PAL)             | 20 000 cycles (20 000 µs)          |

## 2.5 Vecteurs d'interruption

| **Adresse** | **Nom** | **Déclenchement**                                        |
| ----------- | ------- | -------------------------------------------------------- |
| $FFFA/$FFFB | NMI     | VBlank (chaque frame) — non masquable, → $F010           |
| $FFFC/$FFFD | RESET   | Démarrage machine, bouton RESET, → $E000                 |
| $FFFE/$FFFF | IRQ     | Timer programmable (via $D302/$D303) — masquable par SEI |

# CHAPITRE 3 — MEMORY MAP

| **⛔ ERREUR CORRIGÉE : **v1.0 : Framebuffer A déclaré $4000–$43FF (1 Ko). CORRIGÉ : $4000–$5FFF (8 192 octets = 128×128/2). |
| -------------------------------------------------------------------------------------------------------------------------- |

| **⛔ ERREUR CORRIGÉE : **v1.0 : L'Expansion était déclarée « 8 Ko ». CORRIGÉ : $C000–$CFFF = 4 Ko. |
| ------------------------------------------------------------------------------------------------- |

| **✅ CORRECTION : **Les zones texte ($4800), attributs ($4900) et sprites ($5000) sont des alias dans la plage VRAM ($4000–$5FFF). En mode texte, le VPU lit $4800/$4900. En mode graphique, le VPU lit $4000 comme framebuffer. Ces zones sont physiquement les mêmes octets, mais leur interprétation est commandée par VPU_CTRL bit 0. |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

$0000  ┌─────────────────────────────────────────────────────┐
       │  ZERO PAGE (256 octets)                            │

       │  $0000–$000F  Réservé système                      │

       │  $0010–$007F  Variables libres utilisateur         │

       │  $0080–$00EF  Zone paramètres ABI (voir ch.7)      │

       │  $00F0–$00FF  Pointeurs ZP (8 × 16-bit)            │

$0100  ├─────────────────────────────────────────────────────┤
       │  STACK (256 octets)                                │

       │  $0100–$01FF  Hardware — ne jamais utiliser autrement│

$0200  ├─────────────────────────────────────────────────────┤
       │  RAM PROGRAMME (512 octets)                        │

       │  $0200–$03FF  Variables runtime, buffers courts    │

$0400  ├─────────────────────────────────────────────────────┤
       │  RAM LIBRE (15 Ko)                                 │

       │  $0400–$3FFF  Heap, données, buffers               │

$4000  ├─────────────────────────────────────────────────────┤
       │  VRAM — VIDEO RAM (16 Ko)                          │

       │  ┌─ MODE GRAPHIQUE (VPU_CTRL bit0=1) ──────────┐  │

       │  │  $4000–$5FFF  Framebuffer A (8 192 octets)  │  │

       │  │  $6000–$7FFF  Framebuffer B (8 192 octets)  │  │

       │  └─────────────────────────────────────────────┘  │

       │  ┌─ MODE TEXTE (VPU_CTRL bit0=0) ─────────────┐  │

       │  │  $4800–$48FF  Mémoire texte 16×16 chars    │  │

       │  │  $4900–$49FF  Attributs couleur texte      │  │

       │  │  $5000–$5FFF  Sprite Data (8 sprites)      │  │

       │  └─────────────────────────────────────────────┘  │

$8000  ├─────────────────────────────────────────────────────┤
       │  CARTOUCHE ROM (16 Ko)                             │

       │  $8000–$BFFF  Code + données cartouche            │

$C000  ├─────────────────────────────────────────────────────┤
       │  EXPANSION (4 Ko)                                  │

       │  $C000–$CFFF  Réservé futures extensions           │

$D000  ├─────────────────────────────────────────────────────┤
       │  I/O REGISTERS (4 Ko)                              │

       │  $D000–$D0FF  VPU Registers                       │

       │  $D100–$D1FF  SPU Registers                       │

       │  $D200–$D2FF  INPUT Registers (clavier/pad/souris) │

       │  $D300–$D3FF  SYSTEM Registers (timer/IRQ/config)  │

       │  $D400–$DFFF  Réservé                             │

$E000  ├─────────────────────────────────────────────────────┤
       │  RAM HAUTE / POINT D'ENTRÉE (4 Ko)                │

       │  $E000–$EFFF  Code programme principal             │

       │  $E000         .org par défaut (point RESET)       │

$F000  ├─────────────────────────────────────────────────────┤
       │  SYS ROM (4 Ko) — lecture seule                   │

       │  $F000–$F071  API Jump Table (38 entrées × 3 oct.) │

       │  $F072–$F07F  Réservé extensions API              │

       │  $F080–$F7FF  Corps des routines ROM              │

       │  $F800–$FFEF  Charset ROM (police 8×8, 128 chars) │

       │  $FFF0–$FFF9  Config Boot (réservé)               │

       │  $FFFA/$FFFB  Vecteur NMI  → $F010               │

       │  $FFFC/$FFFD  Vecteur RESET → $E000               │

       │  $FFFE/$FFFF  Vecteur IRQ  → $F020                │

$10000 └─────────────────────────────────────────────────────┘

## 3.1 Règles d'accès mémoire

| **Zone**    | **CPU** | **VPU** | **SPU** | **Notes**                                                        |
| ----------- | ------- | ------- | ------- | ---------------------------------------------------------------- |
| $0000–$3FFF | R/W     | —       | —       | RAM normale                                                      |
| $4000–$7FFF | R/W     | R/W     | —       | VRAM — accès concurrent possible (mode détermine interprétation) |
| $8000–$BFFF | R       | —       | —       | ROM cartouche — écriture ignorée                                 |
| $D000–$DFFF | R/W     | —       | —       | I/O — effets de bord garantis                                    |
| $F000–$FFFF | R       | —       | —       | ROM système — écriture ignorée                                   |

## 3.2 Alias VRAM — règle des modes

| **✅ CORRECTION : **La même RAM physique $4000–$7FFF est interprétée différemment selon VPU_CTRL bit 0. Le programmeur n'utilise jamais les deux modes simultanément sur la même zone. |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

| **Adresse physique** | **Mode TEXTE (bit0=0)**                     | **Mode GFX (bit0=1)** |
| -------------------- | ------------------------------------------- | --------------------- |
| $4000–$4FFF          | Tilemap $4800 + Attributs $4900 (sous-zone) | Framebuffer A (début) |
| $5000–$5FFF          | Sprite Data (8 sprites × 256 oct.)          | Framebuffer A (fin)   |
| $6000–$6FFF          | Tiles custom optionnels (mode txt)          | Framebuffer B (début) |
| $7000–$7FFF          | Réservé                                     | Framebuffer B (fin)   |

# CHAPITRE 4 — SYSTÈME VIDÉO (VPU)

## 4.1 Modes vidéo

Le VPU supporte deux modes sélectionnables via $D000 (VPU_CTRL) :

### Mode 0 — TEXTE (défaut au boot)

| **Paramètre**         | **Valeur**                                      |
| --------------------- | ----------------------------------------------- |
| Résolution logique    | 16 colonnes × 16 lignes = 256 caractères        |
| Taille écran physique | 128×128 pixels                                  |
| Taille d'un caractère | 8×8 pixels (8 octets/char, 1 bit/pixel)         |
| Mémoire texte         | $4800–$48FF (256 octets)                        |
| Attributs couleur     | $4900–$49FF (256 octets)                        |
| Charset               | $F800–$FFEF (1 024 octets) — ROM système        |

| **✅ CORRECTION : **v1.1 affichait des formats contradictoires (4×4 dans ce chapitre, 8×8 ailleurs). CORRIGÉ v1.2 : format unique = 8 octets/char, 1 bit/pixel, grille 8×8 pixels. 128 chars × 8 oct = 1 024 octets, stockés en ROM système $F800–$FFEF. Sur écran 128×128 px cela donne 16×16 caractères. |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

Format charset (Mode texte) :

  1 caractère = 8 octets, 1 bit = 1 pixel (bi-level), grille 8×8

  Octet 0 : ligne 0 — bit7=col0 … bit0=col7

  Octet 1 : ligne 1

  …

  Octet 7 : ligne 7

Mémoire texte : $4800–$48FF (256 octets)

  1 octet = 1 caractère (code ASCII $20–$7F + $80–$FF custom)

  Adresse = $4800 + ligne * 16 + colonne

Attributs couleur : $4900–$49FF (256 octets)

  1 octet par case : bits 7-4 = couleur fond (PAPER), bits 3-0 = couleur texte (INK)

  Adresse = $4900 + ligne * 16 + colonne

Accès texte en assembleur :

; Écrire 'A' en colonne 5, ligne 3

LDA #$41           ; 'A'

STA $4835          ; $4800 + 3*16 + 5 = $4835

; Couleur : INK blanc (1) sur PAPER noir (0) → %00000001

LDA #%00000001     ; bits 7-4=PAPER=0, bits 3-0=INK=1

STA $4935          ; $4900 + 3*16 + 5 = $4935

### Mode 1 — GRAPHIQUE

| **Paramètre**      | **Valeur**                                                                          |
| ------------------ | ----------------------------------------------------------------------------------- |
| Résolution         | 128×128 pixels                                                                      |
| Couleurs           | 16 (palette fixe, voir §4.3)                                                        |
| Format             | 2 pixels par octet (nibble packing, pixel pair = bits 7-4, pixel impair = bits 3-0) |
| Taille framebuffer | 128×128 / 2 = 8 192 octets ($2000)                                                  |
| Framebuffer A      | $4000–$5FFF (actif par défaut)                                                      |
| Framebuffer B      | $6000–$7FFF (backbuffer double buffering)                                           |

Calcul d'adresse pixel(x, y) :

adresse = $4000 + y * 64 + x / 2     (division entière)

Si x est pair  : octet = (couleur << 4) | (octet & $0F)   ← nibble haut

Si x est impair: octet = (octet & $F0) | (couleur & $0F)  ← nibble bas

Exemple — écrire pixel(10, 5) en couleur 7 (jaune) :

; adresse = $4000 + 5*64 + 10/2 = $4000 + 320 + 5 = $4145

; x=10 est pair → nibble haut (bits 7-4)

LDA $4145

AND #$0F           ; efface nibble haut

ORA #$70           ; couleur 7 dans bits 7-4

STA $4145

Via l'API (recommandé) :

LDA #7             ; couleur

LDX #10            ; x

LDY #5             ; y

JSR SYS_DRAW_PIXEL ; $F003

## 4.2 Registres VPU ($D000–$D0FF)

| **⛔ ERREUR CORRIGÉE : **v1.0 : VPU_CTRL ne documentait que bits 7, 1, 0. CORRIGÉ : tous les bits 0–7 sont définis. |
| ------------------------------------------------------------------------------------------------------------------ |

| **⛔ ERREUR CORRIGÉE : **v1.0 : bit 1 présenté tantôt comme 'flip_now' tantôt comme 'backbuffer actif'. CORRIGÉ : bit 1 = flip_request (auto-clear après VBlank). |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |

$D000  VPU_CTRL
         bit 7 : vpu_enable   — 0=VPU désactivé (écran noir), 1=actif

         bit 6 : nmi_enable   — 1=NMI déclenché à chaque VBlank

         bit 5 : sprite_en    — 1=affichage sprites activé

         bit 4 : scroll_en    — 1=scroll matériel actif

         bit 3 : réservé      — écrire 0

         bit 2 : réservé      — écrire 0

         bit 1 : flip_request — écrire 1 pour demander swap A↔B au prochain VBlank

                               AUTO-CLEAR après le swap (repasse à 0 automatiquement)

         bit 0 : mode         — 0=texte, 1=graphique

$D001  VPU_BORDER    Couleur de bordure (0–15)

$D002  VPU_SCROLL_X  Décalage horizontal (0–127, mode gfx uniquement)

$D003  VPU_SCROLL_Y  Décalage vertical   (0–127)

$D004  VPU_STATUS    Lecture : bit7=vblank en cours, bit1=buffer actif (0=A, 1=B),
                              bit0=frame pair/impair

$D005  VPU_SPR_CTRL  Contrôle sprites (bit0=enable, bit1=priority over background)

$D006  VPU_SPR_IDX   Index sprite actif (0–7)

$D007  VPU_SPR_X     Position X du sprite actif

$D008  VPU_SPR_Y     Position Y du sprite actif

$D009  VPU_SPR_FLAGS Bits: bit3=visible bit2=flip_h bit1=flip_v bit0=priority

$D00A  VPU_SPR_TILE  Numéro de tuile source (0–255)

$D00B  VPU_CURSOR_X  Colonne curseur texte (0–15)

$D00C  VPU_CURSOR_Y  Ligne curseur texte (0–15)

$D00D  VPU_INK       Couleur texte courante (0–15)

$D00E  VPU_PAPER     Couleur fond texte courante (0–15)

$D00F  VPU_CHAR_OUT  Écriture : affiche char à position curseur + avance curseur
                    Newline ($0A) = retour chariot. Wrap automatique col 15 → 0.

### $D00F VPU_CHAR_OUT — écriture directe

LDA #'H' : STA $D00F

LDA #'e' : STA $D00F

LDA #'l' : STA $D00F

LDA #'l' : STA $D00F

LDA #'o' : STA $D00F

; Le curseur avance automatiquement.

## 4.3 Palette de couleurs (fixe v1.0)

| **Index** | **Constante** | **Couleur** | **R** | **G** | **B** | **Hex** |
| --------- | ------------- | ----------- | ----- | ----- | ----- | ------- |
| 0         | COLOR_BLACK   | Noir        | $00   | $00   | $00   | #000000 |
| 1         | COLOR_WHITE   | Blanc       | $FF   | $FF   | $FF   | #FFFFFF |
| 2         | COLOR_RED     | Rouge       | $CC   | $00   | $00   | #CC0000 |
| 3         | COLOR_CYAN    | Cyan        | $00   | $CC   | $CC   | #00CCCC |
| 4         | COLOR_PURPLE  | Violet      | $CC   | $00   | $CC   | #CC00CC |
| 5         | COLOR_GREEN   | Vert        | $00   | $CC   | $00   | #00CC00 |
| 6         | COLOR_BLUE    | Bleu        | $00   | $00   | $CC   | #0000CC |
| 7         | COLOR_YELLOW  | Jaune       | $CC   | $CC   | $00   | #CCCC00 |
| 8         | COLOR_ORANGE  | Orange      | $CC   | $88   | $00   | #CC8800 |
| 9         | COLOR_BROWN   | Brun        | $88   | $44   | $00   | #884400 |
| 10        | COLOR_PINK    | Rose/Saumon | $FF   | $88   | $88   | #FF8888 |
| 11        | COLOR_DKGRAY  | Gris foncé  | $44   | $44   | $44   | #444444 |
| 12        | COLOR_MDGRAY  | Gris moyen  | $88   | $88   | $88   | #888888 |
| 13        | COLOR_LTGREEN | Vert clair  | $88   | $FF   | $88   | #88FF88 |
| 14        | COLOR_LTBLUE  | Bleu clair  | $88   | $88   | $FF   | #8888FF |
| 15        | COLOR_LTGRAY  | Gris clair  | $CC   | $CC   | $CC   | #CCCCCC |

## 4.4 Double buffering

| **✅ CORRECTION : **bit 1 de VPU_CTRL = flip_request. Il est AUTO-CLEAR : après le swap au VBlank, il repasse à 0 automatiquement. Il n'est pas nécessaire de le remettre à 0 manuellement. |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |

; Activer le mode graphique (bit0=1), VPU enable (bit7=1)

LDA #%10000001     ; vpu_enable + mode gfx

STA $D000

; ... dessiner dans Framebuffer B ($6000–$7FFF) ...

; Demander le flip au prochain VBlank

LDA $D000

ORA #%00000010     ; bit1=flip_request

STA $D000

; Le VPU swappera A↔B au VBlank et effacera bit1 automatiquement.

; Vérifier que le flip est effectué : lire bit1 de $D000 (=0 si fait)

; ou bit1 de $D004 (VPU_STATUS) pour voir quel buffer est actif.

# CHAPITRE 5 — SYSTÈME SONORE (SPU)

## 5.1 Architecture

Voix 0 : Onde carrée   (fréquence + durée + volume + enveloppe ADSR)

Voix 1 : Onde triangle (fréquence + durée + volume + enveloppe ADSR)

Voix 2 : Bruit blanc   (registre de décalage LFSR 16-bit)

Canal 3 : Sample PCM   (1-bit, 8 kHz ou 4 kHz, data en RAM)

## 5.2 Registres SPU ($D100–$D1FF)

Chaque voix occupe 8 registres consécutifs :

Voix N (N = 0, 1, 2) — base = $D100 + N*8

$D100+N*8+0  SPU_FREQ_LO   Fréquence octet bas  (période = 1 000 000 / (freq16+1))

$D100+N*8+1  SPU_FREQ_HI   Fréquence octet haut (freq16 = FREQ_HI*256 + FREQ_LO)

$D100+N*8+2  SPU_VOL       Volume (bits 7-4 = gauche 0–15, bits 3-0 = droit 0–15)

$D100+N*8+3  SPU_ATTACK    Durée attaque  (0–15 en frames)

$D100+N*8+4  SPU_DECAY     Durée decay    (0–15 en frames)

$D100+N*8+5  SPU_SUSTAIN   Niveau sustain (0–15)

$D100+N*8+6  SPU_RELEASE   Durée release  (0–15 en frames)

$D100+N*8+7  SPU_CTRL      bit7=gate(1=note on, 0=note off) bits 3-0=forme d'onde

  Formes d'onde :
    $01 = Carrée 50%   (voix 0 et 1)

    $02 = Carrée 25%   (voix 0 et 1)

    $03 = Triangle     (voix 0 et 1)

    $04 = Sawtooth     (voix 0 et 1)

    $08 = Noise (LFSR) (voix 2 uniquement — FREQ_LO/HI contrôlent le taux de shift)

Adresses concrètes :

  Voix 0 : $D100–$D107   (SPU_V0_FREQ_LO … SPU_V0_CTRL)

  Voix 1 : $D108–$D10F   (SPU_V1_BASE + offsets)

  Voix 2 : $D110–$D117   (SPU_V2_BASE + offsets)

### Registres globaux SPU

$D118  SPU_MASTER_VOL    Volume master (0–15)

$D119  SPU_STATUS        Lecture : bit N = voix N active (0=inactive, 1=gate on)

$D11A  SPU_SAMPLE_LO     Adresse sample (octet bas) — canal 3

$D11B  SPU_SAMPLE_HI     Adresse sample (octet haut)

$D11C  SPU_SAMPLE_LEN    Longueur sample (en blocs de 256 octets)

$D11D  SPU_SAMPLE_CTRL   bit7=start bit6=loop bit0=taux(0=8kHz/1=4kHz)

### Exemple — jouer La 440 Hz

; Note La 440 Hz sur voix 0 (onde carrée 50%)

; Période = 1 000 000 / 440 ≈ 2272 → $08E0

LDA #$E0 : STA $D100     ; SPU_V0_FREQ_LO

LDA #$08 : STA $D101     ; SPU_V0_FREQ_HI

LDA #$FF : STA $D102     ; SPU_V0_VOL : gauche+droit max

LDA #$02 : STA $D103     ; SPU_V0_ATTACK  = 2 frames

LDA #$04 : STA $D104     ; SPU_V0_DECAY   = 4 frames

LDA #$08 : STA $D105     ; SPU_V0_SUSTAIN = niveau 8

LDA #$08 : STA $D106     ; SPU_V0_RELEASE = 8 frames

LDA #$81 : STA $D107     ; gate=1, forme=carrée 50% ($01)

; Note OFF : écrire gate=0 (garder la forme d'onde)

LDA #$01 : STA $D107     ; gate=0, forme=$01

# CHAPITRE 6 — I/O REGISTERS ($D200–$D3FF)

## 6.1 Clavier ($D200–$D20F)

$D200  KEY_ASCII     Lecture : ASCII de la touche (0 si aucune)

$D201  KEY_STATUS    Lecture : bit7=touche enfoncée ce frame
                     Écriture : $00 = acquitter (clear)

$D202  KEY_MOD       Modificateurs : bit0=Shift bit1=Ctrl bit2=Alt

$D203  KEY_RAW       Scancode brut (indépendant de la langue)

Codes spéciaux (KEY_RAW, valeurs > $7F) :

$80 = Flèche haut    $84 = F1      $88 = Insert

$81 = Flèche bas     $85 = F2      $89 = Delete

$82 = Flèche gauche  $86 = F3      $8A = Home

$83 = Flèche droite  $87 = F4      $8B = End

### Lire le clavier

WAIT_KEY:

  LDA $D201

  BPL WAIT_KEY      ; bit7=0 → aucune touche, boucler

  LDA $D200         ; lire l'ASCII

  STA $00           ; stocker en ZP

  LDA #$00

  STA $D201         ; acquitter

## 6.2 Manette ($D210–$D21F)

$D210  PAD1_STATE   Manette 1 — snapshot état boutons

$D211  PAD2_STATE   Manette 2 — snapshot état boutons

$D212  PAD_CTRL     bit0=latch (écrire 1 pour capturer l'état)

Bits de PAD_STATE (logique NES inversée : 0=enfoncé, 1=relâché) :

  bit 7 : A       bit 3 : Droite

  bit 6 : B       bit 2 : Gauche

  bit 5 : Select  bit 1 : Bas

  bit 4 : Start   bit 0 : Haut

### Lire la manette

; Lire l'état de la manette 1

LDA #$01 : STA $D212   ; latch — capturer l'état

LDA $D210              ; lire snapshot manette 1

STA $10                ; stocker

; Tester le bouton A (bit 7 : 0=enfoncé)

AND #$80

BEQ BOUTON_A_PRESSE    ; Z=1 si bit=0 (enfoncé)

## 6.3 Souris ($D220–$D22F)

$D220  MOUSE_X       Position X (0–127 gfx, 0–15 texte)

$D221  MOUSE_Y       Position Y

$D222  MOUSE_DX      Delta X depuis dernière lecture (signé -128/+127)

$D223  MOUSE_DY      Delta Y (signé -128/+127)

$D224  MOUSE_BTN     bit0=gauche bit1=droit bit2=milieu (0=enfoncé)

$D225  MOUSE_SCROLL  Delta molette (signé -127/+127)

## 6.4 Système ($D300–$D3FF)

$D300  SYS_TIMER_LO   Timer 16-bit (cycles CPU), octet bas

$D301  SYS_TIMER_HI   Octet haut (timer reset à 0 après lecture de $D301)

$D302  SYS_IRQ_RATE   Fréquence IRQ : 0=désactivé, N=toutes les N×256 cycles

$D303  SYS_IRQ_CTRL   bit0=enable IRQ timer

$D304  SYS_FRAME_LO   Compteur frames (16-bit lo)

$D305  SYS_FRAME_HI   Compteur frames (16-bit hi)

$D306  SYS_RAND_REG   Octet pseudo-aléatoire LFSR 16-bit (nouveau à chaque lecture)

$D307  SYS_RAND_SEED  Écriture : réinitialise le LFSR

$D308  SYS_RESET_REG  Écriture $C7 → RESET logiciel

$D309  SYS_CAPS       Capacités machine (lecture seule)
                       bit0=cartouche présente

                       bit1=mode émulateur(1)/hardware(0)

                       bit2=manette 2 présente

| **⛔ ERREUR CORRIGÉE : **v1.0 : la constante SYS_RAND dans chuck.inc (=$D306) avait le même nom que la routine API $F05A. CORRIGÉ : le registre hardware s'appelle SYS_RAND_REG ($D306), la routine API s'appelle SYS_GET_RAND ($F05A). |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

# CHAPITRE 7 — CALLING CONVENTION & ABI

## 7.1 Principes fondamentaux

RÈGLE 1 : A est le registre de retour principal.
           La valeur de A après JSR est la valeur de retour.

RÈGLE 2 : X et Y sont des registres d'index volatils.
           Une routine PEUT les modifier sans les sauvegarder.

           L'appelant doit sauvegarder X/Y s'il en a besoin (PHA pattern).

RÈGLE 3 : Zero Page $0080–$00EF = zone de paramètres.
           Paramètre 0 : $0080/$0081 (lo/hi)   Paramètre 1 : $0082/$0083

           Paramètre 2 : $0084/$0085            Paramètre 3 : $0086/$0087

           ... (jusqu'à $00EF)

RÈGLE 4 : Pointeurs temporaires $00F0–$00FF (appartiennent à la routine appelée).
           $F0/$F1=P0  $F2/$F3=P1  $F4/$F5=P2  $F6/$F7=P3

           $F8/$F9=P4  $FA/$FB=P5  $FC/$FD=P6  $FE/$FF=P7

RÈGLE 5 : La pile est sacrée.
           Toute routine retourne avec le même SP qu'à l'entrée.

## 7.2 Passage de paramètres

### Cas 1 — Paramètre unique 8-bit via A

LDA #$07           ; couleur jaune

JSR MA_ROUTINE

MA_ROUTINE:

  ; A = couleur à l'entrée

  RTS

### Cas 2 — 2 ou 3 paramètres 8-bit via A, X, Y

; Convention : 1er=A  2ème=X  3ème=Y

LDA #$07           ; couleur

LDX #$10           ; x

LDY #$08           ; y

JSR SYS_DRAW_PIXEL

### Cas 3 — Paramètres larges via Zone Paramètres

; Passer (x=$10, y=$08, w=$20, h=$10) puis couleur dans A

LDA #$10 : STA $80   ; x lo

LDA #$00 : STA $81   ; x hi

LDA #$08 : STA $82   ; y lo

LDA #$00 : STA $83   ; y hi

LDA #$20 : STA $84   ; w lo

LDA #$00 : STA $85   ; w hi

LDA #$10 : STA $86   ; h lo

LDA #$00 : STA $87   ; h hi

LDA #$03             ; couleur dans A

JSR SYS_DRAW_RECT

### Cas 4 — Retour 16-bit : A (lo) + X (hi)

JSR SYS_FRAME_NUM   ; retourne 16-bit frames : A=lo X=hi

STA $10             ; lo

STX $11             ; hi

## 7.3 Convention de nommage des labels

| **Convention**    | **Usage**                                              | **Exemple**    |
| ----------------- | ------------------------------------------------------ | -------------- |
| MAJUSCULES        | Labels globaux (fonctions, données publiques)          | DRAW_PIXEL     |
| minuscules        | Labels locaux (privés à un module)                     | draw_line_clip |
| @minuscules       | Labels très locaux (boucles, branchements courts ca65) | @loop          |
| _UNDERSCORE_DEBUT | Labels réservés système (ne pas utiliser)              | _VBL_HANDLER   |

# CHAPITRE 8 — API SYSTÈME (ROM $F000–$F7FF)

La ROM contient une jump table : chaque entrée fait 3 octets (JMP $xxxx). L'adresse de chaque routine est fixe pour toujours. $F080–$F7FF contient le corps des routines (non accessible directement par le programmeur).

| **⛔ ERREUR CORRIGÉE : **v1.0 : le chapitre 3 déclarait $F000–$F7FF comme 'API Jump Table' entière. CORRIGÉ : $F000–$F071 = jump table (38 entrées × 3 oct = 114 oct), $F072–$F07F = réservé extensions, $F080–$F7FF = corps des routines ROM. |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

## 8.1 Table des routines

### Vidéo

| **Adresse** | **Nom**        | **Description**                                                  |
| ----------- | -------------- | ---------------------------------------------------------------- |
| $F000       | SYS_CLEAR      | Efface l'écran. A=couleur (gfx) ou A=char de remplissage (texte) |
| $F003       | SYS_DRAW_PIXEL | Pixel(X,Y)=couleur A. Mode gfx uniquement.                       |
| $F006       | SYS_DRAW_LINE  | Ligne de ($80,$81) à ($82,$83), couleur A                        |
| $F009       | SYS_DRAW_RECT  | Rect x=$80 y=$81 w=$82 h=$83, couleur A (contour)                |
| $F00C       | SYS_FILL_RECT  | Rect rempli — mêmes params que DRAW_RECT                         |
| $F00F       | SYS_BLIT       | Copie zone : src=$80/$81 dst=$82/$83 w=$84 h=$85                 |
| $F012       | SYS_DRAW_SPR   | Sprite: tile=A, x=X, y=Y (8×8 pixels depuis TileROM)             |
| $F015       | SYS_GET_PIXEL  | Lecture couleur pixel(X,Y) → A (non destructif)                  |
| $F018       | SYS_FLIP       | Swap framebuffer A↔B au prochain VBlank                          |
| $F01B       | SYS_SET_MODE   | Mode vidéo : A=0 (texte), A=1 (graphique)                        |

### Texte

| **Adresse** | **Nom**        | **Description**                                    |
| ----------- | -------------- | -------------------------------------------------- |
| $F01E       | SYS_PRINT_CHAR | Affiche char A à position curseur, avance          |
| $F021       | SYS_PRINT_STR  | Affiche chaîne null-terminated pointée par $80/$81 |
| $F024       | SYS_PRINT_NUM  | Affiche entier 8-bit A en décimal à cursor         |
| $F027       | SYS_PRINT_HEX  | Affiche A en hexadécimal "$XX" à cursor            |
| $F02A       | SYS_SET_CURSOR | Curseur à colonne X, ligne Y                       |
| $F02D       | SYS_GET_CURSOR | Retourne col → X, ligne → Y                        |
| $F030       | SYS_SET_COLOR  | INK=bits 7-4 de A, PAPER=bits 3-0 de A             |
| $F033       | SYS_SCROLL_UP  | Fait défiler le texte d'une ligne vers le haut     |

| **⛔ ERREUR CORRIGÉE : **v1.0 SYS_SET_COLOR : la description disait INK=bits 7-4 mais l'attribut texte ($4900) stocke PAPER=bits 7-4 et INK=bits 3-0. CORRIGÉ : SYS_SET_COLOR reçoit A avec INK=bits 7-4, PAPER=bits 3-0 (convention API). La routine écrit en RAM attribut avec les bits inversés (PAPER 7-4, INK 3-0). |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

### Son

| **Adresse** | **Nom**        | **Description**                                |
| ----------- | -------------- | ---------------------------------------------- |
| $F036       | SYS_PLAY_NOTE  | Voix=X, note MIDI=A (21–108), durée=$80 frames |
| $F039       | SYS_STOP_VOICE | Arrête la voix X (gate=0)                      |
| $F03C       | SYS_STOP_ALL   | Arrête toutes les voix                         |
| $F03F       | SYS_PLAY_SFX   | Joue effet sonore N (banque ROM) dans voix X   |
| $F042       | SYS_SET_VOL    | Volume voix X = A (0–15)                       |
| $F045       | SYS_MASTER_VOL | Volume master = A (0–15)                       |

### Input

| **Adresse** | **Nom**        | **Description**                                |
| ----------- | -------------- | ---------------------------------------------- |
| $F048       | SYS_READ_PAD   | Lit manette numéro A (0 ou 1) → A=état boutons |
| $F04B       | SYS_READ_KEY   | Lit clavier → A=ASCII (0 si aucune touche)     |
| $F04E       | SYS_WAIT_KEY   | Bloque jusqu'à pression d'une touche → A=ASCII |
| $F051       | SYS_READ_MOUSE | Retourne X=mouseX Y=mouseY A=boutons           |
| $F054       | SYS_KEY_DOWN   | A=scancode → A=$FF si enfoncé, $00 sinon       |

### Système

| **Adresse** | **Nom**         | **Description**                                                 |
| ----------- | --------------- | --------------------------------------------------------------- |
| $F057       | SYS_WAIT_VBLANK | **Ne bloque PAS** : retour immédiat. La cadence 60 Hz est pilotée par l'hôte (rAF). Voir Annexe B, garde-frame |
| $F05A       | SYS_GET_RAND    | Retourne octet pseudo-aléatoire dans A (LFSR)                   |
| $F05D       | SYS_RAND16      | Retourne 16-bit aléatoire : A=lo, X=hi                          |
| $F060       | SYS_MEMCPY      | Copie $84/$85 octets de src=$80/$81 vers dst=$82/$83            |
| $F063       | SYS_MEMSET      | Remplit dst=$80/$81 sur len=$82/$83 octets avec valeur A        |
| $F066       | SYS_MEMCMP      | Compare $84 octets : src1=$80/$81 vs src2=$82/$83 → Z=1 si égal |
| $F069       | SYS_FRAME_NUM   | Retourne compteur frames 16-bit : A=lo X=hi                     |
| $F06C       | SYS_RESET       | Reset logiciel (équivalent bouton RESET)                        |
| $F06F       | SYS_VERSION     | Retourne version ROM : A=major X=minor                          |

| **⛔ ERREUR CORRIGÉE : **v1.0 SYS_RAND ($F05A) avait le même nom que le registre hardware $D306 (SYS_RAND). CORRIGÉ : la routine API s'appelle SYS_GET_RAND ($F05A). Le registre hardware est SYS_RAND_REG ($D306). |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |

| **⛔ ERREUR CORRIGÉE : **v1.0 SYS_MEMSET : paramètre destination ambigu. CORRIGÉ : dst=$80/$81 (adresse de remplissage), len=$82/$83 (nombre d'octets), valeur=A. |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |

## 8.2 Note MIDI → fréquence

SYS_PLAY_NOTE accepte des notes MIDI standard :

  21 = La0  (27.5 Hz)    60 = Do4 (261.6 Hz)

  69 = La4  (440 Hz)    108 = Do8 (4186 Hz)

La conversion en valeur registre SPU est effectuée par la ROM.

Exemple d'usage :

  LDX #0     ; voix 0

  LDA #30    ; durée = 30 frames

  STA $80    ; durée passée via la zone paramètres ($80)

  LDA #69    ; note MIDI La4 = 440 Hz, dans A (chargée en dernier)

  JSR SYS_PLAY_NOTE

# CHAPITRE 9 — STRUCTURE D'UN PROGRAMME

## 9.1 Structure minimale

| **✅ CORRECTION : **v1.0 : l'exemple utilisait .org $F800 pour les données (zone ROM système). CORRIGÉ : les données sont en RAM haute ($EC00) ou RAM programme ($0200). |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |

| **✅ CORRECTION : **v1.0 : l'exemple référençait SYS_SET_MODE_GFX (inexistant). CORRIGÉ : SYS_SET_MODE avec A=1. |
| --------------------------------------------------------------------------------------------------------------- |

; ── mon_programme.asm ────────────────────────────────────────

  .include "chuck.inc"   ; constantes et macros système

  .org $E000             ; point d'entrée (vecteur RESET → $E000)

; ── VARIABLES (RAM programme) ───────────────────────────────

  .org $0200

PAD_STATE:  .res 1

SCORE:      .res 1

; ── INIT ────────────────────────────────────────────────────

  .org $E000

INIT:

  LDA #1 : JSR SYS_SET_MODE   ; mode graphique (A=1)

  LDA #COLOR_BLACK : JSR SYS_CLEAR

  ; ... initialisation ...

  ; FALL THROUGH vers MAIN_LOOP

; ── BOUCLE PRINCIPALE ───────────────────────────────────────

MAIN_LOOP:

  JSR SYS_WAIT_VBLANK    ; sync 50/60 Hz

  JSR UPDATE             ; logique

  JSR DRAW               ; rendu

  JMP MAIN_LOOP

; ── UPDATE ──────────────────────────────────────────────────

UPDATE:

  LDA #0 : JSR SYS_READ_PAD

  STA PAD_STATE

  ; ... logique jeu ...

  RTS

; ── DRAW ────────────────────────────────────────────────────

DRAW:

  ; ... dessiner le frame ...

  RTS

## 9.2 Structure avec NMI (interruption VBlank)

  .include "chuck.inc"

  .org $E000

INIT:

  SEI                    ; désactive IRQ pendant l'init

  ; ... setup ...

  CLI                    ; réactive IRQ

  JMP MAIN_LOOP

; Handler NMI — appelé AUTOMATIQUEMENT à chaque VBlank

; DOIT être rapide (< 1000 cycles recommandé)

; DOIT sauvegarder et restaurer A, X, Y

  .org $E100

NMI_HANDLER:

  PHA : TXA : PHA : TYA : PHA    ; sauvegarde A, X, Y

  ; ... tâches critiques : update sprites, flip buffer ...

  PLA : TAY : PLA : TAX : PLA    ; restaure Y, X, A

  RTI

MAIN_LOOP:

  ; travailler sans se soucier du timing

  JMP MAIN_LOOP

; Note : déclarer le handler via chuck.inc en tête de fichier :

; NMI_HANDLER_ADDR = NMI_HANDLER

; La ROM lit $E006/$E007 au boot pour configurer le vecteur NMI.

# CHAPITRE 10 — FORMAT CARTOUCHE .chuck

## 10.1 Format fichier texte

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

; (optionnel — police custom chargée en zone tiles $6000 ;
;  le VPU l'utilise à la place du charset ROM $F800 si activé)

  .org $6000

MY_FONT:

  ...

--- meta ---

; Contrôles :

;   Manette 1 : A=sauter  B=tirer

;   Start : pause

## 10.2 Chargement d'une cartouche

Le vecteur RESET pointe vers entry (défaut $E000). Si nmi est déclaré, le vecteur NMI pointe vers cette adresse. Le code de la cartouche est chargé à partir de l'adresse .org déclarée.

# ANNEXE A — chuck.inc (header standard v1.1)

| **⛔ ERREUR CORRIGÉE : **v1.0 : les macros utilisaient .param (syntaxe invalide ca65). CORRIGÉ : les paramètres de macro s'écrivent sans point. |
| ---------------------------------------------------------------------------------------------------------------------------------------------- |

| **⛔ ERREUR CORRIGÉE (v1.2.1) : **l'opérateur `<<` ET la pseudo-fonction `.shl()` sont tous deux rejetés par l'assembleur chuck-core (« `)` attendu »). Pour un décalage gauche de 4 bits dans une expression constante, utiliser la **multiplication par 16** : `LDA #(ink * 16 | paper)`. Vérifié : produit bien `$75` pour ink=7, paper=5. |
| ----------------------------------------------------------------------------------------------------------------------------------------------- |

| **⛔ ERREUR CORRIGÉE : **v1.0 : SYS_FLIP, SYS_DRAW_LINE et 10 autres routines absentes. CORRIGÉES : toutes les routines de la jump table sont définies. |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ |

| **⛔ ERREUR CORRIGÉE : **v1.0 : SYS_RAND = $D306 en collision avec la routine API. CORRIGÉ : SYS_RAND_REG = $D306 (hardware), SYS_GET_RAND = $F05A (API). |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- |

| **⛔ ERREUR CORRIGÉE : **v1.0 : MOUSE_DX, MOUSE_DY, MOUSE_SCROLL absents. CORRIGÉS : ajoutés. |
| -------------------------------------------------------------------------------------------- |

; ── chuck.inc — Chuck-8 System Header v1.1 ──────────────────

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

VPU_SPR_CTRL   = $D005

VPU_SPR_IDX    = $D006

VPU_SPR_X      = $D007

VPU_SPR_Y      = $D008

VPU_SPR_FLAGS  = $D009

VPU_SPR_TILE   = $D00A

VPU_CURSOR_X   = $D00B

VPU_CURSOR_Y   = $D00C

VPU_INK        = $D00D

VPU_PAPER      = $D00E

VPU_CHAR_OUT   = $D00F

; ── SPU Registres ────────────────────────────────────────────

SPU_V0_FREQ_LO  = $D100

SPU_V0_FREQ_HI  = $D101

SPU_V0_VOL      = $D102

SPU_V0_ATK      = $D103

SPU_V0_DCY      = $D104

SPU_V0_SUS      = $D105

SPU_V0_REL      = $D106

SPU_V0_CTRL     = $D107

SPU_V1_BASE     = $D108

SPU_V2_BASE     = $D110

SPU_MASTER_VOL  = $D118

SPU_STATUS      = $D119

SPU_SAMPLE_LO   = $D11A

SPU_SAMPLE_HI   = $D11B

SPU_SAMPLE_LEN  = $D11C

SPU_SAMPLE_CTRL = $D11D

; ── INPUT Registres ──────────────────────────────────────────

KEY_ASCII      = $D200

KEY_STATUS     = $D201

KEY_MOD        = $D202

KEY_RAW        = $D203

PAD1_STATE     = $D210

PAD2_STATE     = $D211

PAD_CTRL       = $D212

MOUSE_X        = $D220

MOUSE_Y        = $D221

MOUSE_DX       = $D222

MOUSE_DY       = $D223

MOUSE_BTN      = $D224

MOUSE_SCROLL   = $D225

; ── SYSTEM Registres ─────────────────────────────────────────

SYS_TIMER_LO   = $D300

SYS_TIMER_HI   = $D301

SYS_IRQ_RATE   = $D302

SYS_IRQ_CTRL   = $D303

SYS_FRAME_LO   = $D304

SYS_FRAME_HI   = $D305

SYS_RAND_REG   = $D306   ; registre LFSR hardware (lecture directe)

SYS_RAND_SEED  = $D307

SYS_RESET_REG  = $D308

SYS_CAPS       = $D309

; ── Pad boutons (bits) — logique NES inversée ────────────────

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

SYS_GET_PIXEL  = $F015

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

SYS_PLAY_SFX   = $F03F

SYS_SET_VOL    = $F042

SYS_MASTER_VOL = $F045

SYS_READ_PAD   = $F048

SYS_READ_KEY   = $F04B

SYS_WAIT_KEY   = $F04E

SYS_READ_MOUSE = $F051

SYS_KEY_DOWN   = $F054

SYS_WAIT_VBLANK= $F057

SYS_GET_RAND   = $F05A   ; routine API (≠ SYS_RAND_REG=$D306)

SYS_RAND16     = $F05D

SYS_MEMCPY     = $F060

SYS_MEMSET     = $F063

SYS_MEMCMP     = $F066

SYS_FRAME_NUM  = $F069

SYS_RESET      = $F06C

SYS_VERSION    = $F06F

; ── Zone mémoire ─────────────────────────────────────────────

ZP_PARAMS      = $0080    ; zone paramètres ABI

ZP_PTR0        = $00F0    ; pointeur 0 (lo/hi)

ZP_PTR1        = $00F2

ZP_PTR2        = $00F4

ZP_PTR3        = $00F6

FRAMEBUF_A     = $4000

FRAMEBUF_B     = $6000

VRAM_TEXT      = $4800

VRAM_ATTR      = $4900

VRAM_SPRITES   = $5000

VRAM_TILES     = $6000

; ── Macros ca65 (syntaxe correcte — sans point devant les params) ─

; SET_COLOR ink, paper

; ink   = couleur texte (0–15) → bits 7-4 de A pour l'API

; paper = couleur fond  (0–15) → bits 3-0 de A pour l'API

.macro SET_COLOR ink, paper

  LDA #(ink * 16 | paper)   ; chuck-core : ni << ni .shl() ne sont supportés — utiliser * 16 (= décalage de 4 bits)

  JSR SYS_SET_COLOR

.endmacro

; CURSOR col, row

.macro CURSOR col, row

  LDX #col

  LDY #row

  JSR SYS_SET_CURSOR

.endmacro

; PRINT string_label

.macro PRINT str

  LDA #<str

  STA ZP_PARAMS

  LDA #>str

  STA ZP_PARAMS+1

  JSR SYS_PRINT_STR

.endmacro

; PIXEL x, y, color

.macro PIXEL x, y, color

  LDA #color

  LDX #x

  LDY #y

  JSR SYS_DRAW_PIXEL

.endmacro

; READ_PAD_MACRO pad_number  (lit et retourne état dans A)

.macro READ_PAD_MACRO num

  LDA #num

  JSR SYS_READ_PAD

.endmacro

; PAD_PRESSED button_mask

; Teste le résultat de SYS_READ_PAD dans A

; Positionne Z=0 si le bouton est enfoncé (logique inversée NES : 0=enfoncé)

.macro PAD_PRESSED btn

  EOR #$FF         ; inverse (0=enfoncé devient 1)

  AND #btn

.endmacro

# ANNEXE B — EXEMPLE COMPLET : PONG MINIMAL (v1.2.1 — vérifié moteur réel)

Cette version a été **assemblée et exécutée contre le moteur chuck-core** (assembleur + CPU + I/O), en reproduisant le pilote temps-réel du navigateur (`vblank_tick()` puis `run(budget)` à chaque frame). Trois pièges de la machine, invisibles à la simple lecture, sont corrigés ici.

## Les trois pièges du Chuck-8 illustrés par Pong

**1. `SYS_WAIT_VBLANK` ne bloque pas — le piège de la boucle folle**
Sur Chuck-8, la synchronisation 60 Hz est pilotée côté hôte (requestAnimationFrame). `SYS_WAIT_VBLANK` **revient immédiatement** : la boucle de jeu tourne donc des milliers de fois par frame affichée. Si on déplace la balle ou la raquette à chaque tour, un seul appui envoie la raquette d'un bord à l'autre, et la balle laisse une traînée. **Idiome du garde-frame** : lire `SYS_FRAME_NUM` en tête de boucle et ne traiter la logique qu'au changement de numéro de frame.

**2. Le piège du drapeau Z**
`SYS_KEY_DOWN` écrit son résultat dans A **sans mettre à jour le drapeau Z**. Un `BEQ`/`BNE` placé juste après teste un Z périmé. **Toujours** intercaler `CMP #0` entre `JSR SYS_KEY_DOWN` et la branche.

**3. Effacer avant de déplacer**
Pour effacer la balle proprement, on l'efface à sa position **courante**, *avant* de la déplacer — pas à une position « dernière dessinée » mémorisée après coup, qui contient déjà la position d'arrivée et provoque une traînée diagonale.

## Choix de rendu

La balle et la raquette sont dessinées en **blocs pleins** via `SYS_FILL_RECT` (et non `SYS_DRAW_PIXEL`, qui ne pose qu'un seul pixel invisible sur 128×128). La raquette utilise un dirty-check : elle n'est redessinée que lorsqu'elle bouge. L'entrée se fait **au clavier** (`SYS_KEY_DOWN`, scancodes Haut=$80 / Bas=$81), conformément au track pédagogique.

```asm
; pong.asm — Chuck-8 v1.2.1 : efface la balle a sa position courante avant de bouger
; Garde-frame via SYS_FRAME_NUM : la boucle tourne des milliers de fois par
; frame réelle ; on ne met à jour le jeu qu'au changement de numéro de frame.
  .include "chuck.inc"

KEY_UP   = $80
KEY_DOWN = $81

  .org $0200
BALL_X:    .res 1
BALL_Y:    .res 1
BALL_DX:   .res 1
BALL_DY:   .res 1
PAD_Y:     .res 1
PAD_LAST:  .res 1       ; dernière raquette dessinée (dirty-check)
FRAME_LAST:.res 1       ; dernier numéro de frame traité (garde-frame)

  .org $E000
INIT:
  LDA #1
  JSR SYS_SET_MODE
  LDA #COLOR_BLACK
  JSR SYS_CLEAR
  LDA #64
  STA BALL_X
  LDA #64
  STA BALL_Y
  LDA #1
  STA BALL_DX
  LDA #1
  STA BALL_DY
  LDA #56
  STA PAD_Y
  LDA #255
  STA PAD_LAST
  STA FRAME_LAST

MAIN_LOOP:
  JSR SYS_WAIT_VBLANK

  ; ── GARDE-FRAME : ne traiter qu'une fois par frame réelle ──
  JSR SYS_FRAME_NUM        ; A = frame_lo
  CMP FRAME_LAST
  BEQ MAIN_LOOP            ; même frame → on re-boucle sans rien faire
  STA FRAME_LAST           ; nouvelle frame → on la marque et on joue

  ; ── INPUT CLAVIER (Haut) ───────────────────────────────
  LDA #KEY_UP
  JSR SYS_KEY_DOWN
  CMP #0                   ; piège du drapeau Z
  BEQ no_up
  LDA PAD_Y
  BEQ no_up
  DEC PAD_Y
no_up:

  ; ── INPUT CLAVIER (Bas) ────────────────────────────────
  LDA #KEY_DOWN
  JSR SYS_KEY_DOWN
  CMP #0
  BEQ no_down
  LDA PAD_Y
  CMP #117
  BCS no_down
  INC PAD_Y
no_down:

  ; ── EFFACER LA BALLE A SA POSITION COURANTE (avant de bouger) ──
  LDA BALL_X
  STA $80
  LDA BALL_Y
  STA $81
  LDA #2
  STA $82
  LDA #2
  STA $83
  LDA #COLOR_BLACK
  JSR SYS_FILL_RECT

  ; ── DEPLACEMENT + REBONDS (une seule fois par frame) ───
  LDA BALL_X
  CMP #2
  BCS no_reset
  LDA BALL_DX
  BPL no_reset
  LDA #64
  STA BALL_X
  LDA #64
  STA BALL_Y
  LDA #1
  STA BALL_DX
  LDA #1
  STA BALL_DY
  JMP after_move
no_reset:
  LDA BALL_X
  CLC
  ADC BALL_DX
  STA BALL_X
  LDA BALL_Y
  CLC
  ADC BALL_DY
  STA BALL_Y

  LDA BALL_Y
  BEQ flip_dy
  CMP #125
  BCC no_flip_dy
flip_dy:
  LDA #0
  SEC
  SBC BALL_DY
  STA BALL_DY
no_flip_dy:

  LDA BALL_X
  CMP #125
  BCC no_right
  LDA #0
  SEC
  SBC BALL_DX
  STA BALL_DX
no_right:

  LDA BALL_X
  CMP #10
  BCS no_pad
  LDA BALL_Y
  CMP PAD_Y
  BCC no_pad
  LDA PAD_Y
  CLC
  ADC #10
  CMP BALL_Y
  BCC no_pad
  LDA #0
  SEC
  SBC BALL_DX
  STA BALL_DX
no_pad:
after_move:

  ; ── REDESSINER BALLE ───────────────────────────────────
  LDA BALL_X
  STA $80
  LDA BALL_Y
  STA $81
  LDA #2
  STA $82
  LDA #2
  STA $83
  LDA #COLOR_WHITE
  JSR SYS_FILL_RECT

  ; ── RAQUETTE (dirty-check) ─────────────────────────────
  LDA PAD_Y
  CMP PAD_LAST
  BEQ skip_pad
  LDA #8
  STA $80
  LDA PAD_LAST
  STA $81
  LDA #2
  STA $82
  LDA #11
  STA $83
  LDA #COLOR_BLACK
  JSR SYS_FILL_RECT
  LDA #8
  STA $80
  LDA PAD_Y
  STA $81
  LDA #2
  STA $82
  LDA #11
  STA $83
  LDA #COLOR_WHITE
  JSR SYS_FILL_RECT
  LDA PAD_Y
  STA PAD_LAST
skip_pad:

  JMP MAIN_LOOP
```


# ANNEXE C — TABLEAU DE RÉFÉRENCE RAPIDE

## Adresses clés

| **Plage**   | **Description**                                          |
| ----------- | -------------------------------------------------------- |
| $0010–$007F | Variables utilisateur (Zero Page)                        |
| $0080–$00EF | Paramètres ABI (Zero Page)                               |
| $00F0–$00FF | Pointeurs ZP (8 × 16-bit)                                |
| $0200–$03FF | RAM programme (variables, buffers)                       |
| $0400–$3FFF | RAM libre (heap, données)                                |
| $4000–$5FFF | Framebuffer A (mode gfx) / Texte+Sprites (mode texte)    |
| $4800–$48FF | Mémoire texte 16×16 (alias dans $4000–$5FFF)             |
| $4900–$49FF | Attributs couleur texte (alias dans $4000–$5FFF)         |
| $5000–$5FFF | Sprite Data (alias dans $4000–$5FFF)                     |
| $6000–$7FFF | Framebuffer B (mode gfx) / Tiles custom (mode texte)     |
| $8000–$BFFF | ROM cartouche (optionnel, 16 Ko)                         |
| $C000–$CFFF | Expansion (réservé, 4 Ko)                                |
| $D000       | VPU_CTRL                                                 |
| $D100       | SPU Voix 0 base                                          |
| $D200       | KEY_ASCII                                                |
| $D210       | PAD1_STATE                                               |
| $D220       | MOUSE_X                                                  |
| $D306       | SYS_RAND_REG (LFSR hardware)                             |
| $E000       | Point d'entrée programme (RAM haute)                     |
| $F000–$F071 | Jump table API (38 entrées × 3 oct)                      |
| $F080–$F7FF | Corps des routines ROM (non accessible directement)      |
| $F800–$FFEF | Charset ROM (police 8×8, 128 chars)                      |
| $FFFA–$FFFF | Vecteurs NMI / RESET / IRQ                               |

## Instructions les plus utiles

| **Instruction** | **Effet**                                           |
| --------------- | --------------------------------------------------- |
| LDA #val        | A ← val (immédiat)                                  |
| STA addr        | mem[addr] ← A                                       |
| LDX / LDY       | Charger X ou Y                                      |
| TAX/TAY/TXA/TYA | Transferts entre registres                          |
| PHA / PLA       | Sauvegarder / restaurer A sur la pile               |
| CLC : ADC #n    | A ← A + n (toujours CLC avant ADC)                  |
| SEC : SBC #n    | A ← A - n (toujours SEC avant SBC)                  |
| CMP #val        | Compare A sans modifier A (positionne N, Z, C)      |
| BEQ / BNE       | Sauter si Z=1 / Z=0                                 |
| BCC / BCS       | Sauter si C=0 (inférieur) / C=1 (supérieur ou égal) |
| BMI / BPL       | Sauter si N=1 (négatif) / N=0 (positif)             |
| JSR addr        | Appel de routine (pousse PC+2 sur pile)             |
| RTS             | Retour de routine                                   |
| RTI             | Retour d'interruption (restaure P + PC)             |
| JMP addr        | Saut inconditionnel                                 |
| SEI / CLI       | Désactiver / réactiver les IRQ                      |
| INX/INY/DEX/DEY | Incrément / décrément X ou Y                        |

Page
