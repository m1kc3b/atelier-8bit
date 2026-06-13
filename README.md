# Atelier 8-bit

## Structure du projet : 

```
atelier-8bit/                    ← racine du repo GitHub
├── Makefile                     ← orchestration des deux projets
├── README.md
│
├── .github/
│   └── workflows/
│       ├── build-core.yml       ← CI Rust : cargo test + wasm-pack
│       └── deploy-ide.yml       ← CI/CD TS : npm test + vite build → Cloudflare Pages
│
├── chuck-core/                  ← crate Rust (moteur 6502)
│   ├── Cargo.toml
│   ├── build.sh                 ← compile WASM + copie dans chuck-ide/public/
│   ├── pkg/                     ← généré par wasm-pack (gitignore sauf .d.ts)
│   │   ├── chuck_core_bg.wasm
│   │   ├── chuck_core.js
│   │   └── chuck_core.d.ts
│   └── src/
│       ├── lib.rs
│       ├── memory.rs
│       ├── wasm_api.rs
│       ├── cpu/
│       │   ├── mod.rs
│       │   ├── opcodes.rs
│       │   ├── addressing.rs
│       │   └── execute.rs
│       └── assembler/
│           ├── mod.rs
│           ├── lexer.rs
│           ├── parser.rs
│           ├── pass1.rs
│           └── pass2.rs
│
└── chuck-ide/                   ← app TypeScript (éditeur GUI)
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── wrangler.toml            ← déploiement Cloudflare Pages
    ├── index.html
    ├── public/
    │   ├── chuck_core_bg.wasm   ← copié depuis chuck-core/pkg/
    │   ├── chuck_core.js        ← copié depuis chuck-core/pkg/
    │   ├── chuck_core.d.ts      ← copié depuis chuck-core/pkg/
    │   ├── challenges.json
    │   ├── _headers
    │   └── _redirects
    └── src/
        ├── main.ts
        ├── vite-env.d.ts
        ├── styles/
        │   ├── tokens.css
        │   └── global.css
        ├── types/
        │   ├── cpu.ts
        │   └── challenge.ts
        ├── core/
        │   ├── bus.ts
        │   ├── base-component.ts
        │   ├── emulator.ts       ← façade WASM (remplace l'ancien)
        │   ├── challenge-manager.ts
        │   └── challenge-validator.ts
        └── components/
            ├── chuck-editor.ts
            ├── chuck-toolbar.ts
            ├── chuck-registers.ts
            ├── chuck-memory-dump.ts
            ├── chuck-display.ts
            └── chuck-challenge-panel.ts
```