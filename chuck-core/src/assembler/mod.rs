// chuck-core/src/assembler/mod.rs

pub mod lexer;
pub mod parser;
pub mod pass1;
pub mod pass2;

use crate::memory::Memory;

#[derive(Debug, Clone)]
pub struct AssembleError {
    pub line:   usize,  // 1-indexé, 0 = erreur globale
    pub msg:    String,
}

#[derive(Debug)]
pub struct AssembleResult {
    pub ok:            bool,
    pub error:         Option<AssembleError>,
    pub bytes_written: usize,
    pub org:           u16,
}

pub struct Assembler;

impl Assembler {
    /// Assemble `source` et écrit le résultat dans `mem`.
    /// Retourne l'adresse d'origine et le nombre d'octets écrits.
    pub fn assemble(source: &str, mem: &mut Memory) -> AssembleResult {
        // Tokenisation
        let tokens = match lexer::tokenize(source) {
            Ok(t) => t,
            Err(e) => return AssembleResult {
                ok: false,
                error: Some(e),
                bytes_written: 0,
                org: 0xE000,
            },
        };

        // Parsing en AST
        let stmts = match parser::parse(&tokens) {
            Ok(s) => s,
            Err(e) => return AssembleResult {
                ok: false,
                error: Some(e),
                bytes_written: 0,
                org: 0xE000,
            },
        };

        // Passe 1 : collecte labels + constantes
        let sym_table = match pass1::build_symbol_table(&stmts) {
            Ok(t) => t,
            Err(e) => return AssembleResult {
                ok: false,
                error: Some(e),
                bytes_written: 0,
                org: 0xE000,
            },
        };

        // Passe 2 : génération du code
        match pass2::generate(&stmts, &sym_table, mem) {
            Ok(result) => result,
            Err(e) => AssembleResult {
                ok: false,
                error: Some(e),
                bytes_written: 0,
                org: 0xE000,
            },
        }
    }
}