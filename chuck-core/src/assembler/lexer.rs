// chuck-core/src/assembler/lexer.rs
//
// Tokeniseur pour la syntaxe ca65.
// Produit une liste plate de tokens avec numéros de ligne.

use super::AssembleError;

#[derive(Debug, Clone, PartialEq)]
pub enum TokenKind {
    // Valeurs
    Number(u16),          // $FF, %1010, 42, 'A'
    String(String),       // "hello"
    Ident(String),        // FOO, LABEL, LDA, .byte …

    // Ponctuation
    Colon,                // :
    Comma,                // ,
    Hash,                 // #
    LParen,               // (
    RParen,               // )
    Plus,                 // +
    Minus,                // -
    Star,                 // *
    Slash,                // /
    Pipe,                 // |
    Ampersand,            // &
    Caret,                // ^
    Tilde,                // ~
    Lt,                   // <
    Gt,                   // >
    Eq,                   // =
    Newline,              // \n (séparateur logique de lignes)
}

#[derive(Debug, Clone)]
pub struct Token {
    pub kind: TokenKind,
    pub line: usize,
}

impl Token {
    fn new(kind: TokenKind, line: usize) -> Self { Self { kind, line } }
}

pub fn tokenize(source: &str) -> Result<Vec<Token>, AssembleError> {
    let mut tokens = Vec::new();
    let mut line   = 1usize;
    let mut chars  = source.chars().peekable();

    while let Some(&ch) = chars.peek() {
        match ch {
            // Saut de ligne
            '\n' => {
                chars.next();
                tokens.push(Token::new(TokenKind::Newline, line));
                line += 1;
            }

            // Retour chariot (Windows CRLF)
            '\r' => { chars.next(); }

            // Espaces / tabulations
            ' ' | '\t' => { chars.next(); }

            // Commentaire ligne (; ou //)
            ';' => {
                while chars.peek().map_or(false, |&c| c != '\n') {
                    chars.next();
                }
            }

            // Nombre hexadécimal $xx
            '$' => {
                chars.next();
                let mut hex = String::new();
                while chars.peek().map_or(false, |c| c.is_ascii_hexdigit()) {
                    hex.push(chars.next().unwrap());
                }
                if hex.is_empty() {
                    return Err(AssembleError {
                        line,
                        msg: "Nombre hexadécimal vide après '$'".into(),
                    });
                }
                let v = u16::from_str_radix(&hex, 16).map_err(|_| AssembleError {
                    line,
                    msg: format!("Hexadécimal invalide : ${}", hex),
                })?;
                tokens.push(Token::new(TokenKind::Number(v), line));
            }

            // Nombre binaire %xxxxxxxx
            '%' => {
                chars.next();
                let mut bin = String::new();
                while chars.peek().map_or(false, |&c| c == '0' || c == '1') {
                    bin.push(chars.next().unwrap());
                }
                if bin.is_empty() {
                    return Err(AssembleError { line, msg: "Nombre binaire vide après '%'".into() });
                }
                let v = u16::from_str_radix(&bin, 2).map_err(|_| AssembleError {
                    line,
                    msg: format!("Binaire invalide : %{}", bin),
                })?;
                tokens.push(Token::new(TokenKind::Number(v), line));
            }

            // Caractère ASCII 'X'
            '\'' => {
                chars.next();
                let c = chars.next().ok_or(AssembleError {
                    line,
                    msg: "Caractère ASCII incomplet".into(),
                })?;
                // Optionnel : apostrophe fermante
                if chars.peek() == Some(&'\'') { chars.next(); }
                tokens.push(Token::new(TokenKind::Number(c as u16), line));
            }

            // Nombre décimal
            '0'..='9' => {
                // Lire ch (déjà dans ch), puis les suivants
                chars.next(); // consomme ch
                let mut num = String::new();
                num.push(ch);
                while chars.peek().map_or(false, |c| c.is_ascii_digit()) {
                    num.push(chars.next().unwrap());
                }
                let v: u32 = num.parse().map_err(|_| AssembleError {
                    line,
                    msg: format!("Nombre invalide : {}", num),
                })?;
                if v > 0xFFFF {
                    return Err(AssembleError { line, msg: format!("Nombre trop grand : {}", v) });
                }
                tokens.push(Token::new(TokenKind::Number(v as u16), line));
            }

            // Chaîne "..."
            '"' => {
                chars.next();
                let mut s = String::new();
                loop {
                    match chars.next() {
                        None => return Err(AssembleError { line, msg: "Chaîne non fermée".into() }),
                        Some('"') => break,
                        Some('\\') => {
                            match chars.next() {
                                Some('n')  => s.push('\n'),
                                Some('t')  => s.push('\t'),
                                Some('\\') => s.push('\\'),
                                Some('"')  => s.push('"'),
                                Some(c)    => { s.push('\\'); s.push(c); }
                                None => return Err(AssembleError { line, msg: "Chaîne non fermée".into() }),
                            }
                        }
                        Some(c) => s.push(c),
                    }
                }
                tokens.push(Token::new(TokenKind::String(s), line));
            }

            // Identifiants et directives (.byte, .org, LDA, FOO, …)
            'a'..='z' | 'A'..='Z' | '_' | '.' | '@' => {
                chars.next();
                let mut ident = String::new();
                ident.push(ch);
                while chars.peek().map_or(false, |&c| {
                    c.is_alphanumeric() || c == '_' || c == '.'
                }) {
                    ident.push(chars.next().unwrap());
                }
                tokens.push(Token::new(TokenKind::Ident(ident), line));
            }

            // Ponctuation
            ':' => { chars.next(); tokens.push(Token::new(TokenKind::Colon,     line)); }
            ',' => { chars.next(); tokens.push(Token::new(TokenKind::Comma,     line)); }
            '#' => { chars.next(); tokens.push(Token::new(TokenKind::Hash,      line)); }
            '(' => { chars.next(); tokens.push(Token::new(TokenKind::LParen,    line)); }
            ')' => { chars.next(); tokens.push(Token::new(TokenKind::RParen,    line)); }
            '+' => { chars.next(); tokens.push(Token::new(TokenKind::Plus,      line)); }
            '-' => { chars.next(); tokens.push(Token::new(TokenKind::Minus,     line)); }
            '*' => { chars.next(); tokens.push(Token::new(TokenKind::Star,      line)); }
            '/' => { chars.next(); tokens.push(Token::new(TokenKind::Slash,     line)); }
            '|' => { chars.next(); tokens.push(Token::new(TokenKind::Pipe,      line)); }
            '&' => { chars.next(); tokens.push(Token::new(TokenKind::Ampersand, line)); }
            '^' => { chars.next(); tokens.push(Token::new(TokenKind::Caret,     line)); }
            '~' => { chars.next(); tokens.push(Token::new(TokenKind::Tilde,     line)); }
            '<' => { chars.next(); tokens.push(Token::new(TokenKind::Lt,        line)); }
            '>' => { chars.next(); tokens.push(Token::new(TokenKind::Gt,        line)); }
            '=' => { chars.next(); tokens.push(Token::new(TokenKind::Eq,        line)); }

            other => {
                return Err(AssembleError {
                    line,
                    msg: format!("Caractère inattendu : '{}'", other),
                });
            }
        }
    }

    // Assure qu'on termine par un Newline pour simplifier le parser
    if tokens.last().map_or(true, |t| t.kind != TokenKind::Newline) {
        tokens.push(Token::new(TokenKind::Newline, line));
    }

    Ok(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kinds(src: &str) -> Vec<TokenKind> {
        tokenize(src).unwrap().into_iter().map(|t| t.kind).collect()
    }

    #[test]
    fn hex_number() {
        assert_eq!(kinds("$FF"), vec![TokenKind::Number(0xFF), TokenKind::Newline]);
    }

    #[test]
    fn binary_number() {
        assert_eq!(kinds("%1010"), vec![TokenKind::Number(0b1010), TokenKind::Newline]);
    }

    #[test]
    fn decimal_number() {
        assert_eq!(kinds("42"), vec![TokenKind::Number(42), TokenKind::Newline]);
    }

    #[test]
    fn char_literal() {
        assert_eq!(kinds("'A'"), vec![TokenKind::Number(65), TokenKind::Newline]);
    }

    #[test]
    fn ident_and_label() {
        let t = kinds("LOOP:");
        assert_eq!(t[0], TokenKind::Ident("LOOP".into()));
        assert_eq!(t[1], TokenKind::Colon);
    }

    #[test]
    fn directive() {
        let t = kinds(".byte");
        assert_eq!(t[0], TokenKind::Ident(".byte".into()));
    }

    #[test]
    fn comment_ignored() {
        let t = kinds("LDA #$42 ; commentaire");
        assert_eq!(t[0], TokenKind::Ident("LDA".into()));
        assert_eq!(t[1], TokenKind::Hash);
        assert_eq!(t[2], TokenKind::Number(0x42));
        assert_eq!(t[3], TokenKind::Newline);
    }

    #[test]
    fn multiline_line_numbers() {
        let src = "LDA #$01\nSTA $0200\n";
        let t = tokenize(src).unwrap();
        assert_eq!(t[0].line, 1);
        assert_eq!(t[4].line, 2); // STA commence ligne 2
    }

    #[test]
    fn lda_imm_full() {
        let t = kinds("LDA #$42");
        assert_eq!(t[0], TokenKind::Ident("LDA".into()));
        assert_eq!(t[1], TokenKind::Hash);
        assert_eq!(t[2], TokenKind::Number(0x42));
    }

    #[test]
    fn angle_bracket_ops() {
        let t = kinds("#<LABEL");
        assert_eq!(t[0], TokenKind::Hash);
        assert_eq!(t[1], TokenKind::Lt);
        assert_eq!(t[2], TokenKind::Ident("LABEL".into()));
    }
}
