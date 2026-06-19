# Formation Chuck-8 — Apprends à programmer comme en 1980

> *"Pour comprendre un ordinateur, tu dois penser comme un ordinateur."*— Rodnay Zaks, *Programming the 6502*, Sybex, 1978

* * *

Tu sais coder. Tu as des années de JavaScript, de Python, peut-être du Rust. Tu assembles des frameworks, tu ships des features, tu résous des bugs.

Et pourtant, il y a une question que tu n'arrives pas vraiment à répondre : **qu'est-ce qui se passe vraiment quand mon code s'exécute ?**

Cette formation ne t'apprend pas une nouvelle bibliothèque. Elle te ramène à la machine elle-même — au niveau où il n'y a plus d'abstraction, plus de runtime magique, plus de garbage collector bienveillant. Juste toi, 64 Ko de RAM, et un processeur qui exécute une instruction à la fois.

Le projet fil rouge de cette formation : **construire Snake en assembleur 6502**, de zéro, sur le Chuck-8.

Chaque module introduit un concept fondamental, et chaque concept répond à un besoin concret du jeu. Tu n'apprendras pas les modes d'adressage parce qu'ils sont au programme — tu les apprendras parce que tu as besoin de déplacer un serpent dans un tableau.

**Ce dont tu as besoin :**

* Le Chuck-8 ouvert dans ton navigateur
* 15 heures de curiosité
* La volonté d'accepter d'être débutant

* * *

## Table des matières

* [Module 0 — Penser comme le 6502](#module-0)
* [Module 1 — Bonjour, mémoire](#module-1)
* [Module 2 — Prendre des décisions](#module-2)
* [Module 3 — Boucles et tableaux](#module-3)
* [Module 4 — Sous-routines et stack](#module-4)
* [Module 5 — Interruptions et boucle de jeu](#module-5)
* [Module 6 — Affichage et contrôles](#module-6)
* [Module 7 — Le jeu complet](#module-7)

* * *

<a name="module-0"></a>

## Module 0 — Penser comme le 6502

*Durée estimée : 1 heure — Pas une ligne de code*

* * *

### Le problème du modèle mental

Avant d'écrire la moindre instruction, tu dois résoudre un problème d'ordre philosophique.

Quand tu codes en JavaScript, tu penses en **objets, en fonctions, en valeurs**. Tu déclares `let score = 0` et tu n'as aucune idée — ni besoin de savoir — où `score` vit en mémoire. Le runtime s'en occupe. Tu délègues.

En assembleur 6502, cette délégation n'existe pas. **Tu es le runtime.**

C'est le vrai saut à franchir. Pas la syntaxe — elle s'apprend en quelques heures. Pas les instructions — elles sont peu nombreuses. Le vrai saut, c'est de passer d'une pensée en abstractions à une pensée en adresses, en octets, en cycles.

Voici la même opération dans trois langages :

    // JavaScript
    let score = 0;
    score += 10;
    console.log(score); // 10

    # Python
    score = 0
    score += 10
    print(score)  # 10

    ; 6502 Assembleur
    ; D'abord, on décide où score vit en mémoire
    score = $0030     ; score est à l'adresse $0030
    
      LDA score       ; charge l'octet situé à $0030 dans le registre A
      CLC             ; efface le flag Carry (obligatoire avant une addition)
      ADC #10         ; ajoute 10 à A
      STA score       ; stocke le résultat de A à l'adresse $0030

Prends le temps de regarder la version 6502. Chaque ligne fait exactement une chose. Il n'y a aucune magie, aucune inférence, aucun assistant invisible. Le processeur charge une valeur, modifie un flag, ajoute, stocke. C'est tout.

**Pose-toi cette question :** dans ton langage préféré, combien d'opérations réelles se cachent derrière `score += 10` ? La réponse n'est pas "une".

* * *

### L'architecture en trois lignes

Le 6502 fonctionne selon un cycle éternel appelé **fetch-decode-execute** :

1. **Fetch** — Le processeur lit l'instruction à l'adresse pointée par le `PC` (Program Counter)
2. **Decode** — Il identifie ce que l'instruction signifie
3. **Execute** — Il l'exécute

Puis il recommence. À 1 MHz, il fait ça **un million de fois par seconde**.

Il n'y a pas de parallélisme. Pas de threads. Pas d'async/await. Une instruction, puis la suivante, puis la suivante. Ça semble primitif. C'est en réalité d'une clarté absolue.

* * *

### Les registres : tes seules variables rapides

Le 6502 possède cinq registres accessibles au programmeur. Un registre est un emplacement de stockage **directement dans le processeur** — pas en mémoire RAM. L'accès est instantané.

| Registre | Taille | Rôle |
| --- | --- | --- |
| **A** (Accumulateur) | 8 bits | Registre principal. Toutes les opérations arithmétiques et logiques passent ici. |
| **X** (Index X) | 8 bits | Compteur, index pour les tableaux, paramètre auxiliaire. |
| **Y** (Index Y) | 8 bits | Même rôle que X selon les contextes. |
| **PC** (Program Counter) | 16 bits | Adresse de la prochaine instruction à exécuter. |
| **SP** (Stack Pointer) | 8 bits | Pointeur dans la stack (détail au Module 4). |
| **P** (Status) | 8 bits | 7 drapeaux décrivant l'état du dernier calcul. |

Traduit en JavaScript, ça donnerait :

    // Si le 6502 était un objet JavaScript...
    const cpu = {
      A: 0,   // 0-255
      X: 0,   // 0-255
      Y: 0,   // 0-255
      PC: 0,  // 0-65535
      SP: 255,
      flags: { N: 0, V: 0, B: 0, D: 0, I: 0, Z: 0, C: 0 }
    };

**La contrainte cruciale :** A, X et Y font **8 bits**. Ils ne peuvent contenir que des valeurs entre 0 et 255. Si tu dépasses 255, ça déborde à 0. Si tu descends sous 0, ça déborde à 255. Cette arithmétique modulo n'est pas un bug — c'est une mécanique fondamentale que tu vas exploiter.

* * *

### Les flags : la seule façon de décider

Le registre P (Status) contient 7 bits qu'on appelle **flags** (drapeaux). Chaque instruction qui produit un résultat met à jour certains de ces flags automatiquement.

| Flag | Nom | Se lève (=1) quand… | Retombe (=0) quand… |
| --- | --- | --- | --- |
| **N** | Negative | Le bit 7 du résultat est 1 (valeur ≥ 128) | Le bit 7 du résultat est 0 (valeur ≤ 127) |
| **V** | oVerflow | Il y a un débordement en arithmétique **signée** (+127+1, -128-1) | Le résultat reste dans la plage signée [-128, +127] |
| **Z** | Zero | Le résultat est exactement 0 | Le résultat est différent de 0 |
| **C** | Carry | Il y a un report au-delà des 8 bits (résultat > 255), ou après un `CMP` si A ≥ valeur | Le résultat tient dans 8 bits (≤ 255), ou après un `CMP` si A < valeur |
| **I** | Interrupt | `SEI` est exécuté — les IRQ sont masquées | `CLI` est exécuté — les IRQ sont autorisées |
| **D** | Decimal | `SED` est exécuté — mode BCD activé | `CLD` est exécuté — mode binaire normal |
| **B** | Break | L'instruction `BRK` vient de s'exécuter | —   |

Un flag vaut toujours soit 0, soit 1 — c'est un bit. Ce qui change, c'est **quand** le processeur le met à jour :

* chaque instruction arithmétique ou logique (`ADC`, `SBC`, `AND`, `ORA`, `EOR`, `INC`, `DEC`, `ASL`…) recalcule N, Z et C après son exécution.
  
* Les instructions de chargement (`LDA`, `LDX`, `LDY`) mettent à jour N et Z uniquement.
  
* Les instructions de branchement (`BEQ`, `BCC`…) et de stockage (`STA`, `STX`…) ne touchent à aucun flag.
  

Conséquence pratique : un flag reflète toujours le résultat de la **dernière instruction qui l'a modifié** — pas forcément l'instruction juste au-dessus dans ton code. Si tu intercales un `LDA` entre un `CMP` et un `BEQ`, le `BEQ` testera le flag Z positionné par le `LDA`, pas par le `CMP`. C'est une source de bugs classique.

Ces flags sont **la seule façon de prendre des décisions** sur le 6502. Il n'y a pas d'instruction `if`. Il y a des instructions de comparaison qui positionnent les flags, et des instructions de branchement qui testent ces flags.

C'est le sujet du Module 2. Pour l'instant, retiens juste ceci : **le processeur ne "pense" pas. Il teste des bits.**

* * *

### La mémoire : une armoire de 65 536 tiroirs

Le Chuck-8 dispose de 64 Ko de RAM — soit 65 536 octets, adressés de `$0000` à `$FFFF`. Chaque adresse contient un seul octet (0 à 255).

Mais tous ces octets ne se valent pas. La mémoire est organisée en **zones** avec des rôles précis :

    $0000 - $00FF  →  Zero Page        (256 octets de variables ultra-rapides)
    $0100 - $01FF  →  Stack            (pile d'appel du processeur)
    $0200 - $3FFF  →  RAM libre        (ton espace de travail)
    $4000 - $5FFF  →  VRAM             (framebuffer vidéo)
    $4800 - $4BFF  →  VRAM texte       (caractères affichés)
    $4C00 - $4FFF  →  VRAM attributs   (couleurs)
    $D000 - $D0FF  →  I/O Registers    (contrôle du VPU, son, clavier)
    $E000 - $FFFF  →  ROM / Programme  (ton code assemblé)

La **Zero Page** mérite une attention particulière. C'est les 256 premiers octets de la RAM. Les instructions qui y accèdent sont **plus rapides et plus courtes** que celles qui accèdent au reste de la mémoire. En pratique, tu y mettras tes variables les plus utilisées — exactement comme tu mettrais tes variables les plus accédées dans le cache d'un processeur moderne.

* * *

### Exercice 0 — Carte mémoire Snake

Avant de coder, prends une feuille et dessine la carte mémoire du Chuck-8. Puis place ces variables dans la Zero Page :

    $00  →  SNAKE_X        position X de la tête
    $01  →  SNAKE_Y        position Y de la tête
    $02  →  DIR            direction (0=haut, 1=droite, 2=bas, 3=gauche)
    $03  →  LENGTH         longueur du serpent
    $04  →  FOOD_X         position X de la nourriture
    $05  →  FOOD_Y         position Y de la nourriture
    $06  →  SCORE          score actuel
    $07  →  GAME_STATE     état du jeu (0=titre, 1=jeu, 2=gameover)
    $10 - $4F  →  BODY_X  coordonnées X des 64 segments du corps
    $50 - $8F  →  BODY_Y  coordonnées Y des 64 segments du corps

**Pourquoi cet exercice ?** Parce que tu vas passer les prochains modules à écrire des instructions qui manipulent ces adresses. Si tu n'as pas de représentation mentale claire de la mémoire, chaque ligne de code sera abstraite. Si tu l'as, chaque ligne sera concrète.

* * *

### Ce que tu gardes de ce module

* Le 6502 exécute une instruction à la fois, en boucle infinie.
* Tu as 3 registres de travail (A, X, Y), chacun de 8 bits (0–255).
* Les flags sont mis à jour automatiquement et servent à prendre des décisions.
* La Zero Page est ta zone de variables rapides — utilise-la pour tout ce qui est fréquemment accédé.
* Il n'y a pas de runtime. **Tu es le runtime.**

* * *

<a name="module-1"></a>

## Module 1 — Bonjour, mémoire

*Durée estimée : 1h30*

* * *

### Deux instructions pour tout

Si tu ne devais retenir que deux instructions de tout le 6502, ce seraient celles-ci :

* **LDA** (*Load A*) — charge une valeur dans le registre A
* **STA** (*Store A*) — stocke la valeur de A en mémoire

Tout le reste est variation autour de ce principe. Voyons ça :

    LDA #$41    ; charge la valeur 65 (= ASCII 'A') dans A
    STA $0200   ; stocke A à l'adresse $0200

Le `#` devant `$41` est crucial. Il signifie **immédiat** — "utilise cette valeur directement". Sans le `#`, tu indiquerais une adresse mémoire. C'est une erreur fréquente au début, et elle produit des bugs silencieux.

    LDA #$41    ; charge la VALEUR 65 dans A         ✓ c'est ce qu'on voulait
    LDA $41     ; charge l'OCTET situé à l'adresse $0041   ≠ pas la même chose

En JavaScript, la différence serait :

    let a = 65;          // LDA #$41  — la valeur elle-même
    let a = mem[0x41];   // LDA $41   — ce qui est stocké à cet index

* * *

### Les modes d'adressage : un même mot, six sens

C'est ici que le 6502 révèle son élégance — et sa complexité initiale. Une instruction comme `LDA` peut accéder à la mémoire de **six façons différentes**, selon le contexte. Ces façons s'appellent les **modes d'adressage**.

Rodnay Zaks y consacre un chapitre entier. Avec raison : les maîtriser, c'est maîtriser le 6502.

    ; Mode 1 : Immédiat — la valeur est dans l'instruction elle-même
    LDA #$41        ; A = 65
    
    ; Mode 2 : Zero Page — adresse sur 1 octet (plus rapide, plus court)
    LDA $30         ; A = mem[$0030]
    
    ; Mode 3 : Absolu — adresse sur 2 octets (accès à toute la mémoire)
    LDA $4800       ; A = mem[$4800]
    
    ; Mode 4 : Zero Page indexé — adresse ZP + valeur de X
    LDA $30,X       ; A = mem[$0030 + X]   ← parfait pour les tableaux ZP
    
    ; Mode 5 : Absolu indexé — adresse + valeur de X (ou Y)
    LDA $4800,X     ; A = mem[$4800 + X]   ← parfait pour parcourir la VRAM
    
    ; Mode 6 : Indirect post-indexé — l'adresse est stockée en ZP, + Y
    LDA ($30),Y     ; lit l'adresse 16-bit stockée à $30/$31, puis A = mem[cette_adresse + Y]

Le mode 6 (indirect post-indexé) peut sembler obscur. Voici son équivalent en C :

    // ($30),Y en C :
    uint16_t ptr = *(uint16_t*)0x30;  // lit un pointeur 16-bit depuis la Zero Page
    uint8_t value = *(uint8_t*)(ptr + Y); // déréférence avec offset Y

C'est exactement un **pointeur avec offset**. Si tu as déjà utilisé des pointeurs en C ou en Rust, tu connais déjà ce concept — juste avec une syntaxe différente.

Les modes LDX et LDY existent aussi, avec leurs propres combinaisons. STX et STY permettent de stocker X et Y en mémoire. La logique est identique.

* * *

### Pourquoi autant de modes ?

Pose-toi la question une seconde. Pourquoi ne pas avoir juste `LDA adresse` et `LDA #valeur` ?

La réponse est **la performance**. Sur une machine à 1 MHz, chaque cycle compte. Un accès en Zero Page prend **3 cycles et 2 octets** d'instruction. Un accès absolu prend **4 cycles et 3 octets**. Sur une boucle qui s'exécute 1000 fois par frame, cette différence est visible à l'écran.

    LDA $4800   ; 4 cycles, 3 octets — accès absolu
    LDA $30     ; 3 cycles, 2 octets — accès Zero Page (1 cycle/octet économisé)

Ce n'est pas de l'optimisation prématurée. C'est la réalité d'une machine contrainte — et c'est ce qui rend l'exercice intellectuellement honnête. **Chaque décision a un coût visible.**

* * *

### Les constantes et l'assembleur ca65

Sur le Chuck-8, on utilise l'assembleur **ca65**. Une de ses fonctionnalités importantes est la définition de constantes symboliques :

    ; Constantes — noms pour les adresses (ne prennent pas de place en mémoire)
    SNAKE_X = $00
    SNAKE_Y = $01
    DIR     = $02
    LENGTH  = $03
    
    ; Utilisation
    LDA #16
    STA SNAKE_X    ; équivalent à STA $00
    STA SNAKE_Y    ; équivalent à STA $01

Ces constantes n'existent que dans la source. L'assembleur les remplace par les valeurs numériques lors de la compilation. C'est exactement comme un `#define` en C ou un `const` en JavaScript — sauf que ça ne coûte absolument rien au runtime.

* * *

### Structure minimale d'un programme Chuck-8

Chaque programme Chuck-8 a besoin d'une structure de base. L'assembleur ca65 doit savoir où placer ton code en mémoire, et le processeur doit savoir où commencer.

    ; ── Constantes ────────────────────────────────────────────────
    SNAKE_X = $00
    SNAKE_Y = $01
    DIR     = $02
    
    ; ── Vecteurs système (adresses fixes en ROM) ──────────────────
    SYS_SET_CURSOR = $F02A
    SYS_READ_PAD   = $F000
    
    ; ── Début du programme ────────────────────────────────────────
    .org $E000          ; dit à l'assembleur : place le code à partir de $E000
    
    RESET:
      ; Point d'entrée — exécuté au démarrage
      LDA #16
      STA SNAKE_X
      LDA #16
      STA SNAKE_Y
      LDA #1          ; direction initiale : droite
      STA DIR
    
    MAIN_LOOP:
      JMP MAIN_LOOP   ; boucle infinie (le NMI gère la logique — Module 5)
    
    ; ── Vecteurs d'interruption (obligatoires) ────────────────────
    .org $FFFA
    .word NMI_STUB    ; vecteur NMI
    .word RESET       ; vecteur RESET
    .word IRQ_STUB    ; vecteur IRQ
    
    NMI_STUB:
      RTI
    IRQ_STUB:
      RTI

Ne t'inquiète pas des vecteurs d'interruption pour l'instant — on y revient au Module 5. Retiens juste que `.org $E000` positionne ton code, et que `RESET:` est le point d'entrée.

* * *

### Exercice 1 — Initialiser le serpent

Écris un programme qui initialise les variables de Snake en Zero Page :

* `SNAKE_X` = 16 (centre horizontal du plateau 32×32)
* `SNAKE_Y` = 16 (centre vertical)
* `DIR` = 1 (droite)
* `LENGTH` = 3 (longueur initiale)
* `SCORE` = 0

Puis place la nourriture à une position différente, par exemple (24, 8).

**Questions pour guider ta réflexion :**

* Pourquoi doit-on utiliser `STA` et pas directement écrire à l'adresse ?
* Pourquoi `LDA #0` puis `STA SCORE` plutôt qu'une seule instruction ?
* Quelle est la différence entre `LDA #16` et `LDA #$10` ?

* * *

### Ce que tu gardes de ce module

* `LDA` charge, `STA` stocke. Le `#` signifie "valeur immédiate".
* Les modes d'adressage sont des façons d'indiquer *d'où* vient la valeur — pas des instructions différentes.
* La Zero Page est plus rapide que la mémoire absolue. Mets-y tes variables chaudes.
* Les constantes symboliques (`SNAKE_X = $00`) sont pour toi, pas pour le processeur.

* * *

<a name="module-2"></a>

## Module 2 — Prendre des décisions

*Durée estimée : 2 heures*

* * *

### Il n'y a pas de `if`

Voilà quelque chose qui va heurter ton instinct de développeur : **le 6502 n'a pas d'instruction `if`**.

Il a quelque chose de plus fondamental : des instructions qui **comparent** (et positionnent les flags), et des instructions qui **sautent conditionnellement** (selon ces flags). La combinaison des deux te donne toutes les structures de contrôle que tu veux.

Rodnay Zaks formule ça clairement : *"Le processeur ne comprend pas les conditions. Il teste des bits dans le registre de status, et décide de sauter ou non."*

* * *

### CMP : comparer sans modifier

L'instruction `CMP` (CoMPare) soustrait une valeur de A **sans stocker le résultat** — elle met juste à jour les flags.

    LDA score
    CMP #100        ; calcule score - 100, ne modifie pas A

Après ce `CMP`, les flags sont positionnés ainsi :

| Résultat | Flag Z | Flag C | Flag N |
| --- | --- | --- | --- |
| A == valeur | 1   | 1   | 0   |
| A > valeur | 0   | 1   | 0   |
| A < valeur | 0   | 0   | 1   |

Ce tableau est à mémoriser. Tu vas l'utiliser des centaines de fois.

* * *

### Les instructions de branchement

Après un `CMP`, tu utilises un **branchement conditionnel** qui teste un flag et saute (ou non) à une étiquette.

| Instruction | Signification | Condition |
| --- | --- | --- |
| `BEQ label` | Branch if EQual | Z = 1 |
| `BNE label` | Branch if Not Equal | Z = 0 |
| `BCC label` | Branch if Carry Clear | C = 0 (A < valeur) |
| `BCS label` | Branch if Carry Set | C = 1 (A ≥ valeur) |
| `BMI label` | Branch if MInus | N = 1 (résultat négatif) |
| `BPL label` | Branch if PLus | N = 0 (résultat positif ou nul) |

**Attention :** les branchements conditionnels ont une portée limitée à **±127 octets**. Si ta cible est plus loin, utilise `JMP` (saut inconditionnel, portée 16-bit).

* * *

### La logique inversée : le pattern fondamental du 6502

Avant de voir les exemples, il y a une chose à comprendre — parce que si tu la rates, chaque bloc conditionnel va te sembler écrit à l'envers.

En JavaScript, tu écris la condition que tu *veux* tester, et tu mets le code correspondant à l'intérieur :

    if (score >= 100) {
      // code qui s'exécute quand la condition est vraie
    }

En 6502, tu fais **l'inverse** : tu testes la condition *contraire* pour sauter par-dessus le bloc. Le code du `if` n'est pas dans une branche — il est inline, dans le fil normal d'exécution.

                            ┌─ condition vraie ──────────────────┐
                            │                                    │
      CMP #100              │  (on ne saute pas, on continue)    │
      BCC PAS_ENCORE  ──────┼─ condition fausse → on saute  ─────┼──→ PAS_ENCORE:
                            │                                    │
                       code du if ◄──────────────────────────────┘

La règle à retenir : **tu branches sur la négation de ta condition, vers la fin du bloc.**

| Ce que tu veux tester | Ce que tu branches |
| --- | --- |
| `if (A == valeur)` | `BNE FIN` — saute si *différent* |
| `if (A != valeur)` | `BEQ FIN` — saute si *égal* |
| `if (A >= valeur)` | `BCC FIN` — saute si *inférieur* |
| `if (A < valeur)` | `BCS FIN` — saute si *supérieur ou égal* |

C'est contre-intuitif au début. Ça devient un réflexe après quelques heures. La clé : **lis le branchement comme une porte de sortie**, pas comme une entrée dans le bloc.

* * *

### Construire les structures de contrôle

Voici la traduction des structures JavaScript courantes — en gardant ce pattern en tête :

**if simple :**

    // JavaScript
    if (score >= 100) {
      win();
    }

    ; 6502 — on veut "si >= 100", donc on branche sur la négation : "si < 100"
      LDA score
      CMP #100
      BCC PAS_ENCORE    ; ← porte de sortie : si score < 100, on saute par-dessus
      JSR WIN           ; ← code du if — atteint seulement si score >= 100
    PAS_ENCORE:         ; ← la vie continue ici dans les deux cas

**if / else :**

    // JavaScript
    if (dir === 1) {
      snake_x++;
    } else {
      snake_y++;
    }

    ; 6502 — on veut "si == 1", donc on branche sur la négation : "si != 1"
      LDA DIR
      CMP #1
      BNE ELSE_BRANCH   ; ← porte de sortie vers le else : si DIR != 1, on saute
      ; then : DIR == 1 — atteint seulement si on n'a pas sauté
      INC SNAKE_X
      JMP APRES         ; ← on saute par-dessus le else
    ELSE_BRANCH:
      ; else : DIR != 1
      INC SNAKE_Y
    APRES:

Le `JMP APRES` est obligatoire dans le bloc `then` — sans lui, l'exécution tomberait dans le `else` après avoir fini le `then`.

**Ternaire / valeur par défaut :**

    // JavaScript
    let color = (lives > 1) ? WHITE : RED;

    ; 6502 — astuce : on charge la valeur par défaut (WHITE), puis on la remplace
    ; conditionnellement. Ça évite un JMP en fin de bloc.
      LDA #WHITE        ; valeur par défaut — sera conservée si lives > 1
      LDX lives
      CPX #2            ; on veut "> 1", soit ">= 2"
      BCS COULEUR_OK    ; si lives >= 2, on garde WHITE — porte de sortie
      LDA #RED          ; sinon, on écrase avec RED
    COULEUR_OK:
      STA couleur

Ce pattern "charge la valeur par défaut, écrase conditionnellement" est très courant en 6502. Il évite un `JMP` et économise des cycles.

* * *

### Les quatre directions de Snake

Avant de regarder le code, pose-toi cette question : dans un tableau de cases 32×32, qu'est-ce que "aller à droite" signifie concrètement pour une coordonnée ?

La réponse : aller à droite, c'est augmenter X. Aller à gauche, c'est diminuer X. Aller en bas, c'est augmenter Y (l'axe Y pointe vers le bas, comme en VRAM). Aller en haut, c'est diminuer Y.

             Y diminue (↑ haut)
                  │
    X diminue ────┼──── X augmente
    (← gauche)    │     (droite →)
                  │
             Y augmente (↓ bas)

C'est le repère standard de la quasi-totalité des systèmes vidéo — l'origine `(0,0)` est en haut à gauche, Y croît vers le bas. Si tu as déjà travaillé avec le canvas HTML ou CSS, tu connais déjà ce repère.

Maintenant le code :

    ; Déplacer la tête selon DIR
    ; 0=haut, 1=droite, 2=bas, 3=gauche
    
      LDA DIR           ; charge la direction courante dans A
      BEQ MOVE_UP       ; si DIR == 0 → haut (BEQ teste Z=1, soit A==0 sans CMP)
      CMP #1
      BEQ MOVE_RIGHT    ; si DIR == 1 → droite
      CMP #2
      BEQ MOVE_DOWN     ; si DIR == 2 → bas
      ; si on arrive ici, DIR == 3 → gauche (pas besoin de CMP)
      DEC SNAKE_X       ; gauche = X diminue
      JMP MOVE_DONE
    
    MOVE_UP:
      DEC SNAKE_Y       ; haut = Y diminue
      JMP MOVE_DONE
    
    MOVE_RIGHT:
      INC SNAKE_X       ; droite = X augmente
      JMP MOVE_DONE
    
    MOVE_DOWN:
      INC SNAKE_Y       ; bas = Y augmente
                        ; pas de JMP ici — MOVE_DONE suit immédiatement
    
    MOVE_DONE:

Deux détails méritent attention.

**Le premier `BEQ` sans `CMP` préalable.** En chargeant `DIR` avec `LDA`, le flag Z est automatiquement positionné si A vaut 0. `BEQ MOVE_UP` exploite ça directement — pas besoin de `CMP #0`. C'est le pattern "LDA positionne déjà les flags" qu'on voit partout en 6502 : une instruction économisée, deux cycles gagnés.

**La direction gauche n'a pas de `CMP`.** Si on arrive à la fin de la chaîne de tests sans avoir sauté, c'est que DIR ne vaut ni 0, ni 1, ni 2. La seule valeur restante valide est 3. On agit directement, sans vérification. C'est un choix délibéré : au lieu d'un quatrième `CMP #3` / `BEQ`, on laisse tomber le dernier cas dans le fil d'exécution. Plus court, plus rapide — et correct tant que DIR ne contient jamais une valeur invalide.

`INC` et `DEC` modifient directement un octet en mémoire sans passer par A. Là où tu écrirais `LDA SNAKE_X : CLC : ADC #1 : STA SNAKE_X` (4 instructions), `INC SNAKE_X` fait la même chose en une seule.---

### Exercice 2 — Détection des murs

Le plateau de Snake fait 32 × 32 cases. Quand le serpent sort du plateau, c'est game over.

Écris une sous-routine `CHECK_WALLS` qui détecte les quatre murs :

    CHECK_WALLS:
      ; Mur droit : SNAKE_X >= 32
      LDA SNAKE_X
      CMP #32
      BCC CHECK_LEFT    ; si < 32, pas de collision à droite
      JMP GAME_OVER
    
    CHECK_LEFT:
      ; Mur gauche : SNAKE_X == 255 (débordement sous 0 !)
      ; (Après DEC sur 0, on obtient 255 — l'arithmétique modulo)
      CMP #255
      BNE CHECK_BOTTOM
      JMP GAME_OVER
    
    CHECK_BOTTOM:
      ; ... à toi de compléter pour les murs haut et bas

**Pourquoi `CMP #255` et pas `CMP #0` pour le mur gauche ?**

Rappelle-toi le Module 0 : les registres et la mémoire sont sur 8 bits, l'arithmétique est modulo 256. Quand `SNAKE_X` vaut 0 et que tu fais `DEC SNAKE_X`, tu ne passes pas à -1 — tu passes à **255**. Le débordement est silencieux, il n'y a pas d'erreur, pas de flag d'alerte. La valeur wrape simplement.

Tester `CMP #0` après un `DEC` ne servirait donc à rien : à 0, le serpent est encore sur la case la plus à gauche du plateau, pas hors-limite. C'est le tick *suivant*, quand il passe de 0 à 255, qui signale la sortie.

C'est exactement l'arithmétique modulo qu'on utilise intentionnellement dans les boucles décroissantes — mais ici c'est un piège, pas une feature. À surveiller chaque fois qu'une position peut descendre sous 0.

**Questions :**

* Pourquoi utilise-t-on `BCC` (Carry Clear) pour tester `< 32` ?
* Que se passe-t-il si tu oublies les `JMP MOVE_DONE` dans la routine de déplacement ?
* Comment testerais-tu que `SNAKE_Y == 255` après un dépassement vers le haut ?

* * *

### Ce que tu gardes de ce module

* Il n'y a pas de `if` — il y a `CMP` + un branchement conditionnel.
* `CMP` ne modifie pas A, il positionne les flags.
* `BCC` = inférieur strict, `BCS` = supérieur ou égal. Mémorise ce tableau.
* Les branchements sont limités à ±127 octets — utilise `JMP` pour les grandes distances.
* `INC`/`DEC` modifient la mémoire directement — pratique pour les compteurs.

* * *

<a name="module-3"></a>

## Module 3 — Boucles et tableaux

*Durée estimée : 2 heures*

* * *

### Le corps du serpent : un tableau en mémoire

Un serpent de longueur N a N segments. Chaque segment a une position X et une position Y. Pour un serpent de longueur maximale 64, on a besoin de 128 octets : 64 pour les X, 64 pour les Y.

On les stocke en Zero Page :

    BODY_X = $10    ; $10 à $4F : 64 coordonnées X
    BODY_Y = $50    ; $50 à $8F : 64 coordonnées Y

C'est exactement un tableau C :

    uint8_t body_x[64];  // à l'adresse $10
    uint8_t body_y[64];  // à l'adresse $50

Pour accéder à l'élément i du tableau, on utilise l'**adressage Zero Page indexé** : `body_x,X` où X contient l'index.

    LDX #0
    LDA BODY_X,X    ; lit body_x[0]
    
    LDX #3
    LDA BODY_X,X    ; lit body_x[3]

* * *

### Les boucles : deux formes idiomatiques

**La boucle croissante** (INX / CPX / BNE) :

    ; for (X = 0; X < 8; X++) { mem[$0200 + X] = 7 }
    
      LDA #7
      LDX #0
    BOUCLE_CROISSANTE:
      STA $0200,X
      INX
      CPX #8
      BNE BOUCLE_CROISSANTE

**La boucle décroissante** (DEX / BNE) — la forme préférée du 6502 :

    ; for (X = 7; X >= 0; X--) { mem[$0200 + X] = 7 }
    ; (en pratique : compte de 8 à 1, s'arrête à 0)
    
      LDA #7
      LDX #8
    BOUCLE_DECROISSANTE:
      STA $0200,X
      DEX
      BNE BOUCLE_DECROISSANTE

Pourquoi la forme décroissante est-elle préférée ? Parce que `DEX` met à jour le flag Z automatiquement. `DEX` + `BNE` = 2 instructions, 5 cycles. `INX` + `CPX #n` + `BNE` = 3 instructions, 7 cycles.

Sur une boucle de 64 itérations, tu économises 128 cycles. À 1 MHz, ça représente 0,128 ms — soit une fraction non négligeable d'une frame à 60 Hz (16,7 ms).

Zaks : *"Sur le 6502, la boucle décroissante terminant à zéro est la structure la plus efficace disponible."*

* * *

### Déplacer le corps du serpent

À chaque tick du jeu, le corps du serpent doit avancer : chaque segment prend la position du segment précédent. En C :

    for (int i = length - 1; i > 0; i--) {
      body_x[i] = body_x[i-1];
      body_y[i] = body_y[i-1];
    }
    // puis mettre body_x[0] et body_y[0] à la nouvelle position de la tête

En 6502, cette boucle décroissante se traduit naturellement :

    SHIFT_BODY:
      ; X = index courant (commence à LENGTH-1, descend jusqu'à 1)
      LDX LENGTH
    SHIFT_LOOP:
      LDA BODY_X - 1,X   ; charge segment[X-1]
      STA BODY_X,X        ; stocke en segment[X]
      LDA BODY_Y - 1,X
      STA BODY_Y,X
      DEX
      CPX #0
      BNE SHIFT_LOOP      ; continue jusqu'à X == 0 (segment 0 = tête, traité séparément)
    
      ; Mettre à jour la tête
      LDA SNAKE_X
      STA BODY_X          ; body_x[0] = SNAKE_X
      LDA SNAKE_Y
      STA BODY_Y          ; body_y[0] = SNAKE_Y
      RTS

**Attention à `BODY_X - 1,X` :** Cette syntaxe dit à l'assembleur de calculer `(adresse de BODY_X) - 1 + X`. Ce n'est pas une soustraction à l'exécution — c'est un calcul d'adresse à la compilation. L'assembleur produit une instruction qui accède à `adresse_de_BODY_X - 1 + X` au runtime.

* * *

### Détecter la collision avec soi-même

Pour détecter si la tête (`SNAKE_X`, `SNAKE_Y`) entre en collision avec un segment du corps, on parcourt tous les segments avec une boucle :

    CHECK_SELF_COLLISION:
      LDX LENGTH          ; commence à LENGTH-1 (le dernier segment)
      DEX                 ; (on ignore le segment 0 = la tête elle-même)
    SELF_LOOP:
      LDA BODY_X,X
      CMP SNAKE_X
      BNE SELF_NEXT       ; X différent ? pas de collision ici
      LDA BODY_Y,X
      CMP SNAKE_Y
      BEQ SELF_HIT        ; X et Y identiques ? collision !
    SELF_NEXT:
      DEX
      BNE SELF_LOOP
      RTS                 ; aucune collision trouvée
    
    SELF_HIT:
      JMP GAME_OVER

C'est exactement ce qu'un moteur de collision naïf fait dans n'importe quel langage — une boucle O(n). Sur 64 segments maximum, c'est parfaitement acceptable à 1 MHz.

* * *

### Les données statiques avec `.byte`

Pour la nourriture, on a besoin d'une position initiale. Pour l'écran titre, on a besoin de chaînes de caractères. L'assembleur ca65 permet de définir des données statiques avec la directive `.byte` :

    ; Table de valeurs — indices dans la police de caractères
    TITRE_TEXT:
      .byte "SNAKE", 0    ; chaîne ASCII terminée par un zéro
    
    ; Table de positions initiales de nourriture (pour les premiers tests)
    FOOD_POSITIONS:
      .byte 24, 8         ; première nourriture : (24, 8)
      .byte 5, 20         ; deuxième : (5, 20)
      .byte 15, 15        ; troisième : (15, 15)

Pour lire la table :

    LDX #0
    LDA FOOD_POSITIONS,X    ; charge 24 (food_x initial)
    STA FOOD_X
    INX
    LDA FOOD_POSITIONS,X    ; charge 8 (food_y initial)
    STA FOOD_Y

* * *

### Exercice 3 — Corps complet

Implémente la logique complète de déplacement du serpent :

1. `SHIFT_BODY` : décale le corps (comme montré ci-dessus)
2. `MOVE_HEAD` : déplace la tête selon `DIR` (du Module 2)
3. `CHECK_FOOD` : vérifie si la tête est sur la nourriture (comparer `SNAKE_X` avec `FOOD_X` et `SNAKE_Y` avec `FOOD_Y`)

Si la nourriture est mangée :

* Incrémenter `LENGTH` (jusqu'à 64 maximum)
* Incrémenter `SCORE`
* Repositionner la nourriture (pour l'instant, une position fixe suffit — le pseudo-aléatoire arrive au Module 7)

**Questions :**

* Pourquoi la boucle `SHIFT_BODY` doit-elle commencer par `LENGTH-1` et non `LENGTH` ?
* Que se passe-t-il si `LENGTH` est 0 quand tu fais `DEX` au début de `SHIFT_BODY` ?
* Comment gérerais-tu un serpent de longueur maximale (64 segments) ?

* * *

### Ce que tu gardes de ce module

* Les tableaux en mémoire s'accèdent avec l'adressage indexé : `BODY_X,X`.
* La boucle décroissante `DEX/BNE` est la forme idiomatique du 6502 — plus rapide que `INX/CPX/BNE`.
* `BODY_X - 1,X` calcule un offset d'adresse à la compilation, pas au runtime.
* `.byte` déclare des données statiques dans le programme.

* * *

<a name="module-4"></a>

## Module 4 — Sous-routines et stack

*Durée estimée : 1h30*

* * *

### La pile : 256 octets pour organiser ton programme

Jusqu'ici, ton programme est une liste d'instructions qui s'exécutent de haut en bas, avec des sauts (`JMP`, `BEQ`, etc.). C'est correct pour de petits programmes — mais dès que la complexité augmente, tu as besoin de **sous-routines** : des blocs de code réutilisables qu'on appelle et auxquels on revient.

Pour ça, le 6502 utilise la **stack** (pile) — une zone mémoire fixe à `$0100–$01FF`, gérée par le registre SP (Stack Pointer).

La stack est un LIFO (*Last In, First Out*) : le dernier élément empilé est le premier récupéré. Le SP commence à `$FF` et **décrémente** à chaque empilement. Autrement dit, la stack **monte vers le bas** en mémoire.

Deux instructions pour l'utiliser manuellement :

    PHA     ; empile A sur la stack (SP--, mem[$0100 + SP] = A)
    PLA     ; dépile la stack dans A (A = mem[$0100 + SP], SP++)

* * *

### JSR et RTS : appeler une sous-routine

`JSR` (*Jump to SubRoutine*) saute à une adresse et **empile automatiquement l'adresse de retour** sur la stack. `RTS` (*ReTurn from Subroutine*) dépile cette adresse et reprend l'exécution là où `JSR` a été appelé.

    ; Programme principal
      JSR MA_ROUTINE    ; saute à MA_ROUTINE, empile l'adresse de retour
      ; ← l'exécution reprend ici après le RTS
      LDA #0
    
    ; Sous-routine
    MA_ROUTINE:
      LDA #$FF
      STA $0200
      RTS               ; retourne à l'adresse empilée par JSR

En JavaScript :

    function maRoutine() {
      mem[0x0200] = 0xFF;
    }
    
    // Appel
    maRoutine();           // équivalent de JSR MA_ROUTINE
    let a = 0;             // JSR reprend ici après le RTS

La différence fondamentale : en JavaScript, le runtime gère la pile d'appel automatiquement. En 6502, c'est **toi** qui gères tout ce qui touche à la stack.

* * *

### Le piège classique : les registres ne sont pas sauvegardés

Quand tu appelles une sous-routine avec `JSR`, **les registres A, X, Y ne sont pas préservés**. Si ta routine modifie A et que tu en avais besoin après, tu dois le sauvegarder toi-même **avant** l'appel.

      LDA #42         ; A = 42, important pour la suite
      JSR MA_ROUTINE  ; MA_ROUTINE écrase A !
      ; A est maintenant corrompu
      STA resultat    ; on stocke n'importe quoi

La solution : `PHA` avant, `PLA` après.

      LDA #42
      PHA             ; sauvegarde A sur la stack
      JSR MA_ROUTINE  ; peut écraser A librement
      PLA             ; restaure A = 42
      STA resultat    ; correct

Pour X et Y, il faut passer par A :

      TXA             ; Transfer X to A
      PHA             ; empile X (via A)
      JSR ROUTINE
      PLA
      TAX             ; Transfer A to X — restaure X

Les instructions `TXA`, `TAX`, `TYA`, `TAY` transfèrent entre registres. Sur le 6502, il n'existe pas de `PHX` ou `PHY` — tout passe par A pour aller sur la stack.

* * *

### Passer des paramètres

Le 6502 n'a pas de conventions d'appel standardisées comme les ABIs modernes (System V, Windows x64). Tu inventes les tiennes, et c'est valable.

Trois approches courantes :

**1. Via les registres** (pour 1 à 3 paramètres) :

    ; Convention : X = colonne, Y = ligne, A = caractère
      LDX #5
      LDY #3
      LDA #'A'
      JSR DRAW_CHAR

**2. Via la Zero Page** (pour plus de paramètres, ou des valeurs 16-bit) :

    PARAM_X = $F0
    PARAM_Y = $F1
    
      LDA #5  : STA PARAM_X
      LDA #3  : STA PARAM_Y
      JSR DRAW_CHAR

**3. Via le stack** (rare en 6502, mais possible) :

      LDA #5
      PHA
      LDA #3
      PHA
      JSR DRAW_CHAR     ; la routine dépile ses paramètres

En pratique, pour Chuck-8, on utilise un mélange des deux premières approches selon le contexte.

* * *

### Refactoriser Snake en sous-routines

C'est le moment d'organiser ton code. Un bon programme Snake en 6502 ressemble à ça :

    RESET:
      JSR INIT_GAME
      JMP MAIN_LOOP
    
    MAIN_LOOP:
      JMP MAIN_LOOP   ; le NMI gère tout — Module 5
    
    ; ── Initialisation ────────────────────────────────────────────
    INIT_GAME:
      LDA #16 : STA SNAKE_X
      LDA #16 : STA SNAKE_Y
      LDA #1  : STA DIR
      LDA #3  : STA LENGTH
      LDA #0  : STA SCORE
      ; ... initialiser le corps
      RTS
    
    ; ── Mise à jour (appelée par NMI) ─────────────────────────────
    UPDATE:
      JSR READ_INPUT
      JSR MOVE_SNAKE
      JSR CHECK_WALLS
      JSR CHECK_SELF_COLLISION
      JSR CHECK_FOOD
      RTS
    
    ; ── Rendu (appelée par NMI) ───────────────────────────────────
    DRAW:
      JSR CLEAR_SCREEN
      JSR DRAW_SNAKE
      JSR DRAW_FOOD
      JSR DRAW_SCORE
      RTS

Chaque sous-routine a **une seule responsabilité**. Ce n'est pas une mode du développement moderne — c'est une nécessité sur un processeur où la stack est limitée à 256 octets.

* * *

### Profondeur d'appel et limites de la stack

La stack du 6502 ne fait que 256 octets. `JSR` empile 2 octets (l'adresse de retour). Avec `PHA`, tu empiles 1 octet supplémentaire. Si tu imbriquer trop d'appels, tu dépasses la stack et le programme crashe.

    RESET → UPDATE (JSR: 2 octets)
      → READ_INPUT (JSR: 2 octets)
        → READ_PAD (JSR: 2 octets)

Ici la stack contient 6 octets. C'est très raisonnable. Un programme Snake n'aura jamais plus de 5-6 niveaux d'imbrication — tu es loin des 128 niveaux qui seraient dangereux.

**Règle pratique :** ne dépasse jamais 10 niveaux d'imbrication, et évite la récursion (elle consomme la stack jusqu'à l'épuisement).

* * *

### Exercice 4 — Refactoring

Refactorise le code que tu as écrit dans les modules précédents en sous-routines propres :

* `INIT_GAME` : initialisation complète
* `READ_INPUT` : lecture de la manette (Module 6 — pour l'instant, mettre un `RTS` vide)
* `MOVE_SNAKE` : déplacement (appelle `SHIFT_BODY` puis `MOVE_HEAD`)
* `CHECK_COLLISION` : murs + corps
* `CHECK_FOOD` : détection et gestion de la nourriture

**Questions :**

* Pourquoi faut-il sauvegarder A avant un `JSR` si ta routine l'utilise ?
* Si tu as besoin de retourner une valeur depuis une sous-routine, comment fais-tu ?
* Quelle est la différence entre `JMP LABEL` et `JSR LABEL` ?

* * *

### Ce que tu gardes de ce module

* `JSR` appelle une sous-routine et empile l'adresse de retour. `RTS` retourne.
* Les registres ne sont **pas** préservés par `JSR` — sauvegarde avec `PHA`/`PLA` si nécessaire.
* La stack est fixe à 256 octets (`$0100–$01FF`) — évite l'imbrication profonde et la récursion.
* Passe les paramètres via les registres (peu) ou la Zero Page (beaucoup).

* * *

<a name="module-5"></a>

## Module 5 — Interruptions et boucle de jeu

*Durée estimée : 2 heures*

* * *

### Le problème du temps

Jusqu'ici, ton programme s'exécute aussi vite que le CPU le permet. Sur un 6502 à 1 MHz, une boucle simple peut s'exécuter des milliers de fois par seconde. Pour un jeu, c'est inutilisable — Snake tournerait si vite qu'il serait injouable.

En JavaScript, tu réglerias ça avec `requestAnimationFrame` ou `setInterval`. Ces fonctions existent parce que le navigateur fournit un timer. Sur le Chuck-8, il n'y a pas de navigateur. Il y a le hardware — et le hardware fournit une chose équivalente : le **VBlank NMI**.

* * *

### La NMI : l'interruption non-masquable

Le VPU (Video Processing Unit) du Chuck-8 génère un signal électrique **60 fois par seconde**, à la fin de chaque frame vidéo. Ce signal déclenche une **NMI** (*Non-Maskable Interrupt*) — une interruption que le processeur ne peut pas ignorer.

Quand une NMI arrive :

1. Le CPU **finit l'instruction en cours** (il ne la coupe pas au milieu)
2. Il **empile automatiquement** PC, puis le registre P (status) sur la stack
3. Il **saute au gestionnaire NMI** — l'adresse stockée au vecteur `$FFFA`
4. À la fin du gestionnaire, `RTI` (*ReTurn from Interrupt*) restaure P et PC et reprend là où on était

    Cycle habituel : instruction → instruction → instruction → ...
                                                     ↑
                                  NMI arrive ici → sauvegarde → NMI_HANDLER → RTI → reprend

C'est exactement `requestAnimationFrame` — sauf que c'est le hardware qui l'appelle, pas un scheduler JavaScript.

* * *

### Écrire le gestionnaire NMI

La première règle du gestionnaire NMI : **sauvegarder tous les registres en entrée, les restaurer en sortie**. Le code interrompu ne doit rien remarquer.

    NMI_HANDLER:
      ; ── Entrée : sauvegarder les registres ───────────────────────
      PHA             ; empile A
      TXA : PHA       ; empile X (via A)
      TYA : PHA       ; empile Y (via A)
    
      ; ── Corps : logique du jeu ────────────────────────────────────
      JSR UPDATE      ; mise à jour de l'état
      JSR DRAW        ; rendu
    
      ; ── Sortie : restaurer les registres ─────────────────────────
      PLA : TAY       ; restaure Y
      PLA : TAX       ; restaure X
      PLA             ; restaure A
      RTI             ; retourne au code interrompu

**Pourquoi l'ordre de restauration est inversé ?** Parce que la stack est LIFO. On empile A, X, Y dans cet ordre — donc on dépile Y, X, A dans cet ordre.

* * *

### La boucle de jeu complète

Avec la NMI, la structure du programme change radicalement :

    RESET:
      ; Désactiver les interruptions pendant l'init
      SEI               ; Set Interrupt disable
      JSR INIT_GAME
      CLI               ; Clear Interrupt disable — active les NMI
    
    MAIN_LOOP:
      ; Rien à faire ici — la NMI gère tout
      JMP MAIN_LOOP
    
    NMI_HANDLER:
      PHA : TXA : PHA : TYA : PHA
      JSR UPDATE
      JSR DRAW
      PLA : TAY : PLA : TAX : PLA
      RTI

En comparaison JavaScript :

    function init() { /* ... */ }
    function update() { /* ... */ }
    function draw() { /* ... */ }
    
    function gameLoop() {
      update();
      draw();
      requestAnimationFrame(gameLoop);
    }
    
    init();
    requestAnimationFrame(gameLoop);

La logique est identique. Ce qui change, c'est **qui appelle la boucle** : dans un cas, le moteur JS via une queue d'événements ; dans l'autre, le hardware via une ligne d'interruption.

* * *

### Contrôler la vitesse du serpent

Snake ne doit pas avancer à 60 cases par seconde. On veut qu'il avance toutes les N frames — un compteur suffit :

    FRAME_COUNT = $08   ; compteur de frames (Zero Page)
    SPEED       = $09   ; frames par déplacement (ex: 8 = 7.5 déplacements/seconde)
    
    UPDATE:
      ; Décrémenter le compteur de frames
      DEC FRAME_COUNT
      BNE UPDATE_NO_MOVE  ; pas encore le bon moment
    
      ; Remettre le compteur
      LDA SPEED
      STA FRAME_COUNT
    
      ; C'est le moment de déplacer le serpent
      JSR READ_INPUT
      JSR MOVE_SNAKE
      JSR CHECK_COLLISION
      JSR CHECK_FOOD
    
    UPDATE_NO_MOVE:
      RTS

Avec `SPEED = 8`, le serpent avance 60/8 = 7,5 fois par seconde. En augmentant `SPEED` au fil du jeu, tu accélères Snake sans toucher à la logique de mouvement.

* * *

### Un détail crucial : l'ordre UPDATE puis DRAW

La NMI appelle `UPDATE` avant `DRAW`. Pourquoi pas l'inverse ?

Si tu dessines d'abord et mets à jour ensuite, tu risques de dessiner un état à moitié mis à jour lors d'une frame rapide. En mettant à jour d'abord, l'état est toujours cohérent quand le rendu se produit.

C'est le même principe que le double-buffering des moteurs de jeu modernes — sauf qu'ici on n'a qu'un seul buffer, donc **l'ordre des opérations est la seule protection contre le tearing**.

* * *

### Exercice 5 — Game loop fonctionnelle

Intègre la NMI dans ton programme Snake :

1. Écris le gestionnaire NMI complet avec sauvegarde/restauration des registres
2. Modifie `RESET` pour initialiser `FRAME_COUNT` et `SPEED`
3. Implémente `UPDATE` avec le compteur de frames
4. Pour l'instant, `DRAW` peut juste afficher un caractère à l'écran pour confirmer que ça tourne (Module 6 pour le vrai rendu)

**Questions :**

* Que se passe-t-il si tu oublies de sauvegarder A dans le gestionnaire NMI et que `UPDATE` le modifie ?
* Pourquoi `SEI` avant l'initialisation et `CLI` après ?
* Si `SPEED = 1`, à quelle fréquence le serpent avance-t-il ?

* * *

### Ce que tu gardes de ce module

* La NMI est déclenchée par le hardware 60 fois par seconde — c'est ton `requestAnimationFrame`.
* Sauvegarde **toujours** les registres en entrée du gestionnaire NMI, restaure-les en sortie.
* Un compteur de frames contrôle la vitesse du jeu sans modifier la fréquence de la boucle.
* L'ordre `UPDATE → DRAW` garantit des frames cohérentes.
* `SEI`/`CLI` activent/désactivent les interruptions.

* * *

<a name="module-6"></a>

## Module 6 — Affichage et contrôles

*Durée estimée : 2 heures*

* * *

### Le mode texte du Chuck-8

Le Chuck-8 démarre en **mode texte** : 32 colonnes × 32 lignes = 1024 caractères, chacun affiché en 4×4 pixels → 128×128 pixels au total.

La mémoire vidéo est organisée en deux zones parallèles :

* **VRAM texte** `$4800–$4BFF` : un octet par case = code ASCII du caractère
* **VRAM attributs** `$4C00–$4FFF` : un octet par case = couleurs (bits 7–4 = fond, bits 3–0 = texte)

Pour écrire à la case (colonne `c`, ligne `l`) :

    adresse = $4800 + l × 32 + c

**Exemple :** écrire `'A'` en blanc sur fond bleu à la case (5, 3) :

    ; Adresse texte : $4800 + 3×32 + 5 = $4800 + 96 + 5 = $4865
    LDA #'A'
    STA $4865
    
    ; Attribut : fond bleu (6) = bits 7-4, texte blanc (1) = bits 3-0
    ; $61 = 0110 0001
    LDA #$61
    STA $4C65    ; même offset dans la zone attributs

En pratique, calculer ces adresses à la main dans le code est fastidieux. Le Chuck-8 fournit des **fonctions système** (via ROM) qui s'en chargent.

* * *

### L'API VPU : écrire sans calculer les adresses

    ; Constantes système
    SYS_SET_CURSOR = $F02A   ; X = colonne, Y = ligne
    SYS_SET_COLOR  = $F030   ; A = (ink << 4) | paper
    VPU_CHAR_OUT   = $D00F   ; écriture du caractère en A, avance le curseur
    
    ; Exemple : écrire "SCORE" en jaune sur fond noir à (0, 0)
      LDA #$07          ; A = (yellow=7 << 4) | black=0 → #$70, mais...
                        ; Convention : SYS_SET_COLOR attend A = (paper<<4)|ink
      LDA #$07          ; ink=7 (jaune), paper=0 (noir) → $07 ... À vérifier dans la spec !
      JSR SYS_SET_COLOR
    
      LDX #0 : LDY #0
      JSR SYS_SET_CURSOR
    
      LDA #'S' : STA VPU_CHAR_OUT
      LDA #'C' : STA VPU_CHAR_OUT
      LDA #'O' : STA VPU_CHAR_OUT
      LDA #'R' : STA VPU_CHAR_OUT
      LDA #'E' : STA VPU_CHAR_OUT

Chaque écriture dans `VPU_CHAR_OUT` avance automatiquement le curseur d'une case. Pour écrire une chaîne, tu fais juste une série de `STA VPU_CHAR_OUT`.

* * *

### Dessiner le serpent

Chaque segment du serpent est un bloc plein. On peut utiliser le caractère `$DB` (bloc plein ASCII 219) ou le caractère `$20` (espace) avec un fond coloré.

    DRAW_SNAKE:
      LDX #0
    DRAW_BODY_LOOP:
      CPX LENGTH
      BCS DRAW_BODY_DONE   ; si X >= LENGTH, fin
    
      ; Positionner le curseur
      LDA BODY_X,X
      TAX                  ; ← Problème : on vient d'écraser X !
      ; ... on ne peut pas utiliser X à la fois comme index ET comme paramètre
    
      ; Solution : stocker dans des variables temporaires
      STX TEMP_X           ; sauvegarde l'index courant
      LDA BODY_X,X
      TAX                  ; X = colonne du segment
      LDA BODY_Y, ...      ; ...

Tu vois le problème ? On ne peut pas utiliser X à la fois comme index de boucle ET comme paramètre de `SYS_SET_CURSOR`. C'est une contrainte classique du 6502 avec seulement 3 registres.

**Solution idiomatique :** utiliser une variable temporaire en Zero Page pour l'index de boucle.

    LOOP_IDX = $0B   ; index temporaire pour les boucles imbriquées
    
    DRAW_SNAKE:
      LDA #0
      STA LOOP_IDX
    DRAW_BODY_LOOP:
      LDA LOOP_IDX
      CMP LENGTH
      BCS DRAW_BODY_DONE
    
      TAX                         ; X = LOOP_IDX
      LDA BODY_X,X                ; colonne du segment LOOP_IDX
      TAX                         ; X = colonne (pour SYS_SET_CURSOR)
      LDA BODY_Y                  ; ... mais on a perdu l'index !
    
      ; Mieux : tout passer par la Zero Page
      LDY LOOP_IDX
      LDA BODY_X,Y
      TAX                         ; X = colonne
      LDA BODY_Y,Y
      TAY                         ; Y = ligne
      JSR SYS_SET_CURSOR
    
      LDA #$DB                    ; bloc plein
      STA VPU_CHAR_OUT
    
      INC LOOP_IDX
      JMP DRAW_BODY_LOOP
    
    DRAW_BODY_DONE:
      RTS

Ce genre de jonglage entre registres est caractéristique du 6502. Il n'est pas élégant, mais il révèle quelque chose d'important : **quand les ressources sont rares, l'organisation du code devient critique**.

* * *

### Lire la manette

Le Chuck-8 supporte une manette NES. On la lit via `SYS_READ_PAD` :

    SYS_READ_PAD = $F000
    
    PAD_UP    = %00001000   ; $08
    PAD_DOWN  = %00000100   ; $04
    PAD_LEFT  = %00000010   ; $02
    PAD_RIGHT = %00000001   ; $01
    PAD_START = %00010000   ; $10
    
    READ_INPUT:
      LDA #0              ; joueur 0
      JSR SYS_READ_PAD    ; retourne dans A le masque des boutons pressés
    
      ; Tester chaque direction
      AND #PAD_RIGHT
      BEQ CHECK_LEFT_DIR
      LDA #1 : STA DIR    ; droite
      JMP READ_INPUT_DONE
    
    CHECK_LEFT_DIR:
      LDA #0 : JSR SYS_READ_PAD
      AND #PAD_LEFT
      BEQ CHECK_UP_DIR
      LDA #3 : STA DIR    ; gauche
      JMP READ_INPUT_DONE
    
    CHECK_UP_DIR:
      LDA #0 : JSR SYS_READ_PAD
      AND #PAD_UP
      BEQ CHECK_DOWN_DIR
      LDA #0 : STA DIR    ; haut
      JMP READ_INPUT_DONE
    
    CHECK_DOWN_DIR:
      LDA #0 : JSR SYS_READ_PAD
      AND #PAD_DOWN
      BEQ READ_INPUT_DONE
      LDA #2 : STA DIR    ; bas
    
    READ_INPUT_DONE:
      RTS

`AND #PAD_RIGHT` isole le bit correspondant à la touche droite. Si le bit est à 0 (touche non pressée), `BEQ` saute. Si le bit est à 1, on met à jour la direction.

**Amélioration importante :** Snake ne devrait pas permettre de faire demi-tour (aller droite alors qu'on va gauche). Ajoute une vérification :

    ; Avant de changer DIR vers droite (1), vérifier qu'on ne va pas gauche (3)
      LDA DIR
      CMP #3
      BEQ CHECK_LEFT_DIR   ; on va gauche, ignorer la droite
      LDA #1 : STA DIR

* * *

### Effacer l'écran

À chaque frame, il faut effacer les anciens segments du serpent. L'approche la plus simple : remplir toute la VRAM texte avec des espaces.

    SYS_CLEAR_SCREEN = $F010   ; efface l'écran et remet le curseur en (0,0)
    
    CLEAR_SCREEN:
      JSR SYS_CLEAR_SCREEN
      RTS

Si `SYS_CLEAR_SCREEN` n'existe pas dans ta version, tu peux faire la boucle manuellement :

    CLEAR_SCREEN:
      LDA #' '            ; espace = caractère "vide"
      LDX #0
    CLEAR_LOOP:
      STA $4800,X         ; efface la ligne basse (256 octets)
      STA $4900,X         ; ligne suivante
      STA $4A00,X
      STA $4B00,X
      INX
      BNE CLEAR_LOOP      ; boucle jusqu'à X déborde à 0 (256 itérations)
      RTS

* * *

### Exercice 6 — Rendu complet

Implémente `DRAW` pour Snake :

1. `CLEAR_SCREEN` — efface l'écran
2. `DRAW_SNAKE` — dessine tous les segments (en vert, par exemple)
3. `DRAW_FOOD` — dessine la nourriture (en rouge, caractère `'*'` ou `$0F`)
4. `DRAW_SCORE` — affiche "SCORE: X" en haut de l'écran

Pour le score, tu auras besoin de convertir un nombre binaire en ASCII. La conversion d'un nombre 0–9 en ASCII : `ADC #'0'` (ajouter le code ASCII de '0' = 48).

**Questions :**

* Pourquoi relit-on `SYS_READ_PAD` plusieurs fois dans `READ_INPUT` ?
* Quelle est la différence entre `AND #PAD_RIGHT` et `AND #$01` ?
* Comment afficherais-tu un score de deux chiffres (10–99) en ASCII ?

* * *

### Ce que tu gardes de ce module

* La VRAM texte est à `$4800`, les attributs couleur à `$4C00`. Format : ligne × 32 + colonne.
* `SYS_SET_CURSOR` + `VPU_CHAR_OUT` abstraient le calcul d'adresse.
* `SYS_READ_PAD` retourne un masque de bits — `AND` isole chaque touche.
* Avec 3 registres seulement, jongler entre index de boucle et paramètres nécessite des variables temporaires en ZP.

* * *

<a name="module-7"></a>

## Module 7 — Le jeu complet

*Durée estimée : 3 heures*

* * *

### Ce qu'il manque

Tu as maintenant tous les blocs de construction :

* Les variables en Zero Page (M0)
* Le déplacement et l'adressage (M1)
* Les collisions et les décisions (M2)
* Le corps du serpent et les boucles (M3)
* Les sous-routines organisées (M4)
* La game loop cadencée par NMI (M5)
* Le rendu et les contrôles (M6)

Pour avoir un vrai jeu, il manque trois choses :

1. **La nourriture aléatoire** — sans ça, le jeu est déterministe et ennuyeux
2. **L'écran titre** et l'**écran game over** — la machine à états
3. **L'affichage du score en décimal** — convertir un binaire en chiffres lisibles

* * *

### Pseudo-aléatoire : le générateur congruentiel linéaire

Il n'y a pas de `Math.random()` sur le 6502. Mais il y a une technique simple et efficace : le **générateur congruentiel linéaire** (LCG), documenté par Zaks dans son chapitre sur les algorithmes.

Un LCG fonctionne ainsi : on maintient un "seed" (une valeur initiale), et à chaque appel on calcule `seed = seed * A + C` puis on retourne `seed`. Si A et C sont bien choisis, la séquence a une très longue période.

Sur le 6502, une version 8-bit simple :

    RNG_SEED = $0C   ; valeur actuelle du générateur (Zero Page)
    
    RANDOM:
      ; seed = seed * 6 + 1 (version simplifiée)
      ; Multiplication par 6 = (seed << 2) + (seed << 1)
      LDA RNG_SEED
      ASL             ; seed * 2 (Arithmetic Shift Left)
      ASL             ; seed * 4
      ADC RNG_SEED    ; + seed original = seed * 5... oups
      ; Utilisons une constante plus simple :
      ; seed = (seed * 251 + 137) mod 256
      ; En pratique sur 8 bits : multiplication modulo 256 automatique
    
      ; Version pragmatique (moins rigoureuse mais fonctionnelle) :
      LDA RNG_SEED
      CLC
      ADC #$6D        ; + 109
      ROL             ; rotation gauche (intègre le carry)
      EOR #$B5        ; XOR avec 181
      STA RNG_SEED
      RTS             ; retourne la valeur dans A

Pour placer la nourriture :

    SPAWN_FOOD:
      JSR RANDOM
      AND #$1F        ; mod 32 (masque les 5 bits bas) → 0-31
      STA FOOD_X
      JSR RANDOM
      AND #$1F
      STA FOOD_Y
      ; Optionnel : vérifier que la nourriture n'est pas sur le serpent
      RTS

**Note sur l'initialisation du seed :** si le seed est toujours 0 au démarrage, la séquence sera toujours identique. En pratique, on peut utiliser le compteur de frames comme seed initial, ou demander au joueur d'appuyer sur Start (le moment de pression introduit de la variance).

* * *

### La machine à états

Un jeu a plusieurs **états** : titre, jeu en cours, pause, game over. Une machine à états gère ces transitions proprement.

    STATE_TITLE    = 0
    STATE_PLAYING  = 1
    STATE_GAMEOVER = 2
    
    GAME_STATE = $07   ; état courant (Zero Page)

    UPDATE:
      DEC FRAME_COUNT
      BNE UPDATE_DONE
    
      LDA SPEED
      STA FRAME_COUNT
    
      ; Dispatch selon l'état
      LDA GAME_STATE
      BEQ UPDATE_TITLE
      CMP #1
      BEQ UPDATE_PLAYING
      JMP UPDATE_GAMEOVER
    
    UPDATE_TITLE:
      ; Attendre Start
      LDA #0 : JSR SYS_READ_PAD
      AND #PAD_START
      BEQ UPDATE_DONE
      JSR INIT_GAME
      LDA #1 : STA GAME_STATE
      JMP UPDATE_DONE
    
    UPDATE_PLAYING:
      JSR READ_INPUT
      JSR MOVE_SNAKE
      JSR CHECK_COLLISION   ; si collision → met GAME_STATE à 2
      JSR CHECK_FOOD
      JMP UPDATE_DONE
    
    UPDATE_GAMEOVER:
      ; Attendre Start pour recommencer
      LDA #0 : JSR SYS_READ_PAD
      AND #PAD_START
      BEQ UPDATE_DONE
      LDA #0 : STA GAME_STATE   ; retour au titre
    
    UPDATE_DONE:
      RTS

Et dans `DRAW`, le même dispatch :

    DRAW:
      JSR CLEAR_SCREEN
      LDA GAME_STATE
      BEQ DRAW_TITLE
      CMP #1
      BEQ DRAW_PLAYING
      JMP DRAW_GAMEOVER
    
    DRAW_TITLE:
      ; Afficher "SNAKE" + "PRESS START"
      JMP DRAW_DONE
    
    DRAW_PLAYING:
      JSR DRAW_SNAKE
      JSR DRAW_FOOD
      JSR DRAW_SCORE
      JMP DRAW_DONE
    
    DRAW_GAMEOVER:
      ; Afficher "GAME OVER" + score final
    
    DRAW_DONE:
      RTS

* * *

### Afficher le score en décimal

Un score binaire de 0 à 255 doit être affiché en décimal (0 à "255"). La conversion nécessite deux divisions successives par 10.

    ; Diviser A par 10 — le 6502 n'a pas d'instruction de division
    ; On soustrait 10 en boucle et on compte
    
    SCORE_HUNDREDS = $0D
    SCORE_TENS     = $0E
    SCORE_UNITS    = $0F
    
    CONVERT_SCORE:
      LDA SCORE
    
      ; Centaines
      LDX #0
    SUB_HUNDRED:
      CMP #100
      BCC DONE_HUNDREDS
      SBC #100          ; SBC = Subtract with Carry
      INX
      JMP SUB_HUNDRED
    DONE_HUNDREDS:
      STX SCORE_HUNDREDS
    
      ; Dizaines
      LDX #0
    SUB_TEN:
      CMP #10
      BCC DONE_TENS
      SBC #10
      INX
      JMP SUB_TEN
    DONE_TENS:
      STX SCORE_TENS
    
      ; Unités = ce qui reste dans A
      STA SCORE_UNITS
      RTS
    
    DRAW_SCORE:
      JSR CONVERT_SCORE
    
      LDX #0 : LDY #0
      JSR SYS_SET_CURSOR
    
      LDA SCORE_HUNDREDS
      ADC #'0'          ; convertit 0-9 en '0'-'9'
      STA VPU_CHAR_OUT
    
      LDA SCORE_TENS
      ADC #'0'
      STA VPU_CHAR_OUT
    
      LDA SCORE_UNITS
      ADC #'0'
      STA VPU_CHAR_OUT
      RTS

* * *

### Architecture finale du programme

Voici la structure complète du programme Snake en ordre logique :

    $E000  RESET         → SEI, JSR INIT_GAME, CLI, JMP MAIN_LOOP
    
           MAIN_LOOP     → JMP MAIN_LOOP (attend la NMI)
    
           NMI_HANDLER   → PHA/TXA/PHA/TYA/PHA
                           JSR UPDATE
                           JSR DRAW
                           PLA/TAY/PLA/TAX/PLA
                           RTI
    
           INIT_GAME     → initialise ZP, appelle SPAWN_FOOD
           UPDATE        → dispatch par GAME_STATE
           DRAW          → dispatch par GAME_STATE
           READ_INPUT    → SYS_READ_PAD, mise à jour DIR
           MOVE_SNAKE    → SHIFT_BODY, mise à jour SNAKE_X/Y
           SHIFT_BODY    → boucle décroissante sur BODY_X/Y
           CHECK_WALLS   → comparaisons murs, JMP GAME_OVER si collision
           CHECK_SELF    → boucle comparaison corps, JMP GAME_OVER
           CHECK_FOOD    → comparaison FOOD, INC LENGTH, SPAWN_FOOD
           SPAWN_FOOD    → RANDOM × 2, AND #$1F
           RANDOM        → LCG sur RNG_SEED
           DRAW_SNAKE    → boucle BODY_X/Y, SYS_SET_CURSOR, VPU_CHAR_OUT
           DRAW_FOOD     → SYS_SET_CURSOR, VPU_CHAR_OUT
           DRAW_SCORE    → CONVERT_SCORE, affichage ASCII
           DRAW_TITLE    → texte d'écran titre
           DRAW_GAMEOVER → texte game over + score
           CLEAR_SCREEN  → SYS_CLEAR_SCREEN ou boucle VRAM
    
    $FFFA  .word NMI_HANDLER
    $FFFC  .word RESET
    $FFFE  .word IRQ_STUB

* * *

### Exercice final — Assemblage et debugging

Assemble le programme complet. Il y aura des bugs. C'est normal, c'est prévu. Voici les bugs les plus courants en 6502 et comment les traquer :

**Bug 1 : Le serpent ne bouge pas**→ Vérifie que `FRAME_COUNT` est initialisé à une valeur > 0, et que le NMI handler est bien enregistré au vecteur `$FFFA`.

**Bug 2 : Le serpent saute aléatoirement**→ Tu as probablement un `JMP` qui cible la mauvaise étiquette, ou un branchement dont la portée est trop courte (utilise `JMP` à la place).

**Bug 3 : La nourriture apparaît sur le serpent**→ `SPAWN_FOOD` ne vérifie pas les collisions avec le corps. Ajoute une boucle de vérification, ou accepte ce comportement comme une limitation initiale.

**Bug 4 : Le score s'affiche mal**→ Vérifie que tu effaces le Carry avant les `ADC` dans `CONVERT_SCORE` (utilise `CLC` avant chaque `ADC`).

**Bug 5 : Crash au démarrage**→ Le vecteur `$FFFC` (RESET) pointe sur la bonne adresse ? Le `.org $E000` est bien placé avant `RESET:` ?

* * *

### Et maintenant ?

Tu as un Snake qui tourne sur une machine 8-bit que tu comprends entièrement. Chaque ligne de code, tu sais pourquoi elle est là.

Quelques idées pour aller plus loin :

**Améliorations gameplay :**

* Niveaux de difficulté (SPEED qui augmente à chaque nourriture)
* High score persistant (simple : une variable que tu ne réinitialises pas dans `INIT_GAME`)
* Obstacles fixes (définir des zones de mur dans une table `.byte`)

**Améliorations techniques :**

* Mode graphique pour un rendu pixel (cf. spec Chuck-8, section mode graphique, nibble-packed)
* Son lors de la collecte de nourriture (APU via les registres I/O)
* Animation de l'écran titre

**Jeux suivants :**

* Breakout — introduit les collisions avec rebond (arithmétique signée)
* Space Invaders — introduit plusieurs entités et les tables de dispatch
* Pong — introduit la physique et les timings précis

* * *

### Ce que tu gardes de cette formation

Tu n'as pas juste appris la syntaxe 6502. Tu as appris :

* **Comment un processeur fonctionne** — le cycle fetch-decode-execute, les registres, les flags. Ce modèle s'applique à tout CPU.
* **Comment la mémoire est organisée** — Zero Page, stack, VRAM. Les notions de localité de cache dans les processeurs modernes découlent directement de ça.
* **Comment une boucle de jeu fonctionne** — à 60 Hz, cadencée par une interruption hardware. Unity, Unreal, React Native — tous implémentent ce même patron.
* **Ce que coûte chaque décision** — en cycles, en octets. Cette sensibilité au coût est rare chez les développeurs modernes, et précieuse.
* **Comment débugger sans debugger** — comprendre le programme comme une séquence d'états mémoire, pas comme une boîte noire.

> *"Programmer en assembleur, c'est perdre le confort des abstractions pour gagner la clarté absolue."*

La prochaine fois que tu debugging un problème de performance en JavaScript, que tu analyses un heap dump, que tu optimises une query SQL — tu auras un modèle mental que la plupart de tes collègues n'ont pas.

Parce que tu as pensé comme le processeur.

* * *

## Annexe — Référence rapide 6502

### Instructions essentielles

| Instruction | Description |
| --- | --- |
| `LDA #v / addr` | Charge v ou mem[addr] dans A |
| `STA addr` | Stocke A à addr |
| `LDX / LDY` | Comme LDA pour X et Y |
| `STX / STY` | Comme STA pour X et Y |
| `TAX / TAY` | Transfère A vers X ou Y |
| `TXA / TYA` | Transfère X ou Y vers A |
| `ADC #v` | A = A + v + Carry (utilise CLC avant) |
| `SBC #v` | A = A - v - (1-Carry) (utilise SEC avant) |
| `INC addr` | mem[addr]++ |
| `DEC addr` | mem[addr]-- |
| `INX / DEX` | X++ ou X-- |
| `INY / DEY` | Y++ ou Y-- |
| `ASL` | Décalage gauche (×2) |
| `LSR` | Décalage droit (÷2) |
| `ROL / ROR` | Rotation gauche/droite avec Carry |
| `AND #v` | A = A AND v (isole des bits) |
| `ORA #v` | A = A OR v (active des bits) |
| `EOR #v` | A = A XOR v (inverse des bits) |
| `CMP #v` | Compare A avec v (positionne flags) |
| `CPX / CPY` | Compare X ou Y avec v |
| `BEQ / BNE` | Branche si Z=1 / Z=0 |
| `BCC / BCS` | Branche si C=0 / C=1 |
| `BMI / BPL` | Branche si N=1 / N=0 |
| `JMP addr` | Saut inconditionnel |
| `JSR addr` | Appel de sous-routine |
| `RTS` | Retour de sous-routine |
| `RTI` | Retour d'interruption |
| `PHA / PLA` | Empile / dépile A |
| `SEI / CLI` | Active / désactive les interruptions |
| `CLC / SEC` | Efface / active le flag Carry |
| `NOP` | Ne rien faire (1 cycle) |

### Modes d'adressage ca65

| Syntaxe | Mode | Exemple |
| --- | --- | --- |
| `#$FF` | Immédiat | `LDA #65` |
| `$30` | Zero Page | `LDA $30` |
| `$1000` | Absolu | `LDA $4800` |
| `$30,X` | Zero Page indexé X | `LDA BODY_X,X` |
| `$1000,X` | Absolu indexé X | `STA $4800,X` |
| `$1000,Y` | Absolu indexé Y | `LDA $4800,Y` |
| `($30),Y` | Indirect post-indexé | `LDA (PTR),Y` |

### Carte mémoire Chuck-8

    $0000–$00FF  Zero Page        Variables rapides (ton espace principal)
    $0100–$01FF  Stack            Pile d'appel (256 octets, géré automatiquement)
    $0200–$3FFF  RAM              Espace de travail général
    $4000–$5FFF  VRAM             Framebuffer (mode graphique nibble-packed)
    $4800–$4BFF  VRAM texte       Caractères (32×32 = 1024 octets)
    $4C00–$4FFF  VRAM attributs   Couleurs des caractères
    $D000–$D0FF  I/O Registers    VPU, APU, clavier, manette
    $E000–$FFF9  ROM / Programme  Ton code
    $FFFA        Vecteur NMI      Adresse du gestionnaire NMI
    $FFFC        Vecteur RESET    Adresse de démarrage
    $FFFE        Vecteur IRQ      Adresse du gestionnaire IRQ

### Adresses système Chuck-8

    SYS_READ_PAD    = $F000   ; A=joueur → A=masque boutons
    SYS_SET_CURSOR  = $F02A   ; X=col, Y=ligne
    SYS_SET_COLOR   = $F030   ; A=(ink<<4)|paper
    SYS_CLEAR       = $F010   ; efface l'écran
    
    VPU_CHAR_OUT    = $D00F   ; écrit A et avance le curseur
    VPU_INK         = $D00D   ; couleur texte (0–15)
    VPU_PAPER       = $D00E   ; couleur fond (0–15)
    
    PAD_RIGHT  = %00000001
    PAD_LEFT   = %00000010
    PAD_DOWN   = %00000100
    PAD_UP     = %00001000
    PAD_START  = %00010000
    PAD_SELECT = %00100000

* * *

*Formation Chuck-8 — Atelier 8-bit**Version 1.0 — Juin 2026*