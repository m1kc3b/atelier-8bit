// chuck-core/src/assembler/pass2.rs
//
// Deuxième passe : génère les octets machine à partir de l'AST
// et de la table des symboles construite en passe 1.

use crate::memory::Memory;
use super::{AssembleError, AssembleResult};
use super::parser::{Statement, StmtKind, Directive, ParsedMode, Expr};
use super::pass1::{SymbolTable, resolve_mode};

const BRANCHES: &[&str] = &["BCC","BCS","BEQ","BMI","BNE","BPL","BVC","BVS"];

pub fn generate(
    stmts:    &[Statement],
    sym:      &SymbolTable,
    mem:      &mut Memory,
) -> Result<AssembleResult, AssembleError> {
    let mut pc            = sym.org;
    let org               = sym.org;
    let mut bytes_written = 0usize;

    for stmt in stmts {
        match &stmt.kind {
            StmtKind::Empty | StmtKind::Label(_) => {}

            StmtKind::Directive(dir) => {
                match dir {
                    Directive::Org(expr) => {
                        let v = sym.resolve_expr(expr, pc).map_err(|e| AssembleError {
                            line: stmt.line,
                            msg: e,
                        })?;
                        pc = v;
                    }

                    Directive::Byte(vals) => {
                        for expr in vals {
                            let v = sym.resolve_expr(expr, pc).map_err(|e| AssembleError {
                                line: stmt.line,
                                msg:  e,
                            })?;
                            mem.write_raw(pc, (v & 0xFF) as u8);
                            pc            += 1;
                            bytes_written += 1;
                        }
                    }

                    Directive::Word(vals) => {
                        for expr in vals {
                            let v = sym.resolve_expr(expr, pc).map_err(|e| AssembleError {
                                line: stmt.line,
                                msg:  e,
                            })?;
                            mem.write_raw(pc,     (v & 0xFF) as u8);
                            mem.write_raw(pc + 1, (v >> 8) as u8);
                            pc            += 2;
                            bytes_written += 2;
                        }
                    }

                    Directive::Ascii(s) => {
                        for b in s.bytes() {
                            mem.write_raw(pc, b);
                            pc            += 1;
                            bytes_written += 1;
                        }
                    }

                    Directive::Res(count_expr, fill_expr) => {
                        let count = sym.resolve_expr(count_expr, pc).map_err(|e| AssembleError {
                            line: stmt.line,
                            msg:  e,
                        })? as usize;
                        let fill = match fill_expr {
                            Some(expr) => sym.resolve_expr(expr, pc).map_err(|e| AssembleError {
                                line: stmt.line,
                                msg:  e,
                            })? as u8,
                            None => 0,
                        };
                        for _ in 0..count {
                            mem.write_raw(pc, fill);
                            pc            += 1;
                            bytes_written += 1;
                        }
                    }

                    Directive::Define(_,_) | Directive::Segment(_) => {}
                }
            }

            StmtKind::Instruction(instr) => {
                let mnem = &instr.mnem;
                let is_branch = BRANCHES.contains(&mnem.as_str());

                // Détecter le mode accumulateur explicite : ASL A, LSR A, ROL A, ROR A
                // En ca65, "ASL A" est parsé comme Abs(Label("A")) — on le convertit en Imp
                let effective_mode: std::borrow::Cow<ParsedMode> = match &instr.mode {
                    ParsedMode::Abs(Expr::Label(name)) if name.eq_ignore_ascii_case("A") => {
                        std::borrow::Cow::Owned(ParsedMode::Imp)
                    }
                    other => std::borrow::Cow::Borrowed(other),
                };
                let mode = effective_mode.as_ref();

                // Résoudre l'expression de l'opérande
                let val = match mode {
                    ParsedMode::Imp => 0u16,

                    ParsedMode::Imm(e)
                    | ParsedMode::Abs(e)
                    | ParsedMode::AbsX(e)
                    | ParsedMode::AbsY(e)
                    | ParsedMode::Ind(e)
                    | ParsedMode::IndX(e)
                    | ParsedMode::IndY(e) => {
                        sym.resolve_expr(e, pc).map_err(|e| AssembleError {
                            line: stmt.line,
                            msg:  e,
                        })?
                    }
                };

                // Pour les branchements, convertir l'adresse absolue en offset relatif
                let effective_val = if is_branch {
                    // PC après l'instruction = pc + 2
                    let next_pc = pc.wrapping_add(2);
                    let offset  = (val as i32) - (next_pc as i32);
                    if offset < -128 || offset > 127 {
                        return Err(AssembleError {
                            line: stmt.line,
                            msg:  format!("{} : branchement hors portée (offset {})", mnem, offset),
                        });
                    }
                    (offset as i8) as u8 as u16
                } else {
                    val
                };

                // Sélectionner l'opcode et les octets d'opérande
                let (opcode, operand_bytes) = resolve_mode(mnem, mode, effective_val, is_branch)
                    .map_err(|e| AssembleError { line: stmt.line, msg: e })?;

                // Écrire en mémoire
                mem.write_raw(pc, opcode);
                pc            += 1;
                bytes_written += 1;

                for &b in &operand_bytes {
                    mem.write_raw(pc, b);
                    pc            += 1;
                    bytes_written += 1;
                }
            }
        }
    }

    Ok(AssembleResult { ok: true, error: None, bytes_written, org })
}

#[cfg(test)]
mod tests {
    use crate::{Assembler, Memory, Cpu};

    fn asm(src: &str) -> Memory {
        let mut mem = Memory::new();
        let result  = Assembler::assemble(src, &mut mem);
        assert!(result.ok, "Erreur assemblage : {:?}", result.error);
        mem
    }

    fn run(src: &str) -> (Cpu, Memory) {
        let mut mem = Memory::new();
        let result  = Assembler::assemble(src, &mut mem);
        assert!(result.ok, "Erreur assemblage : {:?}", result.error);
        let mut cpu = Cpu::new();
        cpu.pc = result.org;
        cpu.run(&mut mem, 100_000);
        (cpu, mem)
    }

    // ── Tests d'assemblage ────────────────────────────────────────────────────

    #[test]
    fn lda_imm_opcode() {
        let mem = asm("  LDA #$42\n  BRK\n");
        assert_eq!(mem.peek(0xE000), 0xA9); // opcode LDA imm
        assert_eq!(mem.peek(0xE001), 0x42); // opérande
        assert_eq!(mem.peek(0xE002), 0x00); // BRK
    }

    #[test]
    fn sta_zero_page() {
        let mem = asm("  LDA #$FF\n  STA $10\n  BRK\n");
        assert_eq!(mem.peek(0xE002), 0x85); // STA zp
        assert_eq!(mem.peek(0xE003), 0x10);
    }

    #[test]
    fn sta_absolute() {
        let mem = asm("  LDA #$01\n  STA $0200\n  BRK\n");
        assert_eq!(mem.peek(0xE002), 0x8D); // STA abs
        assert_eq!(mem.peek(0xE003), 0x00); // lo
        assert_eq!(mem.peek(0xE004), 0x02); // hi
    }

    #[test]
    fn equ_used_as_address() {
        let (_, mem) = run("SCREEN = $0200\n  LDA #$01\n  STA SCREEN\n  BRK\n");
        assert_eq!(mem.peek(0x0200), 0x01);
    }

    #[test]
    fn define_used_in_imm() {
        let (cpu, _) = run(".define SKY $03\n  LDA #SKY\n  BRK\n");
        assert_eq!(cpu.a, 0x03);
    }

    #[test]
    fn label_branch_forward() {
        let src = "  LDA #$00\n  BEQ SKIP\n  LDA #$FF\nSKIP:\n  BRK\n";
        let (cpu, _) = run(src);
        assert_eq!(cpu.a, 0x00);
    }

    #[test]
    fn label_branch_backward() {
        let src = "  LDX #$03\nLOOP:\n  DEX\n  BNE LOOP\n  BRK\n";
        let (cpu, _) = run(src);
        assert_eq!(cpu.x, 0);
    }

    #[test]
    fn jsr_rts() {
        let src = "  JSR SUB\n  BRK\nSUB:\n  LDA #$AA\n  RTS\n";
        let (cpu, _) = run(src);
        assert_eq!(cpu.a, 0xAA);
    }

    #[test]
    fn dot_byte_data() {
        let src = "  JMP AFTER\nDATA:\n  .byte $CA, $FE\nAFTER:\n  BRK\n";
        let mem = asm(src);
        // JMP = 3 octets depuis $E000, DATA à $E003
        assert_eq!(mem.peek(0xE003), 0xCA);
        assert_eq!(mem.peek(0xE004), 0xFE);
    }

    #[test]
    fn dot_word() {
        let mem = asm("  JMP AFTER\nAFTER:\n  .word $1234\n  BRK\n");
        // JMP = 3 octets, AFTER/$E003 .word $1234
        assert_eq!(mem.peek(0xE003), 0x34); // lo
        assert_eq!(mem.peek(0xE004), 0x12); // hi
    }

    #[test]
    fn indirect_y_write() {
        let src = "  LDA #$00\n  STA $F0\n  LDA #$02\n  STA $F1\n  LDA #$07\n  LDY #$05\n  STA ($F0),Y\n  BRK\n";
        let (_, mem) = run(src);
        assert_eq!(mem.peek(0x0205), 0x07);
    }

    #[test]
    fn indirect_x_read() {
        // $10 + X=4 = $14. vecteur $14/$15 = $0300. lit $0300 = 0
        let src = "  LDA #$00\n  STA $14\n  LDA #$03\n  STA $15\n  LDX #$04\n  LDA ($10,X)\n  BRK\n";
        let (cpu, _) = run(src);
        assert_eq!(cpu.a, 0x00);
    }

    #[test]
    fn asl_explicit_a() {
        let src = "  LDA #$04\n  ASL A\n  BRK\n";
        let (cpu, _) = run(src);
        assert_eq!(cpu.a, 0x08);
    }

    #[test]
    fn org_changes_origin() {
        let mem = asm(".org $0800\n  LDA #$55\n  BRK\n");
        assert_eq!(mem.peek(0x0800), 0xA9);
        assert_eq!(mem.peek(0x0801), 0x55);
    }

    #[test]
    fn lo_hi_operators() {
        let src = "ADDR = $1234\n  LDA #<ADDR\n  LDX #>ADDR\n  BRK\n";
        let (cpu, _) = run(src);
        assert_eq!(cpu.a, 0x34);
        assert_eq!(cpu.x, 0x12);
    }

    #[test]
    fn dot_res() {
        let src = ".org $E000\n  JMP SKIP\n  .res 8, $FF\nSKIP:\n  BRK\n";
        let mem = asm(src);
        for i in 0..8u16 {
            assert_eq!(mem.peek(0xE003 + i), 0xFF, "byte {} wrong", i);
        }
    }

    #[test]
    fn screen_constants_mario() {
        let src = r#"
SCREEN = $0200
SKY    = $01
BRICK  = $04

  LDA #SKY
  STA SCREEN
  LDA #BRICK
  STA SCREEN + 1
  BRK
"#;
        let (_, mem) = run(src);
        assert_eq!(mem.peek(0x0200), 0x01);
        assert_eq!(mem.peek(0x0201), 0x04);
    }

    #[test]
    fn branch_out_of_range_error() {
        let mut mem = Memory::new();
        let src = "  BEQ TARGET\n  .res 200, $EA\nTARGET:\n  BRK\n";
        let result = crate::Assembler::assemble(src, &mut mem);
        assert!(!result.ok, "Devrait échouer pour branchement hors portée");
    }
}
