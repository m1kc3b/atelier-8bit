// chuck-core/src/assembler/parser.rs
//
// Transforme les tokens en une liste de Statement (AST plat).

use super::AssembleError;
use super::lexer::{Token, TokenKind};

// ── AST ──────────────────────────────────────────────────────────────────────

/// Valeur ou expression dans un opérande
#[derive(Debug, Clone)]
pub enum Expr {
    Num(u16),
    Label(String),
    Lo(Box<Expr>),     // <expr — octet bas
    Hi(Box<Expr>),     // >expr — octet haut
    Add(Box<Expr>, Box<Expr>),
    Sub(Box<Expr>, Box<Expr>),
    Mul(Box<Expr>, Box<Expr>),
    Div(Box<Expr>, Box<Expr>),
    Or (Box<Expr>, Box<Expr>),
    And(Box<Expr>, Box<Expr>),
    Xor(Box<Expr>, Box<Expr>),
    Neg(Box<Expr>),
}

/// Mode d'adressage tel que parsé (avant résolution des labels)
#[derive(Debug, Clone)]
pub enum ParsedMode {
    Imp,                     // implicite (pas d'opérande)
    Imm(Expr),               // #expr
    Abs(Expr),               // expr  (zp ou abs, décidé en passe 2)
    AbsX(Expr),              // expr,X
    AbsY(Expr),              // expr,Y
    Ind(Expr),               // (expr)
    IndX(Expr),              // (expr,X)
    IndY(Expr),              // (expr),Y
}

/// Une instruction assemblée
#[derive(Debug, Clone)]
pub struct Instruction {
    pub line:  usize,
    pub mnem:  String,
    pub mode:  ParsedMode,
}

/// Une directive assembleur
#[derive(Debug, Clone)]
pub enum Directive {
    Org(Expr),                     // .org / *=
    Byte(Vec<Expr>),               // .byte
    Word(Vec<Expr>),               // .word
    Res(Expr, Option<Expr>),       // .res count [, fill]
    Ascii(String),                 // .ascii
    Define(String, Expr),          // FOO = expr  ou  .define FOO expr
    Segment(String),               // .segment — ignoré mais accepté
}

#[derive(Debug, Clone)]
pub enum StmtKind {
    Instruction(Instruction),
    Directive(Directive),
    Label(String),         // label: (définit une adresse)
    Empty,
}

#[derive(Debug, Clone)]
pub struct Statement {
    pub line: usize,
    pub kind: StmtKind,
}

// ── Parser ────────────────────────────────────────────────────────────────────

struct Parser<'a> {
    tokens: &'a [Token],
    pos:    usize,
}

impl<'a> Parser<'a> {
    fn new(tokens: &'a [Token]) -> Self { Self { tokens, pos: 0 } }

    fn peek(&self) -> Option<&Token> { self.tokens.get(self.pos) }

    fn peek_kind(&self) -> Option<&TokenKind> { self.peek().map(|t| &t.kind) }

    fn current_line(&self) -> usize {
        self.peek().map_or(0, |t| t.line)
    }

    fn advance(&mut self) -> Option<&Token> {
        let t = self.tokens.get(self.pos);
        self.pos += 1;
        t
    }

    fn skip_newlines(&mut self) {
        while matches!(self.peek_kind(), Some(TokenKind::Newline)) {
            self.advance();
        }
    }

    fn err(&self, msg: impl Into<String>) -> AssembleError {
        AssembleError { line: self.current_line(), msg: msg.into() }
    }

    // ── Expression ────────────────────────────────────────────────────────────

    /// Analyse une expression complète (addition/soustraction)
    fn parse_expr(&mut self) -> Result<Expr, AssembleError> {
        let mut lhs = self.parse_term()?;
        loop {
            match self.peek_kind() {
                Some(TokenKind::Plus)      => { self.advance(); lhs = Expr::Add(Box::new(lhs), Box::new(self.parse_term()?)); }
                Some(TokenKind::Minus)     => { self.advance(); lhs = Expr::Sub(Box::new(lhs), Box::new(self.parse_term()?)); }
                Some(TokenKind::Pipe)      => { self.advance(); lhs = Expr::Or (Box::new(lhs), Box::new(self.parse_term()?)); }
                Some(TokenKind::Ampersand) => { self.advance(); lhs = Expr::And(Box::new(lhs), Box::new(self.parse_term()?)); }
                Some(TokenKind::Caret)     => { self.advance(); lhs = Expr::Xor(Box::new(lhs), Box::new(self.parse_term()?)); }
                _ => break,
            }
        }
        Ok(lhs)
    }

    fn parse_term(&mut self) -> Result<Expr, AssembleError> {
        let mut lhs = self.parse_primary()?;
        loop {
            match self.peek_kind() {
                Some(TokenKind::Star)  => { self.advance(); lhs = Expr::Mul(Box::new(lhs), Box::new(self.parse_primary()?)); }
                Some(TokenKind::Slash) => { self.advance(); lhs = Expr::Div(Box::new(lhs), Box::new(self.parse_primary()?)); }
                _ => break,
            }
        }
        Ok(lhs)
    }

    fn parse_primary(&mut self) -> Result<Expr, AssembleError> {
        match self.peek_kind().cloned() {

            // Préfixe < (octet bas)
            Some(TokenKind::Lt) => {
                self.advance();
                Ok(Expr::Lo(Box::new(self.parse_primary()?)))
            }
            // Préfixe > (octet haut)
            Some(TokenKind::Gt) => {
                self.advance();
                Ok(Expr::Hi(Box::new(self.parse_primary()?)))
            }
            // Négation
            Some(TokenKind::Minus) => {
                self.advance();
                Ok(Expr::Neg(Box::new(self.parse_primary()?)))
            }
            Some(TokenKind::Tilde) => {
                self.advance();
                // NOT = ~x = (-x - 1) pour u16
                Ok(Expr::Sub(Box::new(Expr::Neg(Box::new(self.parse_primary()?))), Box::new(Expr::Num(1))))
            }

            // PC courant
            Some(TokenKind::Star) => {
                self.advance();
                Ok(Expr::Label("*".into()))
            }

            // Nombre
            Some(TokenKind::Number(n)) => {
                self.advance();
                Ok(Expr::Num(n))
            }

            // Identifiant (label ou constante)
            Some(TokenKind::Ident(name)) => {
                self.advance();
                Ok(Expr::Label(name))
            }

            // Parenthèses pour grouper
            Some(TokenKind::LParen) => {
                self.advance();
                let e = self.parse_expr()?;
                if !matches!(self.peek_kind(), Some(TokenKind::RParen)) {
                    return Err(self.err("')' attendu"));
                }
                self.advance();
                Ok(e)
            }

            other => Err(self.err(format!("Expression attendue, trouvé {:?}", other))),
        }
    }

    // ── Opérande instruction ──────────────────────────────────────────────────

    /// Parse une expression dans un contexte indirect — s'arrête avant ')' ou ','
    /// sans les consommer (contrairement à parse_primary qui absorbe les parens groupantes).
    fn parse_expr_indirect(&mut self) -> Result<Expr, AssembleError> {
        // Même logique que parse_expr mais parse_primary_indirect à la base
        let mut lhs = self.parse_term_indirect()?;
        loop {
            match self.peek_kind() {
                Some(TokenKind::Plus)      => { self.advance(); lhs = Expr::Add(Box::new(lhs), Box::new(self.parse_term_indirect()?)); }
                Some(TokenKind::Minus)     => { self.advance(); lhs = Expr::Sub(Box::new(lhs), Box::new(self.parse_term_indirect()?)); }
                Some(TokenKind::Pipe)      => { self.advance(); lhs = Expr::Or (Box::new(lhs), Box::new(self.parse_term_indirect()?)); }
                Some(TokenKind::Ampersand) => { self.advance(); lhs = Expr::And(Box::new(lhs), Box::new(self.parse_term_indirect()?)); }
                Some(TokenKind::Caret)     => { self.advance(); lhs = Expr::Xor(Box::new(lhs), Box::new(self.parse_term_indirect()?)); }
                _ => break,
            }
        }
        Ok(lhs)
    }

    fn parse_term_indirect(&mut self) -> Result<Expr, AssembleError> {
        let mut lhs = self.parse_primary_indirect()?;
        loop {
            match self.peek_kind() {
                Some(TokenKind::Star)  => { self.advance(); lhs = Expr::Mul(Box::new(lhs), Box::new(self.parse_primary_indirect()?)); }
                Some(TokenKind::Slash) => { self.advance(); lhs = Expr::Div(Box::new(lhs), Box::new(self.parse_primary_indirect()?)); }
                _ => break,
            }
        }
        Ok(lhs)
    }

    /// Comme parse_primary mais NE consomme PAS les parenthèses comme groupement.
    /// Dans un contexte indirect, ')' est un délimiteur, pas un fermant d'expression.
    fn parse_primary_indirect(&mut self) -> Result<Expr, AssembleError> {
        match self.peek_kind().cloned() {
            Some(TokenKind::Lt)    => { self.advance(); Ok(Expr::Lo(Box::new(self.parse_primary_indirect()?))) }
            Some(TokenKind::Gt)    => { self.advance(); Ok(Expr::Hi(Box::new(self.parse_primary_indirect()?))) }
            Some(TokenKind::Minus) => { self.advance(); Ok(Expr::Neg(Box::new(self.parse_primary_indirect()?))) }
            Some(TokenKind::Star)  => { self.advance(); Ok(Expr::Label("*".into())) }
            Some(TokenKind::Number(n)) => { self.advance(); Ok(Expr::Num(n)) }
            Some(TokenKind::Ident(name)) => { self.advance(); Ok(Expr::Label(name)) }
            other => Err(self.err(format!("Expression attendue dans opérande indirect, trouvé {:?}", other))),
        }
    }

    fn parse_mode(&mut self) -> Result<ParsedMode, AssembleError> {
        match self.peek_kind() {
            // Pas d'opérande → implicite
            None | Some(TokenKind::Newline) => Ok(ParsedMode::Imp),

            // Immédiat : #expr
            Some(TokenKind::Hash) => {
                self.advance();
                Ok(ParsedMode::Imm(self.parse_expr()?))
            }

            // Indirect : (expr) ou (expr,X) ou (expr),Y
            Some(TokenKind::LParen) => {
                self.advance();
                // Utilise parse_expr_indirect pour ne pas absorber la ')' finale
                let expr = self.parse_expr_indirect()?;
                match self.peek_kind() {
                    // (expr,X)
                    Some(TokenKind::Comma) => {
                        self.advance();
                        match self.peek_kind() {
                            Some(TokenKind::Ident(id)) if id.eq_ignore_ascii_case("X") => {
                                self.advance();
                                if !matches!(self.peek_kind(), Some(TokenKind::RParen)) {
                                    return Err(self.err("')' attendu après (zp,X"));
                                }
                                self.advance();
                                Ok(ParsedMode::IndX(expr))
                            }
                            _ => Err(self.err("'X' attendu dans (zp,X)")),
                        }
                    }
                    // (expr),Y
                    Some(TokenKind::RParen) => {
                        self.advance();
                        if matches!(self.peek_kind(), Some(TokenKind::Comma)) {
                            self.advance();
                            match self.peek_kind() {
                                Some(TokenKind::Ident(id)) if id.eq_ignore_ascii_case("Y") => {
                                    self.advance();
                                    Ok(ParsedMode::IndY(expr))
                                }
                                _ => Err(self.err("'Y' attendu dans (zp),Y")),
                            }
                        } else {
                            Ok(ParsedMode::Ind(expr))
                        }
                    }
                    _ => Err(self.err("',' ou ')' attendu dans opérande indirect")),
                }
            }

            // expr, expr,X ou expr,Y
            _ => {
                let expr = self.parse_expr()?;
                if matches!(self.peek_kind(), Some(TokenKind::Comma)) {
                    self.advance();
                    match self.peek_kind() {
                        Some(TokenKind::Ident(id)) if id.eq_ignore_ascii_case("X") => {
                            self.advance();
                            Ok(ParsedMode::AbsX(expr))
                        }
                        Some(TokenKind::Ident(id)) if id.eq_ignore_ascii_case("Y") => {
                            self.advance();
                            Ok(ParsedMode::AbsY(expr))
                        }
                        _ => Err(self.err("'X' ou 'Y' attendu après la virgule")),
                    }
                } else {
                    Ok(ParsedMode::Abs(expr))
                }
            }
        }
    }

    // ── Ligne ──────────────────────────────────────────────────────────────────

    fn parse_line(&mut self) -> Result<Vec<Statement>, AssembleError> {
        let mut stmts = Vec::new();

        self.skip_newlines();
        if self.peek().is_none() { return Ok(stmts); }

        let line = self.current_line();

        // Deux tokens pour regarder en avant
        match self.peek_kind().cloned() {
            // Identifiant → peut être : label:, instruction, directive, ou FOO =
            Some(TokenKind::Ident(name)) => {
                self.advance();

                match self.peek_kind() {
                    // Label : LABEL:
                    Some(TokenKind::Colon) => {
                        self.advance();
                        stmts.push(Statement { line, kind: StmtKind::Label(name) });
                        // Peut être suivi d'une instruction sur la même ligne
                        if !matches!(self.peek_kind(), Some(TokenKind::Newline) | None) {
                            stmts.extend(self.parse_line()?);
                        }
                    }

                    // Assignation : FOO = expr
                    Some(TokenKind::Eq) => {
                        self.advance();
                        let expr = self.parse_expr()?;
                        stmts.push(Statement {
                            line,
                            kind: StmtKind::Directive(Directive::Define(name, expr)),
                        });
                    }

                    // Directive .xxx
                    _ if name.starts_with('.') => {
                        stmts.push(self.parse_directive(name, line)?);
                    }

                    // *=  (origin)
                    _ if name == "*" => {
                        if matches!(self.peek_kind(), Some(TokenKind::Eq)) {
                            self.advance();
                            let expr = self.parse_expr()?;
                            stmts.push(Statement {
                                line,
                                kind: StmtKind::Directive(Directive::Org(expr)),
                            });
                        } else {
                            return Err(AssembleError { line, msg: "Syntaxe invalide avec '*'".into() });
                        }
                    }

                    // Instruction mnémonique
                    _ => {
                        let mode = self.parse_mode()?;
                        stmts.push(Statement {
                            line,
                            kind: StmtKind::Instruction(Instruction {
                                line,
                                mnem: name.to_uppercase(),
                                mode,
                            }),
                        });
                    }
                }
            }

            // Ligne vide / newline
            Some(TokenKind::Newline) => {
                self.advance();
                stmts.push(Statement { line, kind: StmtKind::Empty });
            }

            other => {
                return Err(AssembleError {
                    line,
                    msg: format!("Début de ligne inattendu : {:?}", other),
                });
            }
        }

        // Consomme le newline de fin de ligne si présent
        if matches!(self.peek_kind(), Some(TokenKind::Newline)) {
            self.advance();
        }

        Ok(stmts)
    }

    fn parse_directive(&mut self, name: String, line: usize) -> Result<Statement, AssembleError> {
        let kind = match name.to_lowercase().as_str() {
            ".org" => {
                let expr = self.parse_expr()?;
                Directive::Org(expr)
            }
            ".byte" | "dcb" | "db" => {
                let mut vals = vec![self.parse_expr()?];
                while matches!(self.peek_kind(), Some(TokenKind::Comma)) {
                    self.advance();
                    vals.push(self.parse_expr()?);
                }
                Directive::Byte(vals)
            }
            ".word" | "dw" => {
                let mut vals = vec![self.parse_expr()?];
                while matches!(self.peek_kind(), Some(TokenKind::Comma)) {
                    self.advance();
                    vals.push(self.parse_expr()?);
                }
                Directive::Word(vals)
            }
            ".res" => {
                let count = self.parse_expr()?;
                let fill = if matches!(self.peek_kind(), Some(TokenKind::Comma)) {
                    self.advance();
                    Some(self.parse_expr()?)
                } else {
                    None
                };
                Directive::Res(count, fill)
            }
            ".ascii" | ".asciiz" => {
                match self.peek_kind().cloned() {
                    Some(TokenKind::String(s)) => {
                        self.advance();
                        Directive::Ascii(s)
                    }
                    _ => return Err(AssembleError { line, msg: "Chaîne attendue après .ascii".into() }),
                }
            }
            ".define" => {
                let sym_name = match self.peek_kind().cloned() {
                    Some(TokenKind::Ident(n)) => { self.advance(); n }
                    _ => return Err(AssembleError { line, msg: "Nom de symbole attendu après .define".into() }),
                };
                let expr = self.parse_expr()?;
                Directive::Define(sym_name, expr)
            }
            ".segment" => {
                // Ignoré — on accepte .segment "CODE" pour compatibilité ca65
                while !matches!(self.peek_kind(), Some(TokenKind::Newline) | None) {
                    self.advance();
                }
                Directive::Segment(name)
            }
            // .proc, .endproc, .macro, .endmacro → ignorés silencieusement
            ".proc" | ".endproc" | ".macro" | ".endmacro" | ".include" => {
                while !matches!(self.peek_kind(), Some(TokenKind::Newline) | None) {
                    self.advance();
                }
                Directive::Segment(name) // réutilise Segment pour les ignorer
            }
            _ => {
                return Err(AssembleError {
                    line,
                    msg: format!("Directive inconnue : {}", name),
                });
            }
        };

        Ok(Statement { line, kind: StmtKind::Directive(kind) })
    }
}

/// Point d'entrée public du parser.
pub fn parse(tokens: &[Token]) -> Result<Vec<Statement>, AssembleError> {
    let mut parser = Parser::new(tokens);
    let mut stmts  = Vec::new();

    while parser.peek().is_some() {
        parser.skip_newlines();
        if parser.peek().is_none() { break; }
        let line_stmts = parser.parse_line()?;
        stmts.extend(line_stmts);
    }

    Ok(stmts)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::assembler::lexer::tokenize;

    fn parse_src(src: &str) -> Vec<Statement> {
        let tokens = tokenize(src).unwrap();
        parse(&tokens).unwrap()
    }

    #[test]
    fn label_and_lda_imm() {
        let stmts = parse_src("START:\n  LDA #$42\n");
        let kinds: Vec<_> = stmts.iter().filter(|s| !matches!(s.kind, StmtKind::Empty)).collect();
        assert!(matches!(kinds[0].kind, StmtKind::Label(_)));
        assert!(matches!(kinds[1].kind, StmtKind::Instruction(_)));
    }

    #[test]
    fn equ_define() {
        let stmts = parse_src("FOO = $42\n");
        let s = stmts.iter().find(|s| matches!(s.kind, StmtKind::Directive(Directive::Define(_, _)))).unwrap();
        if let StmtKind::Directive(Directive::Define(name, _)) = &s.kind {
            assert_eq!(name, "FOO");
        }
    }

    #[test]
    fn dot_define() {
        let stmts = parse_src(".define SCREEN $0200\n");
        let s = stmts.iter().find(|s| matches!(s.kind, StmtKind::Directive(Directive::Define(_, _)))).unwrap();
        if let StmtKind::Directive(Directive::Define(name, _)) = &s.kind {
            assert_eq!(name, "SCREEN");
        }
    }

    #[test]
    fn indirect_y() {
        let stmts = parse_src("STA ($F0),Y\n");
        let s = stmts.iter().find(|s| matches!(s.kind, StmtKind::Instruction(_))).unwrap();
        if let StmtKind::Instruction(i) = &s.kind {
            assert!(matches!(i.mode, ParsedMode::IndY(_)));
        }
    }

    #[test]
    fn indirect_x() {
        let stmts = parse_src("LDA ($10,X)\n");
        let s = stmts.iter().find(|s| matches!(s.kind, StmtKind::Instruction(_))).unwrap();
        if let StmtKind::Instruction(i) = &s.kind {
            assert!(matches!(i.mode, ParsedMode::IndX(_)));
        }
    }

    #[test]
    fn abs_indexed_x() {
        let stmts = parse_src("LDA $0200,X\n");
        let s = stmts.iter().find(|s| matches!(s.kind, StmtKind::Instruction(_))).unwrap();
        if let StmtKind::Instruction(i) = &s.kind {
            assert!(matches!(i.mode, ParsedMode::AbsX(_)));
        }
    }

    #[test]
    fn dot_byte() {
        let stmts = parse_src(".byte $01, $02, $03\n");
        let s = stmts.iter().find(|s| matches!(s.kind, StmtKind::Directive(Directive::Byte(_)))).unwrap();
        if let StmtKind::Directive(Directive::Byte(vals)) = &s.kind {
            assert_eq!(vals.len(), 3);
        }
    }

    #[test]
    fn org_directive() {
        let stmts = parse_src(".org $0600\n");
        assert!(stmts.iter().any(|s| matches!(s.kind, StmtKind::Directive(Directive::Org(_)))));
    }
}