// chuck-core/src/lib.rs
// Moteur 6502 complet — assembleur + émulateur — exposé via WebAssembly

pub mod assembler;
pub mod cpu;
pub mod memory;
pub mod wasm_api;

// Ré-exports publics pour les tests Rust natifs
pub use assembler::Assembler;
pub use cpu::Cpu;
pub use memory::Memory;
