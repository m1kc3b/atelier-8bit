.PHONY: build build-core build-ide dev test test-core test-ide

# ── Build complet ──────────────────────────────────────────
build: build-core build-ide

build-core:
	cd chuck-core && ./build.sh

build-ide:
	cd chuck-ide && npm run build

# ── Développement ──────────────────────────────────────────
dev:
	cd chuck-ide && npm run dev

# ── Tests ──────────────────────────────────────────────────
test: test-core test-ide

test-core:
	cd chuck-core && cargo test

test-ide:
	cd chuck-ide && npm run test

# ── Setup initial ──────────────────────────────────────────
setup:
	cd chuck-ide && npm install
	rustup target add wasm32-unknown-unknown
	cargo install wasm-pack
	make build-core