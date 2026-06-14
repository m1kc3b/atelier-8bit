// chuck-core/src/lib.rs
// Moteur Chuck-8 — assembleur + émulateur 6502 + I/O + ROM système

pub mod assembler;
pub mod cpu;
pub mod io;
pub mod memory;
pub mod rom;
pub mod wasm_api;

pub use assembler::Assembler;
pub use cpu::Cpu;
pub use memory::Memory;
