# 🚀 Guide de Démarrage Rapide : Ton premier programme Chuck-8
Pour écrire un programme sur le Chuck-8, la méthodologie recommandée est de respecter la structure imposée par le BIOS système.

## 1. Préparation de l'environnement
Tu as besoin d'un assembleur compatible 6502 (comme ca65 ou vasm) et du fichier chuck.inc que nous avons défini. Assure-toi que ton fichier source est bien configuré avec .org $8000.

## 2. Le "Hello World" (Mode Texte)
Voici le squelette le plus simple pour afficher un texte à l'écran :

```
; ── helloworld.asm ──────────────────────────────────────────
  .include "chuck.inc"
  .org $8000

  .word INIT          ; Vecteur RESET obligatoire

INIT:
  LDA #0              ; 0 = Mode Texte
  JSR SYS_SET_MODE
  
  ; Nettoyer l'écran (fond noir, texte blanc)
  SET_COLOR COLOR_WHITE, COLOR_BLACK
  JSR SYS_CLEAR
  
  ; Afficher le message
  CURSOR 0, 0         ; Macro : positionne en haut à gauche
  PRINT msg           ; Macro : affiche la chaîne
  
  JMP * ; Boucle infinie

msg: .asciiz "HELLO WORLD !"
```

## 3. Anatomie d'une boucle de jeu (Game Loop)
Pour un jeu, tu dois absolument synchroniser ton rendu avec le rafraîchissement écran pour éviter les déchirures (tearing).

```
MAIN_LOOP:
  JSR SYS_WAIT_VBLANK   ; 1. Attendre le début de la frame
  JSR UPDATE_LOGIC      ; 2. Calculer les positions (balle, raquette)
  JSR DRAW_SCENE        ; 3. Dessiner dans le Framebuffer
  JMP MAIN_LOOP
```

## 4. Checklist de développement
Avant de compiler ton projet, vérifie ces 4 points :

- Vecteurs : As-tu bien mis les .word pour le RESET en tête de ton code ?

- Zero Page : Utilise-tu bien $80–$EF pour tes paramètres et variables globales afin d'économiser des cycles ?

- Synchronisation : Ton code de rendu est-il assez rapide pour finir avant le prochain VBLANK ? (Sinon, le jeu saccadera).

- Couleurs : N'oublie pas de définir tes couleurs dans la table d'attributs ($4900) si tu travailles en mode texte.