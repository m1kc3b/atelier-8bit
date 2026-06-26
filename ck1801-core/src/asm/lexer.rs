// asm/lexer.rs — Analyse lexicale de l'assembleur CK-1801.
//
// Tokenise une ligne source en éléments : mnémoniques, registres, nombres
// ($hex, %bin, décimal), immédiats (#), labels, directives (.org, .byte, .word),
// ponctuation ((, ), +, ,, :) et caractères ('c').

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Tok {
    Ident(String),     // mnémonique, label, ou nom de registre/IX (désambiguïsé au parsing)
    Num(i64),          // valeur numérique déjà convertie
    Hash,              // #
    LParen,            // (
    RParen,            // )
    Plus,              // +
    Comma,             // ,
    Colon,             // :
    Directive(String), // .org, .byte, .word, .equ ...
    Newline,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LexError {
    pub line: usize,
    pub msg: String,
}

/// Tokenise le source complet. Émet un Newline en fin de chaque ligne logique.
pub fn lex(src: &str) -> Result<Vec<(usize, Tok)>, LexError> {
    let mut out = Vec::new();
    for (lineno0, raw) in src.lines().enumerate() {
        let line = lineno0 + 1;
        let chars: Vec<char> = raw.chars().collect();
        let mut i = 0;
        while i < chars.len() {
            let c = chars[i];
            // commentaire ';' jusqu'à la fin de ligne
            if c == ';' {
                break;
            }
            if c.is_whitespace() {
                i += 1;
                continue;
            }

            match c {
                '#' => {
                    out.push((line, Tok::Hash));
                    i += 1;
                }
                '(' => {
                    out.push((line, Tok::LParen));
                    i += 1;
                }
                ')' => {
                    out.push((line, Tok::RParen));
                    i += 1;
                }
                '+' => {
                    out.push((line, Tok::Plus));
                    i += 1;
                }
                ',' => {
                    out.push((line, Tok::Comma));
                    i += 1;
                }
                ':' => {
                    out.push((line, Tok::Colon));
                    i += 1;
                }
                '\'' => {
                    // littéral caractère 'x'
                    if i + 2 < chars.len() && chars[i + 2] == '\'' {
                        out.push((line, Tok::Num(chars[i + 1] as i64)));
                        i += 3;
                    } else {
                        return Err(LexError {
                            line,
                            msg: "littéral caractère mal formé".into(),
                        });
                    }
                }
                '$' => {
                    let start = i + 1;
                    let mut j = start;
                    while j < chars.len() && chars[j].is_ascii_hexdigit() {
                        j += 1;
                    }
                    if j == start {
                        return Err(LexError {
                            line,
                            msg: "nombre hexa vide après $".into(),
                        });
                    }
                    let s: String = chars[start..j].iter().collect();
                    let v = i64::from_str_radix(&s, 16).map_err(|_| LexError {
                        line,
                        msg: format!("hexa invalide ${s}"),
                    })?;
                    out.push((line, Tok::Num(v)));
                    i = j;
                }
                '%' => {
                    let start = i + 1;
                    let mut j = start;
                    while j < chars.len() && (chars[j] == '0' || chars[j] == '1') {
                        j += 1;
                    }
                    if j == start {
                        return Err(LexError {
                            line,
                            msg: "binaire vide après %".into(),
                        });
                    }
                    let s: String = chars[start..j].iter().collect();
                    let v = i64::from_str_radix(&s, 2).map_err(|_| LexError {
                        line,
                        msg: format!("binaire hors limites %{s}"),
                    })?;
                    out.push((line, Tok::Num(v)));
                    i = j;
                }
                '.' => {
                    // directive
                    let start = i + 1;
                    let mut j = start;
                    while j < chars.len() && (chars[j].is_alphanumeric() || chars[j] == '_') {
                        j += 1;
                    }
                    let s: String = chars[start..j].iter().collect();
                    if s.is_empty() {
                        return Err(LexError {
                            line,
                            msg: "directive vide après '.'".into(),
                        });
                    }
                    out.push((line, Tok::Directive(s.to_lowercase())));
                    i = j;
                }
                c if c.is_ascii_digit() => {
                    let start = i;
                    let mut j = start;
                    while j < chars.len() && chars[j].is_ascii_digit() {
                        j += 1;
                    }
                    let s: String = chars[start..j].iter().collect();
                    let v = s.parse::<i64>().map_err(|_| LexError {
                        line,
                        msg: format!("nombre décimal hors limites {s}"),
                    })?;
                    out.push((line, Tok::Num(v)));
                    i = j;
                }
                c if c.is_alphabetic() || c == '_' => {
                    let start = i;
                    let mut j = start;
                    while j < chars.len() && (chars[j].is_alphanumeric() || chars[j] == '_') {
                        j += 1;
                    }
                    let s: String = chars[start..j].iter().collect();
                    out.push((line, Tok::Ident(s)));
                    i = j;
                }
                other => {
                    return Err(LexError {
                        line,
                        msg: format!("caractère inattendu '{other}'"),
                    });
                }
            }
        }
        out.push((line, Tok::Newline));
    }
    Ok(out)
}
