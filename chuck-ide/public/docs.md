# Chuck IDE — Documentation

Chuck IDE est un environnement de développement complet pour le **Chuck-8**, un ordinateur 8-bit fictif basé sur le processeur MOS 6502. Cette page documente l'outil lui-même : l'éditeur, l'assembleur, l'émulateur, et les défis.

Les spécifications matérielles décrites ici suivent le **Chuck-8 spec v1.2**.

---

## L'éditeur

L'éditeur occupe la zone centrale. Il accepte de l'assembleur 6502 au format **ca65**.

### Raccourcis

| Raccourci | Action |
| --- | --- |
| `Ctrl+Shift+B` | Assembler le code |
| `F5` | Lancer l'exécution |
| `F10` | Exécuter une instruction (step) |
| `Échap` | Fermer les modales ouvertes |

### Boutons de la toolbar (gauche)

Les boutons de la barre verticale gauche reflètent l'état de la machine :

- **Assembler** — compile le source en bytecode 6502
- **Run** — lance l'exécution depuis `$E000` (ou `$0600` en mode libre)
- **Step** — exécute une seule instruction, met en pause
- **Stop** — interrompt l'exécution
- **Reset** — remet le CPU à zéro, repositionne le PC à l'adresse d'entrée

Le bouton **Reset** n'efface pas le code dans l'éditeur.

### Bouton "Copier" dans les blocs de code

Les blocs de code assembleur affichés dans cette fenêtre ont un bouton **Copier** en haut à droite. Un clic injecte le code directement dans l'éditeur et le place dans le presse-papier.

---

## L'assembleur

Chuck IDE embarque **ca65**, l'assembleur de la suite cc65. La syntaxe est stricte.

### Structure minimale d'un programme

```asm
  .org $E000        ; point d'entrée — vecteur RESET → $E000

  LDA #$01
  STA $D000         ; écriture registre VPU_CTRL

  BRK               ; arrêt propre
```

### Directives essentielles

| Directive | Usage |
| --- | --- |
| `.org $XXXX` | Définit l'adresse d'assemblage |
| `.byte $XX, $XX` | Insère des octets bruts |
| `.word $XXXX` | Insère un mot 16-bit little-endian |
| `.res N` | Réserve N octets (non initialisés) |
| `LABEL = $XXXX` | Définit une constante (pas un label de code) |
| `.include "chuck.inc"` | Injecte les constantes système (registres, couleurs, routines API) |

### Règles de syntaxe ca65

- Chaque **instruction occupe sa propre ligne**. Le séparateur `:` entre deux instructions ne fonctionne qu'après un **nombre littéral** — jamais après un identifiant, une constante, un label ou une instruction branche.
- Les **constantes** (`NAME = value`) ne peuvent jamais partager une ligne via `:`.
- Les labels se terminent par `:` et sont seuls sur leur ligne, ou suivis d'une instruction.
- Les commentaires commencent par `;`.

### Erreurs fréquentes

| Message | Cause probable |
| --- | --- |
| `unexpected token` | `:` utilisé comme séparateur après un identifiant |
| `undefined symbol` | Label ou constante utilisé avant sa déclaration |
| `branch out of range` | Branchement conditionnel > 127 octets — utiliser JMP |
| `value out of range` | Valeur 8-bit > 255, ou adresse 16-bit trop grande |

---

## L'émulateur

L'émulateur simule fidèlement le matériel Chuck-8 : CPU MOS 6502 cadencé à 1 MHz, 64 Ko de RAM, VPU 128×128 pixels, SPU 3 voix + 1 canal sample.

### Registres du 6502

| Registre | Taille | Rôle |
| --- | --- | --- |
| `A` | 8 bits | Accumulateur — toutes les opérations arithmétiques |
| `X` | 8 bits | Index — adressage indexé, compteurs |
| `Y` | 8 bits | Index — adressage indexé, compteurs |
| `PC` | 16 bits | Program Counter — adresse de la prochaine instruction |
| `SP` | 8 bits | Stack Pointer — pointe dans `$0100–$01FF`, décroît |
| `P` | 8 bits | Flags : N V 1 B D I Z C (bit 5 toujours à 1) |

La fenêtre **Registres** (bouton titlebar) affiche leur valeur en temps réel pendant l'exécution.

### Memory map résumée

| Plage | Zone | Accès |
| --- | --- | --- |
| `$0000–$00FF` | Zero Page — variables rapides, paramètres ABI | R/W |
| `$0100–$01FF` | Stack — ne pas utiliser autrement | R/W |
| `$0200–$03FF` | RAM programme — variables, buffers | R/W |
| `$0400–$3FFF` | RAM libre — heap, données | R/W |
| `$4000–$7FFF` | VRAM (framebuffer, texte, sprites) | R/W |
| `$8000–$BFFF` | Cartouche ROM (optionnelle, 16 Ko) | R |
| `$C000–$CFFF` | Expansion (réservé, 4 Ko) | R/W |
| `$D000–$D0FF` | Registres VPU | R/W |
| `$D100–$D1FF` | Registres SPU | R/W |
| `$D200–$D2FF` | Input (clavier, pad, souris) | R/W |
| `$D300–$D3FF` | Système (timer, IRQ, random) | R/W |
| `$E000–$EFFF` | RAM haute — point d'entrée programme | R/W |
| `$F000–$FFFF` | SYS ROM — API + charset + vecteurs | R |

Le programme démarre toujours à **`$E000`** (vecteur RESET → `$E000`).

### Modes vidéo (VPU)

Le VPU supporte deux modes exclusifs, contrôlés par `VPU_CTRL` (`$D000`).

**Mode texte** (bit 0 = 0, défaut) :
- Grille **16×16 caractères**, glyphes **8×8 pixels** (1 bit/pixel)
- Mémoire texte en `$4800–$48FF` (256 octets), attributs couleur en `$4900–$49FF` (256 octets)
- Charset en ROM système `$F800–$FFEF` (128 chars × 8 octets)
- `SYS_PRINT_CHAR`, `SYS_PRINT_STR`, `SYS_SET_COLOR`

**Mode graphique** (bit 0 = 1) :
- Framebuffer 128×128 pixels, 16 couleurs (4 bits/pixel)
- Framebuffer A : `$4000–$5FFF` — Framebuffer B : `$6000–$7FFF`
- Double buffering via `SYS_FLIP` (`$F018`)

Pour activer le mode graphique :

```asm
  LDA #$01
  JSR $F01B         ; SYS_SET_MODE
```

[note]
 ⚠️ `SYS_SET_MODE` modifie `VPU_CTRL` et efface la VRAM. À appeler une seule fois en début de programme, avant tout dessin.
[/note]

[note]
 ℹ️ Le bit 1 de `VPU_CTRL` (flip_request) est **auto-clear** : après le swap au VBlank, il repasse à 0 automatiquement. Inutile de le remettre à zéro à la main.
[/note]

### Palette (16 couleurs fixes)

| Index | Constante | Couleur |
| --- | --- | --- |
| 0 | `COLOR_BLACK` | Noir |
| 1 | `COLOR_WHITE` | Blanc |
| 2 | `COLOR_RED` | Rouge |
| 3 | `COLOR_CYAN` | Cyan |
| 4 | `COLOR_PURPLE` | Violet |
| 5 | `COLOR_GREEN` | Vert |
| 6 | `COLOR_BLUE` | Bleu |
| 7 | `COLOR_YELLOW` | Jaune |
| 8 | `COLOR_ORANGE` | Orange |
| 9 | `COLOR_BROWN` | Brun |
| 10 | `COLOR_PINK` | Rose |
| 11 | `COLOR_DKGRAY` | Gris foncé |
| 12 | `COLOR_MDGRAY` | Gris moyen |
| 13 | `COLOR_LTGREEN` | Vert clair |
| 14 | `COLOR_LTBLUE` | Bleu clair |
| 15 | `COLOR_LTGRAY` | Gris clair |

### API système (ROM `$F000`)

La ROM expose **38 routines** via une jump table à adresses fixes (`$F000–$F071`, 38 entrées × 3 octets). Appel par `JSR $FXXX` ou par nom symbolique après `.include "chuck.inc"`.

[note]
 ⚠️ Un `JSR SYS_*` (appel ROM) ne met **pas** à jour les flags du CPU. Seules les vraies instructions 6502 (`LDA`, `CMP`, `DEC`…) positionnent N, Z, C, V.
[/note]

**Vidéo — sélection**

| Adresse | Nom | Paramètres |
| --- | --- | --- |
| `$F000` | `SYS_CLEAR` | A = couleur (gfx) ou char (texte) |
| `$F003` | `SYS_DRAW_PIXEL` | A = couleur, X = col, Y = ligne |
| `$F006` | `SYS_DRAW_LINE` | de (`$80/$81`) à (`$82/$83`), A = couleur |
| `$F009` | `SYS_DRAW_RECT` | x=`$80` y=`$81` w=`$82` h=`$83`, A = couleur (contour) |
| `$F00C` | `SYS_FILL_RECT` | idem — rectangle rempli |
| `$F015` | `SYS_GET_PIXEL` | lecture couleur pixel (X,Y) → A |
| `$F018` | `SYS_FLIP` | swap framebuffer A↔B au VBlank |
| `$F01B` | `SYS_SET_MODE` | A = 0 (texte), A = 1 (graphique) |

**Texte — sélection**

| Adresse | Nom | Paramètres |
| --- | --- | --- |
| `$F01E` | `SYS_PRINT_CHAR` | A = caractère ASCII |
| `$F021` | `SYS_PRINT_STR` | `$80/$81` = pointeur chaîne null-terminated |
| `$F02A` | `SYS_SET_CURSOR` | X = colonne (0–15), Y = ligne (0–15) |
| `$F030` | `SYS_SET_COLOR` | A : bits 7-4 = INK, bits 3-0 = PAPER |

**Son**

| Adresse | Nom | Paramètres |
| --- | --- | --- |
| `$F036` | `SYS_PLAY_NOTE` | X = voix, `$80` = durée (frames), A = note MIDI |
| `$F039` | `SYS_STOP_VOICE` | X = voix |
| `$F045` | `SYS_MASTER_VOL` | A = volume master (0–15) |

**Input**

| Adresse | Nom | Retour |
| --- | --- | --- |
| `$F048` | `SYS_READ_PAD` | A = numéro pad (0/1) → A = état boutons |
| `$F04B` | `SYS_READ_KEY` | A = code touche ASCII (0 si aucune) |
| `$F04E` | `SYS_WAIT_KEY` | bloque jusqu'à une touche → A = ASCII |
| `$F057` | `SYS_WAIT_VBLANK` | attend le prochain VBlank |

**Utilitaires**

| Adresse | Nom | Paramètres |
| --- | --- | --- |
| `$F05A` | `SYS_GET_RAND` | → A = octet pseudo-aléatoire (LFSR) |
| `$F060` | `SYS_MEMCPY` | src=`$80/$81`, dst=`$82/$83`, len=`$84/$85` |
| `$F063` | `SYS_MEMSET` | dst=`$80/$81`, len=`$82/$83`, A = valeur |
| `$F069` | `SYS_FRAME_NUM` | → compteur frames 16-bit : A = lo, X = hi |

**Convention d'appel** : paramètre unique 8-bit via `A`. Deux ou trois paramètres courts via `A`, `X`, `Y` (1er = A, 2e = X, 3e = Y). Paramètres larges ou multiples via la zone paramètres `$0080–$00EF`. `A`, `X`, `Y` peuvent être détruits par l'appel.

### Clavier — lecture brute

Les registres clavier en `$D200+` sont en **lecture seule** (écrire dessus est un no-op silencieux, sauf `$D201` pour acquitter).

| Registre | Adresse | Rôle |
| --- | --- | --- |
| `KEY_ASCII` | `$D200` | ASCII de la touche (0 si aucune) |
| `KEY_STATUS` | `$D201` | bit7 = touche enfoncée ; écrire `$00` = acquitter |
| `KEY_RAW` | `$D203` | Scancode brut, indépendant de la langue |

Codes flèches via `KEY_RAW` : `$80` = haut, `$81` = bas, `$82` = gauche, `$83` = droite.

### Interruptions

| Vecteur | Adresse | Déclenchement |
| --- | --- | --- |
| NMI | `$FFFA/$FFFB` → `$F010` | VBlank — 50/60 fois par seconde — non masquable |
| RESET | `$FFFC/$FFFD` → `$E000` | Démarrage, bouton Reset |
| IRQ | `$FFFE/$FFFF` → `$F020` | Timer programmable — masquable par `SEI` |

> Le handler NMI par défaut (en ROM) est minimal. Si tu écris le tien, sauvegarde et restaure `A`, `X`, `Y` avec `PHA`/`PLA` avant `RTI` — le NMI peut interrompre n'importe quelle instruction.

---

## Les défis

Les défis sont accessibles via `?challenge=N` dans l'URL, ou depuis le bouton d'accueil.

### Fonctionnement

1. Le panneau latéral droit affiche la consigne et le code de départ.
2. Tu modifies le code dans l'éditeur.
3. Tu cliques **Assembler** puis **Valider** — l'émulateur exécute ton code et vérifie les assertions (registres, mémoire, flags).

### Médailles

| Médaille | Condition |
| --- | --- |
| 🥇 Or | Validé sans utiliser d'indice |
| 🥈 Argent | Validé avec 1 indice |
| 🥉 Bronze | Validé avec 2 indices ou plus |

### Accès

Les défis 1 à 3 sont **gratuits et sans inscription**. À partir du défi 4, un compte est demandé. La progression est sauvegardée localement dans ton navigateur, puis synchronisée après inscription.

### Indices

Chaque défi propose des indices progressifs. Les révéler réduit la médaille obtenue. Un indice révélé ne peut pas être masqué à nouveau.

---

[note]
 🪄 Après les 18 défis fondamentaux, le parcours **Pong** te guide pas à pas dans la construction d'un jeu complet, étape atomique par étape atomique. D'autres parcours (Snake, Breakout…) suivront.
[/note]