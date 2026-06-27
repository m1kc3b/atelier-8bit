# Guide du développeur — Chuck IDE

Ce document permet à n'importe quel développeur d'intervenir sur `chuck-ide`
sans connaissance préalable du projet. Il décrit l'architecture, les flux,
et **où agir** pour chaque type de modification.

> Pour les règles d'architecture (couches, conventions), voir `ARCHITECTURE.md`.
> Ce guide-ci est orienté « comment ça marche et où je touche ».

---

## 1. Le modèle mental en 30 secondes

Chuck IDE est un éditeur d'assembleur 6502 dans le navigateur, avec un émulateur
de console fictive (le **Chuck-8**) compilé depuis Rust en WASM.

L'interface est faite de **Web Components natifs** (pas de framework). Les
composants **ne s'appellent jamais directement** : ils communiquent en émettant
et écoutant des **événements typés** sur un **bus central**.

```
  Un composant émet  ─────►  bus  ─────►  les composants abonnés réagissent
  (ex: clic "Run")          (core/bus.ts)   (ex: la toolbar change d'état)
```

Pour comprendre ou modifier un comportement, la bonne question n'est pas « quel
fichier ? » mais « quel **événement** ? ». Une fois l'événement identifié, un
`grep` te donne l'émetteur et tous les récepteurs.

```bash
grep -rn "ide-defi" src/      # qui émet et qui écoute "chuck:ide-defi"
```

---

## 2. Démarrage de l'application

Point d'entrée : **`src/main.ts`**. Il fait, dans l'ordre :

1. Importe tous les composants (ce qui déclenche leur `customElements.define`).
2. Démarre les services : `funnelTracker.start()`, instancie l'`Emulator`,
   le `ChallengeManager`, le `ModalRouter`.
3. Câble les **événements transverses** qui ne relèvent d'aucun composant précis
   (transitions de la toolbar, routage des choix, garde d'authentification).

`main.ts` est donc à la fois le *composition root* (il assemble les pièces) et
le *chef d'orchestre* des événements globaux. Quand un comportement traverse
plusieurs composants, sa colle est souvent ici.

Prérequis runtime : un fichier **`.env`** à la racine de `chuck-ide/` avec :

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

Sans lui, `auth-service.ts` lève une exception au chargement et **toute l'UI
reste blanche** (le bootstrap s'arrête). C'est la première chose à vérifier si
rien ne s'affiche.

---

## 3. Carte des fichiers

```
src/
├── main.ts                     Bootstrap + orchestration des événements globaux
├── index.html                  Place les composants dans le DOM (workspace + modales)
│
├── components/                 UI — un Web Component par fichier (DOM uniquement)
│   ├── chuck-toolbar.ts            Barre de boutons (Assemble/Run/Step/Debug…)
│   ├── chuck-editor.ts             Éditeur CodeMirror
│   ├── chuck-side-panel.ts         Panneau latéral : contenu pédagogique + défis
│   ├── chuck-display.ts            Écran de la console (VPU)
│   ├── chuck-registers.ts          Registres + moniteur mémoire
│   ├── chuck-welcome-view.ts       Hub de choix : Mode Libre / Tutos / Défis
│   ├── chuck-challenges-list.ts    Liste des tutos/défis
│   ├── chuck-main-modal.ts         Conteneur de modale (titlebar + corps)
│   ├── chuck-help-modal.ts         Documentation intégrée
│   ├── chuck-auth-gate.ts          Mur d'authentification
│   ├── chuck-account-modal.ts      Compte utilisateur
│   ├── chuck-track-paywall.ts      Mur premium d'un parcours
│   ├── chuck-foundations-celebration.ts   Écran de fin du tronc commun
│   ├── chuck-onboarding-tour.ts    Visite guidée
│   ├── editor/editor.styles.ts         CSS de l'éditeur
│   ├── side-panel/side-panel.styles.ts CSS du panneau latéral
│   └── help-modal/help-modal.styles.ts CSS de la modale d'aide
│
├── features/                   Logique métier (aucun DOM)
│   ├── asm/
│   │   ├── opcodes.ts               Données : jeu d'opcodes, docs, complétions
│   │   ├── codemirror-asm.ts        Config CodeMirror (coloration, hover, breakpoints)
│   │   └── default-source.ts        Code affiché en Mode Libre
│   ├── auth/auth-service.ts         Authentification Supabase (GitHub OAuth)
│   ├── challenges/
│   │   ├── challenge-manager.ts     CERVEAU des défis : accès, validation, médailles
│   │   ├── challenges-service.ts    Données des défis (Supabase)
│   │   └── tracks-service.ts        Données des parcours (tracks)
│   └── content/content-mappers.ts   Challenge → ContentItem (affichage)
│
├── infra/                      I/O et adaptateurs externes
│   ├── storage/                    Persistance (Supabase + localStorage)
│   ├── wasm/emulator.ts            Pont vers l'assembleur/CPU Rust (WASM)
│   └── tracking/funnel-tracker.ts  Événements funnel → Supabase
│
├── core/                       Primitives transverses
│   ├── bus.ts                      Le bus + ChuckEventMap (TOUS les événements)
│   ├── base-component.ts           Classe de base des Web Components
│   ├── modal-router.ts             Pile de navigation des modales
│   └── markdown.ts                 Rendu markdown
│
└── types/                      challenge.ts, content.ts
```

---

## 4. Le bus d'événements (`core/bus.ts`)

C'est la pièce centrale. Le type `ChuckEventMap` liste **tous** les événements et
leur payload — c'est la table des matières des interactions de l'app. Pour
ajouter une communication entre composants, on ajoute une entrée ici.

### API (héritée de `ChuckComponent`, ou via `bus` directement)

```ts
this.emit("chuck:run", undefined);            // émettre
this.sub("chuck:assembled", (detail) => {});  // s'abonner (auto-nettoyé au teardown)
bus.on("chuck:ide-free", () => {});           // s'abonner hors composant (main.ts)
bus.once("chuck:cpu-halted", (s) => {});      // une seule fois
```

`sub()` dans un composant est automatiquement désabonné quand le composant est
retiré du DOM. Hors composant (dans `main.ts`), on utilise `bus.on()`.

### Familles d'événements

**Commandes d'exécution** (émises par la toolbar, exécutées par l'émulateur) :
`chuck:assemble`, `chuck:run`, `chuck:stop`, `chuck:step`, `chuck:reset`,
`chuck:debug`, `chuck:breakpoint`, `chuck:speed`, `chuck:goto`,
`chuck:hexdump`, `chuck:disassemble`.

**Résultats CPU/assembleur** (émis par l'émulateur) :
`chuck:assembled`, `chuck:assemble-err`, `chuck:cpu-updated`, `chuck:cpu-reset`,
`chuck:cpu-halted`, `chuck:cpu-error`.

**Éditeur** : `chuck:code-changed`, `chuck:cursor-moved`.

**État de la toolbar** : `chuck:toolbar-state` (`idle | assembled | running |
paused | debugging`).

**Mémoire / écran** : `chuck:memory-read`, `chuck:memory-data`,
`chuck:ram-snapshot`, `chuck:screen-key`.

**Défis & parcours** : `chuck:challenge-loaded`, `chuck:validate`,
`chuck:challenge-success`, `chuck:challenge-failed`, `chuck:goto-challenge`,
`chuck:goto-next-track-step`, `chuck:challenges-list`, `chuck:track-steps`,
`chuck:track-completed`, `chuck:track-purchase-requested`,
`chuck:foundations-completed`.

**Navigation & modales** : `chuck:modal-show`, `chuck:modal-close`,
`chuck:modal-back`, `chuck:ide-free`, `chuck:ide-defi`, `chuck:open-welcome`,
`chuck:open-help`, `chuck:view-changed`, `chuck:start-tour`.

**Auth** : `chuck:require-auth`, `chuck:signed-out`, `chuck:open-account`,
`chuck:load-project`.

---

## 5. Qui émet quoi, qui écoute quoi

Matrice extraite du code. C'est ta boussole : pour modifier une interaction,
repère l'événement, puis l'émetteur et le récepteur.

| Composant | Émet | Écoute |
|---|---|---|
| **chuck-toolbar** | assemble, run, stop, step, reset, debug, speed, hexdump, disassemble, open-account | assembled, assemble-err, code-changed, cpu-halted, toolbar-state |
| **chuck-editor** | code-changed, cursor-moved | challenge-loaded, ide-free, log |
| **chuck-display** | screen-key | cpu-halted, cpu-reset, memory-data, run, stop |
| **chuck-registers** | memory-read | cpu-updated, cpu-reset, cpu-halted |
| **chuck-welcome-view** | ide-free, ide-defi, modal-show, modal-close, start-tour | — |
| **chuck-side-panel** | validate, goto-challenge, goto-next-track-step, track-completed-request | challenge-loaded, challenge-success, challenge-failed, ide-defi, code-changed |
| **chuck-challenges-list** | goto-challenge | challenges-list |
| **chuck-main-modal** | modal-opened, modal-closed, modal-back | (via ModalRouter) |
| **chuck-help-modal** | — | open-help, challenge-loaded |
| **chuck-track-paywall** | track-purchase-requested, open-welcome, funnel-step | track-completed |
| **chuck-foundations-celebration** | goto-challenge, open-welcome, funnel-step | foundations-completed |
| **chuck-account-modal** | signed-out | — |
| **chuck-onboarding-tour** | — | start-tour, assembled, run |

Les événements **CPU** (`cpu-updated`, `assembled`…) sont émis par
`infra/wasm/emulator.ts`, pas par un composant.

`main.ts` écoute en plus : `challenge-loaded`, `ide-free`, `ide-defi`,
`goto-challenge`, `require-auth`, et toutes les transitions de toolbar.

---

## 6. Les services métier

### Émulateur — `infra/wasm/emulator.ts`

Pont vers le code Rust/WASM (`chuck_core`). Reçoit les commandes du bus et émet
les résultats CPU. Méthodes : `assemble(src)`, `run(maxCycles)`, `step()`,
`reset()`, `runHeadless(...)` (validation des défis sans affichage).

### Gestionnaire de défis — `features/challenges/challenge-manager.ts`

Le **cerveau** de tout ce qui touche aux défis. Sans DOM, entièrement testable.
Méthodes publiques principales :

- `init(emulator)` — initialise, charge les défis.
- `validate(source, hintsUsed)` — assemble + exécute headless + vérifie les
  assertions, puis émet `chuck:challenge-success` ou `chuck:challenge-failed`.
- `isAccessible(id)` — un défi est-il débloqué (accès séquentiel) ?
- `isTrackStepAccessible(id)` / `isTrackStepPremiumLocked(id)` — pour les parcours.
- `currentChallenge()` — id du défi courant.
- `getMedal(id)` / `getCompleted()` — médailles (🥇 0 indice, 🥈 1, 🥉 2+).
- `saveCompleted(id, hintsUsed)` — persiste la réussite.

### Authentification — `features/auth/auth-service.ts`

Supabase + GitHub OAuth. `signInWithGithub()`, `signOut()`, `getUser()`,
`isAuthenticated()`, `onChange(cb)`. Exporte aussi le client `supabase` brut
utilisé par les autres services.

### Stockage — `infra/storage/`

`storage-service.ts` est l'API ; deux adaptateurs derrière
(`supabase-storage-adapter`, `local-storage-adapter`). Tout passe par le service,
jamais d'accès direct au stockage depuis un composant.

### Routeur de modales — `core/modal-router.ts`

Gère une **pile** de vues dans `chuck-main-modal`. Les vues déclarées :
`welcome` (→ `chuck-welcome-view`), `tutos` (→ `chuck-challenges-list`),
`help` (→ `chuck-help-modal`). Il écoute `chuck:modal-show/close/back` et peut
exiger l'authentification (`gate`) avant d'afficher une vue.

---

## 7. Le hub de choix : Mode Libre / Tutos / Défis

C'est **`components/chuck-welcome-view.ts`**, méthode `_renderChoices()` pour le
visuel des trois cartes, et le bloc d'écouteurs juste après pour les actions :

| Carte | Émet | Résultat |
|---|---|---|
| **Mode Libre** | `chuck:ide-free` + `chuck:modal-close` | charge le code démo, ferme la modale |
| **Les Tutos** | `chuck:modal-show { view: "tutos" }` | affiche la liste des tutos |
| **Défis** | `chuck:ide-defi` + `chuck:modal-close` | bascule l'éditeur en mode défi |

Pour changer le texte/visuel des cartes → `_renderChoices()`.
Pour changer ce qui se passe au clic → le bloc d'écouteurs (les
`querySelector('[data-choice=...]').addEventListener`).

---

## 8. Flux complet : du clic « Défis » à l'affichage

Exemple de bout en bout, à suivre comme patron pour tes propres features.

```
1. chuck-welcome-view   : clic carte "Défis"
                          → emit chuck:ide-defi
                          → emit chuck:modal-close

2. main.ts              : écoute chuck:ide-defi
                          → demande au ChallengeManager le défi courant
                          → emit chuck:goto-challenge { id }

3. ModalRouter          : écoute chuck:goto-challenge → ferme la modale

4. challenge-manager    : charge le défi (challenges-service)
                          → emit chuck:challenge-loaded { challenge, code, track }

5a. chuck-editor        : écoute chuck:challenge-loaded
                          → met le code du défi dans l'éditeur

5b. chuck-side-panel    : écoute chuck:challenge-loaded
                          → affiche l'énoncé, le leaderboard, le bouton submit
```

Le même schéma vaut pour la **soumission** : `chuck-side-panel` émet
`chuck:validate { source, hintsUsed }` → `challenge-manager.validate()` exécute
en headless → émet `chuck:challenge-success { medal }` ou
`chuck:challenge-failed { result }` → `chuck-side-panel` affiche le résultat.

---

## 9. Recettes : où intervenir selon ce que tu veux faire

**Ajouter un opcode ou une complétion dans l'éditeur**
→ `features/asm/opcodes.ts` (données). La coloration/hover suit automatiquement
via `codemirror-asm.ts`.

**Changer le code affiché en Mode Libre**
→ `features/asm/default-source.ts`.

**Modifier l'apparence de l'éditeur**
→ logique : `components/chuck-editor.ts` · style : `components/editor/editor.styles.ts`.

**Ajouter une règle de défi** (nouveau type d'assertion, condition de déblocage,
scoring)
→ `features/challenges/challenge-manager.ts`. Aucune ligne de DOM ici.

**Changer l'affichage d'un défi** (mise en page, nouveau bouton, leaderboard)
→ `components/chuck-side-panel.ts` · style : `components/side-panel/side-panel.styles.ts`.

**Ajouter un bouton à la toolbar**
→ `components/chuck-toolbar.ts`. Le bouton émet un événement ; ajoute l'entrée
correspondante dans `ChuckEventMap` (`core/bus.ts`) et un écouteur (souvent dans
`main.ts` ou l'émulateur).

**Ajouter une vue de modale**
→ déclare-la dans `core/modal-router.ts` (`_views`) + crée le composant, puis
émets `chuck:modal-show { view: "...nom..." }`. Pense à étendre le type
`ModalView` dans `core/bus.ts`.

**Ajouter une communication entre deux composants**
→ ajoute l'événement dans `ChuckEventMap` (`core/bus.ts`), émets-le d'un côté,
abonne-toi de l'autre. Ne crée jamais d'import direct entre composants.

**Toucher à l'authentification ou la persistance**
→ `features/auth/auth-service.ts` (auth) · `infra/storage/` (stockage). Jamais
d'accès direct depuis un composant : passe par le service.

---

## 10. Travailler sur le projet

```bash
yarn dev            # serveur de dev Vite (nécessite .env)
npx tsc --noEmit    # vérification de types
npx vitest run      # tests unitaires
```

Règle de validation avant toute livraison : `tsc` et `vitest` doivent rester au
moins aussi verts qu'avant ta modification. Les composants se testent en
montant l'élément dans JSDOM et en vérifiant les événements émis/écoutés ; les
`features/` se testent en isolation (pas de DOM).

### Boussole de débogage

1. **Rien ne s'affiche** → vérifier `.env` (Supabase), puis la console.
2. **Un comportement ne se déclenche pas** → `grep -rn "nom-événement" src/`
   pour vérifier qu'il y a bien un émetteur ET un abonné.
3. **Une donnée n'arrive pas** → suivre l'événement qui la transporte dans
   `ChuckEventMap`, vérifier le payload des deux côtés.
4. **Un import casse après déplacement** → les `import()` dynamiques et les
   annotations de type inline ne sont pas vus par un `grep "from"` ; chercher
   aussi `import(`.