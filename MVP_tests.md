# Chuck-8 MVP — Liste de tests utilisateur

> **Version testée :** MVP v0.1  
> **Date :** ___________  
> **Testeur :** ___________  
> **Navigateur :** ___________  
>
> Légende : ✅ OK — ❌ Bug — ⚠️ Partiel — 💬 Commentaire

---

## 1. CHARGEMENT DE L'APPLICATION

- [X] L'application se charge sans erreur console
- [X] L'éditeur de code est visible et actif
- [X] La toolbar gauche est visible avec tous ses boutons
- [X] La titlebar en haut affiche "Chuck IDE"
- [X] La status bar en bas affiche "Prêt"

**État initial des boutons :**
- [X] Assembler ✅ actif
- [X] Run ❌ désactivé
- [X] Étape ❌ désactivé
- [X] Reset ❌ désactivé
- [ ] Debug ❌ désactivé
- [X] Hexdump ❌ désactivé

---

## 2. ÉDITEUR DE CODE

### 2.1 Fonctionnement de base
- [X] On peut taper du code dans l'éditeur
- [X] La coloration syntaxique 6502 fonctionne
- [X] L'autocomplétion apparaît sur les mnémoniques (`LDA`, `STA`...)
- [X] L'autocomplétion propose les constantes système (`SYS_CLEAR`, `VPU_CTRL`...)
- [X] Les numéros de ligne sont visibles
- [X] La position curseur (ligne:col) s'affiche dans la status bar

### 2.2 Code de démonstration
- [X] L'éditeur contient un programme de démonstration par défaut au chargement
- [X] Le programme de démonstration est syntaxiquement valide (Assembler ne produit pas d'erreur)

---

## 3. TOOLBAR — MACHINE À ÉTATS

### 3.1 État IDLE → ASSEMBLED (Assembler)

Utilise ce programme minimal :
```asm
  .org $E000
  LDA #$80
  STA $D000
  BRK
```

- [X] Cliquer **Assembler** assemble le code sans erreur
- [ ] La console affiche un message de succès
- [X] La status bar affiche "Assemblé"
- [X] **Après assemblage :**
  - [X] Assembler ✅ actif
  - [X] Run ✅ actif
  - [X] Étape ❌ désactivé
  - [X] Reset ✅ actif
  - [X] Debug ✅ actif
  - [X] Hexdump ✅ actif

### 3.2 État ASSEMBLED → RUNNING (Run)
- [X] Cliquer **Run** lance l'exécution
- [ ] Le bouton Run se transforme en **Stop** (icône pause)
- [ ] La status bar affiche "En cours…"
- [ ] **En cours d'exécution :**
  - [ ] Assembler ❌ désactivé
  - [ ] Stop ✅ actif
  - [ ] Étape ❌ désactivé
  - [ ] Reset ✅ actif
  - [ ] Debug ❌ désactivé
  - [ ] Hexdump ❌ désactivé

### 3.3 État RUNNING → PAUSED (Stop)
- [ ] Cliquer **Stop** met en pause l'exécution
- [ ] Le bouton revient à **Reprendre** (icône play)
- [ ] La status bar affiche "En pause"
- [ ] **En pause :**
  - [ ] Assembler ❌ désactivé
  - [ ] Reprendre ✅ actif
  - [ ] Étape ✅ actif
  - [ ] Reset ✅ actif
  - [ ] Debug ✅ actif
  - [ ] Hexdump ✅ actif

### 3.4 État PAUSED → RUNNING (Reprendre)
- [ ] Cliquer **Reprendre** relance l'exécution depuis là où elle s'était arrêtée
- [ ] Le bouton redevient **Stop**

### 3.5 État RUNNING/PAUSED → ASSEMBLED (Reset)
- [ ] **Reset depuis RUNNING :** stoppe et réinitialise
- [ ] **Reset depuis PAUSED :** réinitialise
- [ ] Après Reset : PC=$E000, A=0, X=0, Y=0 (vérifier dans Registres)
- [ ] Après Reset : l'écran est vide (noir)
- [ ] Après Reset : le code programme est **toujours en mémoire** (Hexdump montre le code à $E000)
- [ ] Après Reset : bouton Run ✅ actif (on peut relancer sans ré-assembler)
- [ ] Après Reset : on peut directement cliquer **Debug** sans ré-assembler

### 3.6 État ASSEMBLED/PAUSED → DEBUGGING (Debug)
- [ ] Cliquer **Debug** depuis ASSEMBLED entre en mode debug
- [ ] Le bouton Debug s'allume (violet) et affiche "Quitter"
- [ ] **En mode debug :**
  - [ ] Assembler ❌ désactivé
  - [ ] Run ❌ désactivé
  - [ ] Étape ✅ actif
  - [ ] Reset ✅ actif
  - [ ] Debug "Quitter" ✅ actif
  - [ ] Hexdump ✅ actif

### 3.7 État DEBUGGING — Step
- [ ] Cliquer **Étape** exécute une seule instruction
- [ ] Le panneau Registres se met à jour après chaque étape
- [ ] La console affiche l'instruction exécutée et l'adresse (`→ $E000  LDA #$80`)
- [ ] PC avance instruction par instruction

### 3.8 Sortir du debug
- [ ] Cliquer **Quitter** (Debug) depuis DEBUGGING → retourne à ASSEMBLED
- [ ] Le bouton Debug reprend son label "Debug" et s'éteint

### 3.9 Flux Reset → Debug
- [ ] Run → Stop → Reset → Debug → Step fonctionne sans erreur
- [ ] Run → Reset → Debug → Step fonctionne sans erreur

### 3.10 Fin de programme (BRK)
- [ ] Quand le CPU atteint BRK, l'exécution s'arrête
- [ ] La status bar affiche "Terminé"
- [ ] Les boutons reviennent à l'état ASSEMBLED

---

## 4. ÉDITEUR — ERREURS D'ASSEMBLAGE

Introduis volontairement une erreur (`LDA` sans opérande, label manquant, etc.)

- [ ] L'assembleur signale l'erreur avec le numéro de ligne
- [ ] La console affiche le message d'erreur en rouge
- [ ] La status bar affiche "Erreur"
- [ ] Les boutons Run, Debug restent désactivés
- [ ] Corriger l'erreur et ré-assembler efface l'état d'erreur

---

## 5. MODALES FLOTTANTES

### 5.1 Ouverture automatique au Run
- [ ] Cliquer **Run** ouvre automatiquement la modale **Écran** si elle n'est pas déjà ouverte
- [ ] Cliquer **Run** ouvre automatiquement la modale **Registres**
- [ ] Cliquer **Run** ouvre automatiquement la modale **Mémoire**
- [ ] Si une modale est déjà ouverte, elle ne se réouvre pas en double

### 5.2 Modale Écran
- [ ] S'ouvre/ferme avec le bouton "Écran" dans la titlebar
- [ ] Affiche l'écran Chuck-8 128×128
- [ ] La modale est draggable (glisser-déposer par la barre de titre)
- [ ] La modale est redimensionnable
- [ ] En mode texte : les caractères s'affichent correctement
- [ ] En mode graphique : les pixels s'affichent correctement

### 5.3 Modale Registres
- [ ] S'ouvre/ferme avec le bouton "Registres"
- [ ] Affiche A, X, Y, PC, SP, P en temps réel
- [ ] Se met à jour pendant l'exécution
- [ ] Se met à jour après chaque Step en mode debug

### 5.4 Modale Mémoire (Hexdump)
- [ ] S'ouvre/ferme avec le bouton "Mémoire"
- [ ] Affiche le contenu de la RAM en hex
- [ ] Le code programme est visible à $E000 après assemblage

### 5.5 Z-index
- [ ] Les modales Écran/Registres/Mémoire passent **devant** la modale Aide
- [ ] La modale Aide reste toujours **derrière** les autres modales

---

## 6. MODALE AIDE (Formation)

- [ ] Le bouton **Aide (?)** dans la titlebar ouvre la modale
- [ ] La modale affiche le contenu de `formation.md` correctement rendu
- [ ] Les titres h1, h2, h3 sont différenciés visuellement
- [ ] Les blocs de code `\`\`\`asm` sont affichés avec fond sombre
- [ ] Le bouton **Copier** sur chaque bloc de code est visible et cliquable
- [ ] Cliquer **Copier** copie le code dans le presse-papier
- [ ] Cliquer **Copier** injecte le code dans l'éditeur (si setSource est disponible)
- [ ] Le bouton **Copier** affiche "✓ Copié" pendant 2 secondes après le clic
- [ ] La barre de navigation (Intro / 1·La Machine / ...) fonctionne
- [ ] Cliquer sur un chapitre scrolle vers la bonne section
- [ ] La modale est draggable
- [ ] La modale est redimensionnable
- [ ] La touche **Escape** ferme la modale
- [ ] Le bouton **✕** ferme la modale
- [ ] La modale Aide reste **derrière** les modales Écran/Registres/Mémoire

---

## 7. PROGRAMME "BONJOUR" (Test mode texte)

```asm
VPU_CTRL     = $D000
VPU_CHAR_OUT = $D00F

  .org $E000
  LDA #$80 : STA VPU_CTRL
  LDA #0 : STA $D00B
  LDA #0 : STA $D00C
  LDA #'B' : STA VPU_CHAR_OUT
  LDA #'O' : STA VPU_CHAR_OUT
  LDA #'N' : STA VPU_CHAR_OUT
  LDA #'J' : STA VPU_CHAR_OUT
  LDA #'O' : STA VPU_CHAR_OUT
  LDA #'U' : STA VPU_CHAR_OUT
  LDA #'R' : STA VPU_CHAR_OUT
  BRK
```

- [ ] Le programme s'assemble sans erreur
- [ ] Après Run, "BONJOUR" apparaît dans la modale Écran
- [ ] Le texte est en haut à gauche (colonne 0, ligne 0)
- [ ] Après Reset + Run, "BONJOUR" s'affiche à nouveau

---

## 8. PROGRAMME DE DÉMONSTRATION (Test mode graphique)

- [ ] Le programme de démonstration s'assemble sans erreur
- [ ] Des pixels colorés apparaissent et s'animent dans la modale Écran
- [ ] Les pixels couvrent l'ensemble de l'écran 128×128
- [ ] L'animation tourne en continu sans crash
- [ ] Cliquer Stop met en pause visuellement (plus de nouveaux pixels)
- [ ] Cliquer Reprendre relance l'animation

---

## 9. DÉFIS — NAVIGATION ET AFFICHAGE

### 9.1 Chargement par URL
- [ ] `?challenge=1` charge le défi 1 dans le panel latéral
- [ ] `?challenge=15` charge le défi 15
- [ ] `?challenge=30` charge le défi 30 (dernier)
- [ ] Le panel latéral s'ouvre automatiquement
- [ ] Le titre de la page (onglet navigateur) reflète le défi chargé

### 9.2 Panel latéral défi
- [ ] Le titre du défi s'affiche
- [ ] La description / les blocs de contenu s'affichent
- [ ] Le badge "⚔ Défi" est visible
- [ ] Le numéro "X / 30" s'affiche dans le header du panel
- [ ] Le bouton **‹ Précédent** est désactivé sur le défi 1
- [ ] Le bouton **› Suivant** est désactivé tant que le défi n'est pas validé

### 9.3 Navigation entre défis
- [ ] Valider un défi active le bouton **› Suivant**
- [ ] Cliquer **›** charge le défi suivant et met à jour l'URL
- [ ] Cliquer **‹** charge le défi précédent
- [ ] L'URL se met à jour (`?challenge=N`) lors de la navigation

---

## 10. DÉFIS — VALIDATION

### 10.1 Défi 1 — "Allumer la Machine"

Solution correcte :
```asm
VPU_CTRL = $D000
  .org $E000
  LDA #$80
  STA VPU_CTRL
  BRK
```

- [ ] Avec le template bugué (`.org $0600`, `LDA #$00`) → le défi échoue
- [ ] Message d'échec visible dans le panel
- [ ] Avec le code corrigé (`.org $E000`, `LDA #$80`) → le défi réussit
- [ ] Message de succès "✓ Défi réussi !" apparaît
- [ ] Animation de confettis plein écran au succès
- [ ] Le bouton "Valider le défi" disparaît après succès
- [ ] Un badge "✓" vert apparaît dans le header du panel
- [ ] Le bouton **›** s'active après succès

### 10.2 Défi 2 — vérification indépendante
- [ ] Le template bugué du défi 2 échoue
- [ ] La solution correcte réussit

### 10.3 Sauvegarde automatique
- [ ] Modifier le code d'un défi sauvegarde automatiquement en localStorage
- [ ] Recharger la page avec `?challenge=1` restaure le code sauvegardé
- [ ] Le code sauvegardé est différent du template d'origine

### 10.4 Réinitialisation de l'état après modification
- [ ] Après un succès, modifier le code retire le badge "✓" et réaffiche "Valider le défi"
- [ ] Le bouton **›** se désactive à nouveau

---

## 11. FORMATION — NAVIGATION

- [ ] `?learn` (sans numéro) charge la leçon 100 (intro)
- [ ] `?learn=100` charge la leçon 100
- [ ] `?learn=107` charge la leçon 1.7 (Premier programme)
- [ ] `?learn=130` charge la leçon 5.4 (Référence rapide)
- [ ] Le panel latéral s'ouvre automatiquement avec le contenu de la leçon
- [ ] Le badge "📖 Leçon" est visible dans le panel
- [ ] Le titre de la page reflète la leçon chargée
- [ ] Le panel affiche les blocs théorie, code, tips correctement

---

## 12. HEXDUMP ET DISASSEMBLY

### 12.1 Hexdump
Après avoir assemblé et exécuté le programme "BONJOUR" :

- [ ] Cliquer **Hexdump** dans la toolbar affiche le dump dans la console
- [ ] La zone `$E000` contient les opcodes du programme (`$A9 $80 $8D $00 $D0...`)
- [ ] La première instruction LDA #$80 correspond à `A9 80` en hex

### 12.2 Disassembly
- [ ] Cliquer **Disasm** désassemble le code depuis $E000
- [ ] La console affiche les instructions sous forme lisible (`$E000  LDA #$80`)

---

## 13. SYNTAXE ASSEMBLEUR

Teste ces syntaxes particulières (colle chaque bloc, assemble, vérifie qu'il n'y a pas d'erreur) :

### 13.1 Séparateur `:` sur une ligne
```asm
  .org $E000
  LDA #$80 : STA $D000 : BRK
```
- [ ] S'assemble sans erreur

### 13.2 Commentaires et labels
```asm
  .org $E000
START:         ; label avec commentaire
  LDA #42      ; charge 42
  STA $10      ; stocke en ZP
  BRK
```
- [ ] S'assemble sans erreur
- [ ] Hexdump : $10 contient 42 ($2A) après exécution

### 13.3 Constantes et expressions
```asm
VITESSE = 3
LIMITE  = VITESSE + 10
  .org $E000
  LDA #VITESSE
  LDA #LIMITE
  BRK
```
- [ ] S'assemble sans erreur

### 13.4 Directives `.byte`, `.word`, `.res`
```asm
  .org $E000
  JMP APRES
DATA: .byte $CA, $FE
      .word $1234
      .res 4, $00
APRES:
  BRK
```
- [ ] S'assemble sans erreur
- [ ] Hexdump à $E003 : `CA FE 34 12 00 00 00 00`

### 13.5 `ASL A` — mode accumulateur
```asm
  .org $E000
  LDA #4
  ASL A
  STA $10
  BRK
```
- [ ] S'assemble sans erreur
- [ ] $10 contient 8 après exécution

### 13.6 Mode indirect post-indexé `($zp),Y`
```asm
  .org $E000
  LDA #$00 : STA $F0
  LDA #$02 : STA $F1
  LDA #$42
  LDY #5
  STA ($F0),Y
  BRK
```
- [ ] S'assemble sans erreur
- [ ] $0205 contient $42 après exécution

---

## 14. TESTS DE RÉGRESSION — PROGRAMMES COMPLETS

### 14.1 Programme graphique minimal
```asm
SYS_SET_MODE   = $F01B
SYS_FILL_RECT  = $F00C

  .org $E000
  LDA #1 : JSR SYS_SET_MODE
  LDA #10 : STA $80
  LDA #10 : STA $81
  LDA #50 : STA $82
  LDA #30 : STA $83
  LDA #2  : JSR SYS_FILL_RECT
  BRK
```
- [ ] S'assemble sans erreur
- [ ] Un rectangle rouge apparaît dans la modale Écran

### 14.2 Programme avec boucle
```asm
SYS_DRAW_PIXEL = $F003
SYS_RAND       = $F05A

  .org $E000
  LDA #$81 : STA $D000
LOOP:
  JSR SYS_RAND : AND #$0F : BEQ LOOP
  PHA
  JSR SYS_RAND : AND #$7F : TAX
  JSR SYS_RAND : AND #$7F : TAY
  PLA
  JSR SYS_DRAW_PIXEL
  JMP LOOP
```
- [ ] S'assemble sans erreur
- [ ] Des pixels colorés s'animent à l'écran
- [ ] Stop/Reprendre fonctionne

### 14.3 Programme avec son
```asm
SYS_PLAY_NOTE = $F036
SYS_STOP_ALL  = $F03C

  .org $E000
  LDA #69 : LDX #0
  LDA #60 : STA $80
  JSR SYS_PLAY_NOTE
  JSR SYS_STOP_ALL
  BRK
```
- [ ] S'assemble sans erreur
- [ ] Produit un son (si l'audio est activé dans le navigateur)

---

## 15. PERFORMANCE ET STABILITÉ

- [ ] L'application reste stable après 5 minutes d'animation en continu
- [ ] Pas de fuite mémoire visible (usage RAM navigateur stable)
- [ ] Rechargement de page `F5` recharge l'application proprement
- [ ] Plusieurs cycles Run → Stop → Reset → Run fonctionnent sans dégradation
- [ ] L'animation de confettis ne cause pas de freeze après 10 validations successives

---

## 16. RESPONSIVE ET ACCESSIBILITÉ

- [ ] L'application est utilisable sur un écran 1280×720 minimum
- [ ] L'application est utilisable sur un écran 1920×1080
- [ ] Les tooltips des boutons de toolbar s'affichent au survol
- [ ] Les boutons désactivés sont visuellement distincts (opacité réduite)
- [ ] La console de log est scrollable

---

## RÉSUMÉ

| Section | Total | ✅ OK | ❌ Bug | ⚠️ Partiel |
|---------|-------|-------|--------|------------|
| 1. Chargement | 6 | | | |
| 2. Éditeur | 8 | | | |
| 3. Toolbar | 25 | | | |
| 4. Erreurs assemblage | 5 | | | |
| 5. Modales flottantes | 18 | | | |
| 6. Modale Aide | 16 | | | |
| 7. Programme BONJOUR | 4 | | | |
| 8. Programme démo | 6 | | | |
| 9. Défis navigation | 9 | | | |
| 10. Défis validation | 12 | | | |
| 11. Formation | 8 | | | |
| 12. Hexdump/Disasm | 5 | | | |
| 13. Syntaxe ASM | 12 | | | |
| 14. Programmes complets | 9 | | | |
| 15. Performance | 5 | | | |
| 16. Responsive | 5 | | | |
| **TOTAL** | **158** | | | |

---

## BUGS TROUVÉS

| # | Section | Description | Sévérité |
|---|---------|-------------|----------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

---

*Chuck-8 MVP Test Plan — v0.1*