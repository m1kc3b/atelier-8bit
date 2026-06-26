// build.rs — génère `opcodes_gen.rs` depuis `data/opcodes.tsv`.
//
// La table plate de l'Annexe A (CK-1801_reference.md v2.0-FINAL) est la source
// UNIQUE de vérité. Elle est encodée dans data/opcodes.tsv (lui-même produit par
// data/gen_opcodes.py et vérifié sans collision contre la spec). Ce build script
// transforme ce TSV en une table Rust `[OpInfo; 256]` indexée par octet d'opcode.
//
// Les octets absents du TSV sont des slots RÉSERVÉS → traités NOP+ILL (§13).

use std::env;
use std::fmt::Write as _;
use std::fs;
use std::path::Path;

#[derive(Clone)]
struct Row {
    op: u8,
    mnem: String,
    operands: String,
    size: u8,
    cycles: u8,
    cyc_taken: u8,
    flags: String, // 4 chars, ordre N Z C V, '-' = inchangé
}

fn parse_tsv(s: &str) -> Vec<Row> {
    let mut v = Vec::new();
    for line in s.lines() {
        let line = line.trim_end();
        if line.is_empty() {
            continue;
        }
        let cols: Vec<&str> = line.split('\t').collect();
        assert!(cols.len() == 7, "ligne TSV malformée: {line:?}");
        v.push(Row {
            op: cols[0].parse().unwrap(),
            mnem: cols[1].to_string(),
            operands: cols[2].to_string(),
            size: cols[3].parse().unwrap(),
            cycles: cols[4].parse().unwrap(),
            cyc_taken: cols[5].parse().unwrap(),
            flags: cols[6].to_string(),
        });
    }
    v
}

/// Dérive le `Mode` d'adressage (variante de l'enum Rust) depuis la forme texte
/// des opérandes. Régulier et exhaustif : tout cas non couvert fait échouer le build.
fn mode_of(mnem: &str, operands: &str) -> &'static str {
    let o = operands.replace(' ', "");
    // Contrôle de flux
    match mnem {
        "JMP" | "JSR" => return "Abs", // $nnnn cible de saut
        "RET" | "NOP" | "SEI" | "CLI" | "HLT" | "INX" | "DEX" => return "Imp",
        "BRA" | "BZ" | "BNZ" | "BC" | "BNC" | "BN" | "BV" => return "Rel",
        "PSH" | "POP" => return "RegImp", // un seul registre, pas de mémoire
        "XCH" => return "RegPair",
        "MOV" => return "RegPair",
        "LDX" => return "Imm16",
        "LDXD" | "STXD" => return "Abs",
        "ADX" => return "ImmIx", // #imm ajouté à IX
        "SYS" => return "Imm",   // #n
        _ => {}
    }
    // ALU / load / store : déterminés par la forme des opérandes
    if o.contains("#imm") {
        return "Imm";
    }
    if o.contains("(IX)") {
        return "IndIx";
    }
    if o.contains("IX+$nn") {
        return "IdxIx";
    }
    if o.contains("$nnnn") {
        return "Abs";
    }
    if o.contains("$nn") {
        return "Zp";
    }
    // reg-reg pur (ADD R0,R1 etc.) ou unaire (INC R0)
    let reg_count = o.matches("R0").count() + o.matches("R1").count() + o.matches("R2").count();
    match reg_count {
        2 => "RegPair",
        1 => "RegImp",
        _ => panic!("mode indéterminable pour {mnem} {operands:?}"),
    }
}

/// Extrait (src, dst) en indices 0..2 quand c'est une forme reg-reg, sinon (255,255).
/// Pour les unaires/RegImp, dst est le registre, src=255.
fn regs_of(operands: &str) -> (u8, u8) {
    let o = operands.replace(' ', "");
    fn idx(tok: &str) -> Option<u8> {
        match tok {
            "R0" => Some(0),
            "R1" => Some(1),
            "R2" => Some(2),
            _ => None,
        }
    }
    let parts: Vec<&str> = o.split(',').collect();
    // formes possibles: "Rs,Rd" | "Rd" | "#imm,Rd" | "$nn,Rd" | "Rd,$nn" | "(IX),Rd" | "Rd,(IX)" ...
    // On cherche les tokens registres et on déduit src/dst selon "destination à droite".
    let regs: Vec<u8> = parts.iter().copied().filter_map(idx).collect();
    match (parts.as_slice(), regs.as_slice()) {
        // reg,reg → src = gauche, dst = droite (destination à droite)
        ([a, b], [_, _]) if idx(a).is_some() && idx(b).is_some() => {
            (idx(a).unwrap(), idx(b).unwrap())
        }
        // un seul registre (unaire / push / pop / load-to-rd / store-from-rd)
        _ if regs.len() == 1 => (255, regs[0]),
        _ => (255, 255),
    }
}

fn main() {
    let manifest = env::var("CARGO_MANIFEST_DIR").unwrap();
    let tsv_path = Path::new(&manifest).join("data/opcodes.tsv");
    println!("cargo:rerun-if-changed=data/opcodes.tsv");
    println!("cargo:rerun-if-changed=build.rs");

    let tsv = fs::read_to_string(&tsv_path).unwrap_or_else(|e| panic!("lecture {tsv_path:?}: {e}"));
    let rows = parse_tsv(&tsv);
    assert_eq!(
        rows.len(),
        177,
        "la table doit contenir exactement 177 opcodes définis"
    );

    // Vérif collision (paranoïa : le TSV est déjà vérifié, mais on re-garantit ici)
    let mut seen = [false; 256];
    for r in &rows {
        assert!(!seen[r.op as usize], "COLLISION sur ${:02X}", r.op);
        seen[r.op as usize] = true;
    }

    let mut out = String::new();
    out.push_str("// @generated par build.rs depuis data/opcodes.tsv — NE PAS ÉDITER À LA MAIN.\n");
    out.push_str("// Source de vérité : Annexe A de CK-1801_reference.md v2.0-FINAL.\n\n");

    // Fichier include!() dans cpu.rs : on évite tout `use` (conflits) sauf en scope local du bloc.
    out.push_str(
        "/// Table plate : opcode (octet) → infos. Slots réservés = RESERVED (→ NOP+ILL, §13).\n",
    );
    out.push_str("pub static OPCODES: [crate::isa::OpInfo; 256] = {\n");
    out.push_str("    use crate::isa::Mnemonic::*;\n");
    out.push_str("    use crate::isa::Mode::*;\n");
    out.push_str("    use crate::isa::flag_mask;\n");
    out.push_str("    let mut t = [crate::isa::OpInfo::RESERVED; 256];\n");

    for r in &rows {
        let mode = mode_of(&r.mnem, &r.operands);
        let (src, dst) = regs_of(&r.operands);
        let fmask = flag_mask_literal(&r.flags);
        // src/dst encodés en Option via sentinelle 255 → on émet des u8 et l'exécuteur interprète.
        writeln!(
            out,
            "    t[0x{op:02X}] = crate::isa::OpInfo {{ mnem: {mnem}, mode: {mode}, size: {size}, \
cycles: {cyc}, cyc_taken: {cyct}, flags: {fmask}, src: {src}, dst: {dst} }};",
            op = r.op,
            mnem = r.mnem,
            mode = mode,
            size = r.size,
            cyc = r.cycles,
            cyct = r.cyc_taken,
            fmask = fmask,
            src = src,
            dst = dst,
        )
        .unwrap();
    }
    out.push_str("    t\n};\n\n");

    // ── Table de résolution assembleur : (mnem, forme d'opérandes canonique) → opcode ──
    // Même source que OPCODES, donc l'émission binaire ne peut pas diverger du décodage.
    // La "forme canonique" abstrait les valeurs concrètes :
    //   registres → R0/R1/R2 littéraux ; #imm/#imm16/#n → "#" ; $nn → "zp" ; $nnnn → "abs" ;
    //   (IX) → "(IX)" ; IX+$nn → "IX+" ; rel → "rel".
    out.push_str("/// (mnémonique, forme canonique d'opérandes) → opcode. Pour l'assembleur.\n");
    out.push_str("/// Forme canonique : voir build.rs (canon_operands).\n");
    out.push_str("pub static ASM_RESOLVE: &[(&str, &str, u8)] = &[\n");
    let mut resolve: Vec<(String, String, u8)> = rows
        .iter()
        .map(|r| (r.mnem.clone(), canon_operands(&r.mnem, &r.operands), r.op))
        .collect();
    resolve.sort_by(|a, b| a.0.cmp(&b.0).then(a.1.cmp(&b.1)));
    for (mnem, canon, op) in &resolve {
        writeln!(out, "    (\"{mnem}\", \"{canon}\", 0x{op:02X}),").unwrap();
    }
    out.push_str("];\n\n");

    // ── Tailles par opcode (octets) ─────────────────────────────────────────
    let mut sizes = [1u8; 256];
    for r in &rows {
        sizes[r.op as usize] = r.size;
    }
    out.push_str("/// Taille en octets indexée par opcode (réservés = 1).\n");
    out.push_str("pub static OP_SIZES: [u8; 256] = [\n    ");
    for (i, s) in sizes.iter().enumerate() {
        write!(out, "{s},").unwrap();
        if (i + 1) % 16 == 0 {
            out.push_str("\n    ");
        }
    }
    out.push_str("\n];\n");

    let out_dir = env::var("OUT_DIR").unwrap();
    let dest = Path::new(&out_dir).join("opcodes_gen.rs");
    fs::write(&dest, out).unwrap();
}

/// Convertit "NZCV"/"NZ--"/"----"/"NZC-" en expression `flag_mask(...)`.
/// Forme canonique des opérandes pour la résolution assembleur.
/// Abstrait les valeurs concrètes en gardant la structure (registres + classes).
fn canon_operands(mnem: &str, operands: &str) -> String {
    let o = operands.replace(' ', "");
    if o.is_empty() {
        return String::new();
    }
    // Cas spéciaux dépendant du mnémonique
    match mnem {
        "LDX" => return "#16".to_string(),           // LDX #imm16
        "LDXD" | "STXD" => return "abs".to_string(), // $nnnn
        "ADX" => return "#".to_string(),             // ADX #imm
        "SYS" => return "#".to_string(),             // SYS #n
        "JMP" | "JSR" => return "abs".to_string(),
        "BRA" | "BZ" | "BNZ" | "BC" | "BNC" | "BN" | "BV" => return "rel".to_string(),
        _ => {}
    }
    // Cas généraux : on transforme chaque token
    let parts: Vec<String> = o
        .split(',')
        .map(|p| {
            if p == "R0" || p == "R1" || p == "R2" {
                p.to_string()
            } else if p.starts_with("#imm") || p == "#n" {
                "#".to_string()
            } else if p == "(IX)" {
                "(IX)".to_string()
            } else if p.starts_with("IX+") {
                "IX+".to_string()
            } else if p == "$nnnn" {
                "abs".to_string()
            } else if p == "$nn" {
                "zp".to_string()
            } else {
                p.to_string()
            }
        })
        .collect();
    parts.join(",")
}

fn flag_mask_literal(flags: &str) -> String {
    let bytes = flags.as_bytes();
    assert_eq!(bytes.len(), 4, "flags doit faire 4 caractères: {flags:?}");
    let n = bytes[0] == b'N';
    let z = bytes[1] == b'Z';
    let c = bytes[2] == b'C';
    let v = bytes[3] == b'V';
    format!("flag_mask({n}, {z}, {c}, {v})")
}