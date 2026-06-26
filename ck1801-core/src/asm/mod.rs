// asm/mod.rs — Assembleur CK-1801 : parse → résout labels → émet binaire.
//
// Stratégie deux passes :
//   Passe 1 : parcourt les lignes, calcule la taille de chaque instruction et
//             l'adresse courante, enregistre les labels et les .equ.
//   Passe 2 : résout les expressions (labels/constantes) et émet les octets.
//
// La résolution mnémonique+forme → opcode utilise ASM_RESOLVE, GÉNÉRÉE depuis la
// même source que le décodeur (data/opcodes.tsv) : l'émission ne peut pas diverger
// du décodage. "Destination à droite" et formes d'opérandes suivent la spec.

pub mod lexer;

use lexer::{lex, Tok};
use std::collections::HashMap;

// Table de résolution générée (incluse aussi par cpu.rs ; ici on en a besoin pour assembler).
#[allow(dead_code)]
mod resolve_table {
    include!(concat!(env!("OUT_DIR"), "/opcodes_gen.rs"));
}
use resolve_table::ASM_RESOLVE;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AsmError {
    pub line: usize,
    pub msg: String,
}

impl std::fmt::Display for AsmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ligne {}: {}", self.line, self.msg)
    }
}

/// Résultat d'assemblage : octets + adresse de chargement (.org, défaut $0200).
#[derive(Clone, Debug)]
pub struct Assembled {
    pub origin: u16,
    pub bytes: Vec<u8>,
    /// table label → adresse, exposée pour le débogage / désassemblage.
    pub labels: HashMap<String, u16>,
}

// ── Représentation intermédiaire d'un opérande parsé ────────────────────────
#[derive(Clone, Debug)]
enum Operand {
    Reg(u8),       // R0/R1/R2 → 0/1/2
    Imm(Expr),     // #expr
    ZpOrAbs(Expr), // $nn ou $nnnn ou label — la largeur est tranchée à la résolution
    IndIx,         // (IX)
    IdxIx(Expr),   // IX+expr
                   // (le mode rel des branchements est déduit du mnémonique : l'opérande est une Expr cible
                   //  emballée en ZpOrAbs et réinterprétée à l'émission)
}

#[derive(Clone, Debug)]
enum Expr {
    Num(i64),
    Label(String),
}

impl Expr {
    fn eval(&self, labels: &HashMap<String, u16>, line: usize) -> Result<i64, AsmError> {
        match self {
            Expr::Num(n) => Ok(*n),
            Expr::Label(name) => labels.get(name).map(|a| *a as i64).ok_or_else(|| AsmError {
                line,
                msg: format!("label inconnu '{name}'"),
            }),
        }
    }
}

// Une ligne parsée qui produit de l'output.
#[derive(Clone, Debug)]
enum Item {
    Instr {
        line: usize,
        mnem: String,
        operands: Vec<Operand>,
        addr: u16,
        #[allow(dead_code)]
        size: u8,
    },
    Bytes {
        line: usize,
        exprs: Vec<Expr>,
        width: u8,
    }, // .byte / .word
}

fn is_reg(s: &str) -> Option<u8> {
    match s.to_uppercase().as_str() {
        "R0" => Some(0),
        "R1" => Some(1),
        "R2" => Some(2),
        _ => None,
    }
}

/// Assemble un source complet en binaire.
pub fn assemble(src: &str) -> Result<Assembled, AsmError> {
    let toks = lex(src).map_err(|e| AsmError {
        line: e.line,
        msg: e.msg,
    })?;

    // Découpe en lignes logiques (séparées par Newline).
    let mut lines: Vec<(usize, Vec<Tok>)> = Vec::new();
    let mut cur: Vec<Tok> = Vec::new();
    let mut cur_line = 0usize;
    for (ln, t) in toks {
        if cur_line == 0 {
            cur_line = ln;
        }
        if t == Tok::Newline {
            if !cur.is_empty() {
                lines.push((cur_line, std::mem::take(&mut cur)));
            }
            cur_line = 0;
        } else {
            cur.push(t);
        }
    }

    let mut labels: HashMap<String, u16> = HashMap::new();
    let mut items: Vec<Item> = Vec::new();
    let mut origin: Option<u16> = None;
    let mut addr: u16 = 0x0200; // défaut RAM utilisateur (§16)

    // ── PASSE 1 : labels, .equ, .org, tailles, adresses ─────────────────────
    for (line, mut tl) in lines {
        // label en tête : Ident ':'
        while tl.len() >= 2 && matches!(tl[0], Tok::Ident(_)) && tl[1] == Tok::Colon {
            if let Tok::Ident(name) = &tl[0] {
                if labels.contains_key(name) {
                    return Err(AsmError {
                        line,
                        msg: format!("label dupliqué '{name}'"),
                    });
                }
                labels.insert(name.clone(), addr);
            }
            tl.drain(0..2);
        }
        if tl.is_empty() {
            continue;
        }

        // directives
        if let Tok::Directive(d) = &tl[0] {
            match d.as_str() {
                "org" => {
                    let v = expect_single_num(&tl[1..], line)?;
                    addr = v as u16;
                    if origin.is_none() {
                        origin = Some(addr);
                    }
                }
                "equ" => {
                    return Err(AsmError { line, msg: ".equ doit suivre la forme `NAME .equ valeur` — non supporté ici, utilisez `NAME = valeur`".into() });
                }
                "byte" | "db" => {
                    let exprs = parse_expr_list(&tl[1..], line)?;
                    let n = exprs.len() as u16;
                    items.push(Item::Bytes {
                        line,
                        exprs,
                        width: 1,
                    });
                    addr = addr.wrapping_add(n);
                }
                "word" | "dw" => {
                    let exprs = parse_expr_list(&tl[1..], line)?;
                    let n = (exprs.len() as u16) * 2;
                    items.push(Item::Bytes {
                        line,
                        exprs,
                        width: 2,
                    });
                    addr = addr.wrapping_add(n);
                }
                other => {
                    return Err(AsmError {
                        line,
                        msg: format!("directive inconnue .{other}"),
                    })
                }
            }
            continue;
        }

        // NB : la forme `NAME = valeur` (constantes) n'est pas supportée à ce stade
        // (le lexer ne tokenise pas '='). Les labels jouent ce rôle pour les adresses.

        // instruction : Ident (mnémonique) [opérandes]
        let (mnem, rest) = match &tl[0] {
            Tok::Ident(m) => (m.to_uppercase(), &tl[1..]),
            _ => {
                return Err(AsmError {
                    line,
                    msg: "instruction attendue".into(),
                })
            }
        };
        let operands = parse_operands(rest, line)?;
        let size = instr_size(&mnem, &operands, line)?;
        items.push(Item::Instr {
            line,
            mnem,
            operands,
            addr,
            size,
        });
        addr = addr.wrapping_add(size as u16);
    }

    let origin = origin.unwrap_or(0x0200);

    // ── PASSE 2 : émission ──────────────────────────────────────────────────
    let mut bytes: Vec<u8> = Vec::new();
    // adresse de base pour l'octet 0 du buffer = origin ; on suppose les items contigus.
    for item in &items {
        match item {
            Item::Bytes { line, exprs, width } => {
                for e in exprs {
                    let v = e.eval(&labels, *line)?;
                    if *width == 1 {
                        bytes.push(v as u8);
                    } else {
                        bytes.push((v & 0xFF) as u8);
                        bytes.push(((v >> 8) & 0xFF) as u8);
                    }
                }
            }
            Item::Instr {
                line,
                mnem,
                operands,
                addr,
                ..
            } => {
                emit_instr(&mut bytes, mnem, operands, *addr, &labels, *line)?;
            }
        }
    }

    Ok(Assembled {
        origin,
        bytes,
        labels,
    })
}

// ── Parsing des opérandes ───────────────────────────────────────────────────

fn parse_operands(toks: &[Tok], line: usize) -> Result<Vec<Operand>, AsmError> {
    if toks.is_empty() {
        return Ok(vec![]);
    }
    // Sépare par virgules au niveau top.
    let mut groups: Vec<Vec<Tok>> = vec![vec![]];
    for t in toks {
        if *t == Tok::Comma {
            groups.push(vec![]);
        } else {
            if let Some(g) = groups.last_mut() {
                g.push(t.clone());
            }
        }
    }
    let mut ops = Vec::new();
    for g in groups {
        ops.push(parse_one_operand(&g, line)?);
    }
    Ok(ops)
}

fn parse_one_operand(g: &[Tok], line: usize) -> Result<Operand, AsmError> {
    if g.is_empty() {
        return Err(AsmError {
            line,
            msg: "opérande vide".into(),
        });
    }
    // #imm
    if g[0] == Tok::Hash {
        let e = parse_expr(&g[1..], line)?;
        return Ok(Operand::Imm(e));
    }
    // (IX)
    if g[0] == Tok::LParen {
        if g.len() == 3 && g[2] == Tok::RParen {
            if let Tok::Ident(id) = &g[1] {
                if id.eq_ignore_ascii_case("IX") {
                    return Ok(Operand::IndIx);
                }
            }
        }
        return Err(AsmError {
            line,
            msg: "indirection attendue : (IX)".into(),
        });
    }
    // registre seul
    if g.len() == 1 {
        if let Tok::Ident(id) = &g[0] {
            if let Some(r) = is_reg(id) {
                return Ok(Operand::Reg(r));
            }
        }
    }
    // IX+expr
    if let Tok::Ident(id) = &g[0] {
        if id.eq_ignore_ascii_case("IX") && g.len() >= 3 && g[1] == Tok::Plus {
            let e = parse_expr(&g[2..], line)?;
            return Ok(Operand::IdxIx(e));
        }
    }
    // $nn / $nnnn / label / nombre : ambigu zp/abs/target ; on garde une Expr.
    let e = parse_expr(g, line)?;
    // On ne sait pas encore si c'est ZpOrAbs ou Target : on emballe en ZpOrAbs,
    // emit_instr re-décidera selon le mnémonique.
    Ok(Operand::ZpOrAbs(e))
}

fn parse_expr(toks: &[Tok], line: usize) -> Result<Expr, AsmError> {
    if toks.len() != 1 {
        return Err(AsmError {
            line,
            msg: "expression simple attendue (nombre ou label)".into(),
        });
    }
    match &toks[0] {
        Tok::Num(n) => Ok(Expr::Num(*n)),
        Tok::Ident(s) => {
            if let Some(_r) = is_reg(s) {
                return Err(AsmError {
                    line,
                    msg: format!("registre {s} inattendu ici"),
                });
            }
            Ok(Expr::Label(s.clone()))
        }
        _ => Err(AsmError {
            line,
            msg: "expression invalide".into(),
        }),
    }
}

fn parse_expr_list(toks: &[Tok], line: usize) -> Result<Vec<Expr>, AsmError> {
    let mut groups: Vec<Vec<Tok>> = vec![vec![]];
    for t in toks {
        if *t == Tok::Comma {
            groups.push(vec![]);
        } else {
            if let Some(g) = groups.last_mut() {
                g.push(t.clone());
            }
        }
    }
    let mut out = Vec::new();
    for g in groups {
        if g.is_empty() {
            continue;
        }
        out.push(parse_expr(&g, line)?);
    }
    Ok(out)
}

fn expect_single_num(toks: &[Tok], line: usize) -> Result<i64, AsmError> {
    match parse_expr(toks, line)? {
        Expr::Num(n) => Ok(n),
        Expr::Label(_) => Err(AsmError {
            line,
            msg: "valeur numérique attendue".into(),
        }),
    }
}

// ── Calcul de taille (passe 1) ──────────────────────────────────────────────

fn instr_size(mnem: &str, operands: &[Operand], line: usize) -> Result<u8, AsmError> {
    let canon = canon_form(mnem, operands, line)?;
    let op = resolve(mnem, &canon).ok_or_else(|| AsmError {
        line,
        msg: format!("forme invalide : {mnem} {canon}"),
    })?;
    Ok(op_size(op))
}

/// Forme canonique d'un opérande list, miroir EXACT de build.rs::canon_operands.
fn canon_form(mnem: &str, operands: &[Operand], line: usize) -> Result<String, AsmError> {
    // Mnémoniques à forme fixée (indépendante de la valeur)
    match mnem {
        "LDX" => return Ok("#16".into()),
        "LDXD" | "STXD" | "JMP" | "JSR" => return Ok("abs".into()),
        "ADX" | "SYS" => return Ok("#".into()),
        "BRA" | "BZ" | "BNZ" | "BC" | "BNC" | "BN" | "BV" => return Ok("rel".into()),
        _ => {}
    }
    let mut parts = Vec::new();
    for o in operands {
        parts.push(match o {
            Operand::Reg(r) => format!("R{r}"),
            Operand::Imm(_) => "#".to_string(),
            Operand::IndIx => "(IX)".to_string(),
            Operand::IdxIx(_) => "IX+".to_string(),
            Operand::ZpOrAbs(e) => zp_or_abs_class(e, line)?,
        });
    }
    Ok(parts.join(","))
}

/// Décide zp vs abs pour un opérande mémoire selon la valeur (si connue).
/// Un label est supposé abs (16 bits) par sûreté (pas de page zéro auto sur labels).
fn zp_or_abs_class(e: &Expr, _line: usize) -> Result<String, AsmError> {
    match e {
        Expr::Num(n) if (0..=0xFF).contains(n) => Ok("zp".into()),
        _ => Ok("abs".into()),
    }
}

// ── Émission (passe 2) ──────────────────────────────────────────────────────

fn emit_instr(
    out: &mut Vec<u8>,
    mnem: &str,
    operands: &[Operand],
    addr: u16,
    labels: &HashMap<String, u16>,
    line: usize,
) -> Result<(), AsmError> {
    let canon = canon_form(mnem, operands, line)?;
    let opcode = resolve(mnem, &canon).ok_or_else(|| AsmError {
        line,
        msg: format!("forme invalide : {mnem} {canon}"),
    })?;
    out.push(opcode);

    let size = op_size(opcode);

    // Branchements : opérande relative (signée) calculée vs adresse de l'instr suivante.
    if matches!(mnem, "BRA" | "BZ" | "BNZ" | "BC" | "BNC" | "BN" | "BV") {
        let target = single_expr(operands, line)?.eval(labels, line)?;
        let next = addr.wrapping_add(size as u16) as i64;
        let rel = target - next;
        if !(-128..=127).contains(&rel) {
            return Err(AsmError {
                line,
                msg: format!("branchement hors portée ({rel}) ; cible trop loin"),
            });
        }
        out.push((rel as i8) as u8);
        return Ok(());
    }

    // Émet les opérandes selon leur nature, dans l'ordre source.
    for o in operands {
        match o {
            Operand::Reg(_) | Operand::IndIx => { /* encodé dans l'opcode, aucun octet */ }
            Operand::Imm(e) => {
                let v = e.eval(labels, line)?;
                if mnem == "LDX" {
                    // #imm16 little-endian
                    out.push((v & 0xFF) as u8);
                    out.push(((v >> 8) & 0xFF) as u8);
                } else {
                    out.push(v as u8);
                }
            }
            Operand::IdxIx(e) => {
                let v = e.eval(labels, line)?;
                out.push(v as u8); // déplacement 8 bits
            }
            Operand::ZpOrAbs(e) => {
                let v = e.eval(labels, line)?;
                // largeur déterminée par la forme canonique déjà résolue
                if canon.contains("abs") || matches!(mnem, "JMP" | "JSR" | "LDXD" | "STXD") {
                    out.push((v & 0xFF) as u8);
                    out.push(((v >> 8) & 0xFF) as u8);
                } else {
                    out.push(v as u8);
                }
            }
        }
    }
    Ok(())
}

fn single_expr(operands: &[Operand], line: usize) -> Result<Expr, AsmError> {
    if operands.len() != 1 {
        return Err(AsmError {
            line,
            msg: "un opérande attendu".into(),
        });
    }
    match &operands[0] {
        Operand::ZpOrAbs(e) | Operand::Imm(e) | Operand::IdxIx(e) => Ok(e.clone()),
        _ => Err(AsmError {
            line,
            msg: "opérande adressable attendu".into(),
        }),
    }
}

// ── Accès à la table de résolution générée ──────────────────────────────────

fn resolve(mnem: &str, canon: &str) -> Option<u8> {
    ASM_RESOLVE
        .iter()
        .find(|(m, c, _)| *m == mnem && *c == canon)
        .map(|(_, _, op)| *op)
}

/// Taille en octets d'un opcode, déduite de la forme canonique présente dans la table.
/// On la recalcule depuis OPCODES via une petite table locale de tailles par opcode.
fn op_size(opcode: u8) -> u8 {
    OP_SIZES[opcode as usize]
}

// Tailles par opcode, générées en parallèle (incluses depuis le même fichier).
use resolve_table::OP_SIZES;