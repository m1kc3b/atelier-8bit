// chuck-core/src/assembler/pass1.rs
//
// Première passe : collecte tous les labels et constantes (EQU/define).
// Calcule les adresses PC en simulant la taille de chaque instruction.

use std::collections::HashMap;
use super::AssembleError;
use super::parser::{Statement, StmtKind, Directive, ParsedMode, Expr};
use crate::cpu::opcodes::{find_opcode, AddrMode};

#[derive(Debug, Clone)]
pub struct SymbolTable {
    pub symbols: HashMap<String, u16>,
    pub org:     u16,
}

impl SymbolTable {
    pub fn get(&self, name: &str) -> Option<u16> {
        self.symbols.get(name).copied()
    }

    pub fn resolve_expr(&self, expr: &Expr, pc: u16) -> Result<u16, String> {
        match expr {
            Expr::Num(n) => Ok(*n),
            Expr::Label(name) => {
                if name == "*" { return Ok(pc); }
                self.get(name).ok_or_else(|| format!("Symbole indéfini : {}", name))
            }
            Expr::Lo(e) => Ok(self.resolve_expr(e, pc)? & 0x00FF),
            Expr::Hi(e) => Ok((self.resolve_expr(e, pc)? >> 8) & 0x00FF),
            Expr::Add(a, b) => Ok(self.resolve_expr(a, pc)?.wrapping_add(self.resolve_expr(b, pc)?)),
            Expr::Sub(a, b) => Ok(self.resolve_expr(a, pc)?.wrapping_sub(self.resolve_expr(b, pc)?)),
            Expr::Mul(a, b) => Ok(self.resolve_expr(a, pc)?.wrapping_mul(self.resolve_expr(b, pc)?)),
            Expr::Div(a, b) => {
                let divisor = self.resolve_expr(b, pc)?;
                if divisor == 0 { return Err("Division par zéro".into()); }
                Ok(self.resolve_expr(a, pc)? / divisor)
            }
            Expr::Or (a, b) => Ok(self.resolve_expr(a, pc)? | self.resolve_expr(b, pc)?),
            Expr::And(a, b) => Ok(self.resolve_expr(a, pc)? & self.resolve_expr(b, pc)?),
            Expr::Xor(a, b) => Ok(self.resolve_expr(a, pc)? ^ self.resolve_expr(b, pc)?),
            Expr::Neg(e) => Ok(0u16.wrapping_sub(self.resolve_expr(e, pc)?)),
        }
    }
}

/// Construit la table des symboles en simulant le PC.
pub fn build_symbol_table(stmts: &[Statement]) -> Result<SymbolTable, AssembleError> {
    let mut symbols: HashMap<String, u16> = HashMap::new();
    let mut org = 0xE000u16;  // point d'entrée par défaut selon spec Chuck-8
    let mut pc  = org;

    // Deux passes pour résoudre les forward references dans les defines
    // (les labels sont résolus à leur position PC)

    for stmt in stmts {
        match &stmt.kind {
            StmtKind::Empty => {}

            StmtKind::Label(name) => {
                if symbols.contains_key(name.as_str()) {
                    return Err(AssembleError {
                        line: stmt.line,
                        msg:  format!("Label dupliqué : {}", name),
                    });
                }
                symbols.insert(name.clone(), pc);
            }

            StmtKind::Directive(dir) => {
                match dir {
                    Directive::Org(expr) => {
                        // On résout l'expression avec les symboles connus jusqu'ici
                        let sym = SymbolTable { symbols: symbols.clone(), org };
                        match sym.resolve_expr(expr, pc) {
                            Ok(v) => {
                                org = v;
                                pc  = v;
                            }
                            Err(_) => {
                                // Forward reference dans .org — on laisse passer pour l'instant
                            }
                        }
                    }

                    Directive::Define(name, expr) => {
                        // EQU : valeur constante (peut forward-ref d'autres constants)
                        // On tente de résoudre maintenant ; si impossible on stocke 0
                        // et on repassera après (ou erreur en passe 2)
                        let sym = SymbolTable { symbols: symbols.clone(), org };
                        let v = sym.resolve_expr(expr, pc).unwrap_or(0);
                        symbols.insert(name.clone(), v);
                    }

                    Directive::Byte(vals) => { pc += vals.len() as u16; }
                    Directive::Word(vals) => { pc += vals.len() as u16 * 2; }
                    Directive::Ascii(s)   => { pc += s.len() as u16; }
                    Directive::Res(count_expr, _) => {
                        let sym = SymbolTable { symbols: symbols.clone(), org };
                        let count = sym.resolve_expr(count_expr, pc).unwrap_or(0);
                        pc += count;
                    }
                    Directive::Segment(_) => {} // ignoré
                }
            }

            StmtKind::Instruction(instr) => {
                pc += estimate_size(&instr.mode);
            }
        }
    }

    Ok(SymbolTable { symbols, org })
}

/// Estime la taille d'une instruction selon son mode d'adressage parsé.
/// On préfère les modes zero page quand possible (2 octets plutôt que 3).
pub fn estimate_size(mode: &ParsedMode) -> u16 {
    // Détecter ASL A / LSR A / ROL A / ROR A → mode implicite (accumulateur) = 1 octet
    let effective = match mode {
        ParsedMode::Abs(Expr::Label(name)) if name.eq_ignore_ascii_case("A") => {
            return 1;
        }
        other => other,
    };
    match effective {
        ParsedMode::Imp         => 1,
        ParsedMode::Imm(_)      => 2,
        ParsedMode::Abs(e)      => if is_zp_expr(e) { 2 } else { 3 },
        ParsedMode::AbsX(e)     => if is_zp_expr(e) { 2 } else { 3 },
        ParsedMode::AbsY(e)     => if is_zp_expr(e) { 2 } else { 3 },
        ParsedMode::Ind(_)      => 3,
        ParsedMode::IndX(_)     => 2,
        ParsedMode::IndY(_)     => 2,
    }
}

/// Heuristique : est-ce que l'expression est probablement en zero page ?
fn is_zp_expr(expr: &Expr) -> bool {
    match expr {
        Expr::Num(n)   => *n <= 0x00FF,
        Expr::Label(_) => false, // conservateur : on ne sait pas encore
        _              => false,
    }
}

/// Détermine le mode d'adressage 6502 effectif à partir du mode parsé
/// et de la valeur résolue. Retourne l'opcode et les octets d'opérande.
pub fn resolve_mode(
    mnem: &str,
    parsed: &ParsedMode,
    val: u16,
    is_branch: bool,
) -> Result<(u8, Vec<u8>), String> {
    // Cas branchement : mode relatif obligatoire
    if is_branch {
        let op = find_opcode(mnem, AddrMode::Rel)
            .ok_or_else(|| format!("{} ne supporte pas le mode relatif", mnem))?;
        return Ok((op, vec![val as u8]));
    }

    // Essaie les modes dans l'ordre de priorité
    let candidates: &[(AddrMode, Vec<u8>)] = match parsed {
        ParsedMode::Imp => &[(AddrMode::Imp, vec![]), (AddrMode::Acc, vec![])],

        ParsedMode::Imm(_) => &[(AddrMode::Imm, vec![val as u8])],

        ParsedMode::Abs(_) => {
            // Préfère zero page si l'adresse le permet
            if val <= 0x00FF {
                &[
                    (AddrMode::Zp,  vec![val as u8]),
                    (AddrMode::Abs, vec![(val & 0xFF) as u8, (val >> 8) as u8]),
                ]
            } else {
                &[
                    (AddrMode::Abs, vec![(val & 0xFF) as u8, (val >> 8) as u8]),
                    (AddrMode::Zp,  vec![val as u8]), // ne sera jamais choisi si val > $FF
                ]
            }
        }

        ParsedMode::AbsX(_) => {
            if val <= 0x00FF {
                &[
                    (AddrMode::Zpx, vec![val as u8]),
                    (AddrMode::Abx, vec![(val & 0xFF) as u8, (val >> 8) as u8]),
                ]
            } else {
                &[
                    (AddrMode::Abx, vec![(val & 0xFF) as u8, (val >> 8) as u8]),
                    (AddrMode::Zpx, vec![val as u8]),
                ]
            }
        }

        ParsedMode::AbsY(_) => {
            if val <= 0x00FF {
                &[
                    (AddrMode::Zpy, vec![val as u8]),
                    (AddrMode::Aby, vec![(val & 0xFF) as u8, (val >> 8) as u8]),
                ]
            } else {
                &[
                    (AddrMode::Aby, vec![(val & 0xFF) as u8, (val >> 8) as u8]),
                    (AddrMode::Zpy, vec![val as u8]),
                ]
            }
        }

        ParsedMode::Ind(_) => &[(AddrMode::Ind, vec![(val & 0xFF) as u8, (val >> 8) as u8])],

        ParsedMode::IndX(_) => &[(AddrMode::Inx, vec![val as u8])],

        ParsedMode::IndY(_) => &[(AddrMode::Iny, vec![val as u8])],
    };

    for (addr_mode, operand_bytes) in candidates {
        if let Some(opcode) = find_opcode(mnem, *addr_mode) {
            return Ok((opcode, operand_bytes.clone()));
        }
    }

    Err(format!("{} ne supporte pas ce mode d'adressage (valeur = ${:04X})", mnem, val))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::assembler::lexer::tokenize;
    use crate::assembler::parser::parse;

    fn sym_table(src: &str) -> SymbolTable {
        let tokens = tokenize(src).unwrap();
        let stmts  = parse(&tokens).unwrap();
        build_symbol_table(&stmts).unwrap()
    }

    #[test]
    fn label_address() {
        let t = sym_table(".org $0600\nSTART:\n  LDA #$42\n");
        assert_eq!(t.get("START"), Some(0x0600));
    }

    #[test]
    fn label_after_instruction() {
        let t = sym_table(".org $0600\n  LDA #$42\nNEXT:\n");
        // LDA #$42 = 2 octets → NEXT à $0602
        assert_eq!(t.get("NEXT"), Some(0x0602));
    }

    #[test]
    fn equ_define() {
        let t = sym_table("SCREEN = $0200\n");
        assert_eq!(t.get("SCREEN"), Some(0x0200));
    }

    #[test]
    fn dot_define() {
        let t = sym_table(".define FOO $42\n");
        assert_eq!(t.get("FOO"), Some(0x42));
    }

    #[test]
    fn org_changes_pc() {
        let t = sym_table(".org $0800\nLABEL:\n");
        assert_eq!(t.get("LABEL"), Some(0x0800));
    }

    #[test]
    fn resolve_lo_hi() {
        let t = sym_table("ADDR = $1234\n");
        let lo = t.resolve_expr(&Expr::Lo(Box::new(Expr::Label("ADDR".into()))), 0).unwrap();
        let hi = t.resolve_expr(&Expr::Hi(Box::new(Expr::Label("ADDR".into()))), 0).unwrap();
        assert_eq!(lo, 0x34);
        assert_eq!(hi, 0x12);
    }

    #[test]
    fn duplicate_label_error() {
        let tokens = tokenize("A:\nA:\n").unwrap();
        let stmts  = parse(&tokens).unwrap();
        assert!(build_symbol_table(&stmts).is_err());
    }
}