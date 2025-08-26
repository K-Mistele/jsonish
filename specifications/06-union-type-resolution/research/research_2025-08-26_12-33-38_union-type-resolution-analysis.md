---
date: 2025-08-26 12:33:38 CDT
researcher: Claude
git_commit: 2cc6f1d37649de3510e4486703d6fdfad370c1c8
branch: master
repository: jsonish
topic: "Union type resolution implementation analysis"
tags: [research, codebase, union, parser, deserializer, coercer, scoring, type-resolution]
status: complete
last_updated: 2025-08-26
last_updated_by: Claude
type: research
---

# Research: Union Type Resolution Implementation Analysis

**Date**: 2025-08-26 12:33:38 CDT
**Researcher**: Claude
**Git Commit**: 2cc6f1d37649de3510e4486703d6fdfad370c1c8
**Branch**: master
**Repository**: jsonish

## Research Question
How does union type resolution work in the Rust BAML JSONish parser, what is the current state of the TypeScript implementation, and what needs to be added or changed to match the Rust functionality?

## Summary
The Rust implementation features a sophisticated union type resolution system with weighted scoring, advanced heuristics, and comprehensive flag tracking. The TypeScript implementation has basic union support but lacks the sophisticated scoring system, flag tracking, and advanced selection heuristics that make the Rust version robust. Key missing features include literal union support, constraint-based resolution, markdown extraction, and proper discriminated union handling.

## Detailed Findings

### Rust Union Type Resolution Architecture

#### **Core Resolution Strategy**
The Rust implementation uses a two-phase approach:

1. **`try_cast_union`** (`src/deserializer/coercer/coerce_union.rs:8-67`) - Conservative type matching without coercion
2. **`coerce_union`** (`src/deserializer/coercer/coerce_union.rs:69-94`) - Aggressive type conversion with fallbacks

#### **Sophisticated Scoring System**
The scoring system (`src/deserializer/score.rs:8-95`) uses a "lower is better" approach with:

- **Primitive types**: Base flag condition scores
- **Complex types**: Base score + 10x multiplier for nested element scores
- **Weighted flag penalties**: Each parsing flag has specific penalty values (1-110 points)

Key flag penalties:
```rust
Flag::OptionalDefaultFromNoValue => 1      // Mild penalty
Flag::DefaultFromNoValue => 100            // Heavy penalty  
Flag::DefaultButHadValue(_) => 110         // Heaviest penalty
Flag::ObjectFromMarkdown(s) => *s          // Variable markdown penalty
Flag::ImpliedKey(_) => 2                   // Inferred field penalty
Flag::UnionMatch(_, _) => 0                // No penalty for union selection
```

#### **Advanced Selection Algorithm**
The `pick_best` function (`src/deserializer/coercer/array_helper.rs:26-287`) implements complex heuristics:

- **List preferences**: Real lists over single-to-array conversions
- **Object preferences**: Real content over default-filled objects  
- **Type conversion penalties**: Composite types preferred over converted primitives
- **Union-specific logic**: De-prioritizes single-field string coercions in union contexts
- **Markdown handling**: Prefers parsed content over markdown strings

### TypeScript Implementation Analysis

#### **Current Union Resolution**
The TypeScript implementation (`jsonish/src/parser.ts:823-845`) has:

- **Basic scoring**: Simple type matching with bonuses (`calculateUnionScore`)
- **Sequential trial**: Tries all options and picks highest-scoring result
- **No flag tracking**: Missing the comprehensive flag system
- **Simple heuristics**: No advanced preference logic

#### **Major Limitations**
1. **Missing flag/condition tracking system**
2. **No advanced heuristics for type preference**
3. **Simple scoring algorithm without weighted penalties**
4. **No discriminated union optimization**
5. **Basic error handling without graceful fallbacks**

### Test Coverage Analysis

#### **Rust Test Patterns (Comprehensive)**
The Rust implementation includes extensive test coverage:

1. **Basic union tests**: Simple class discrimination (`test_union`)
2. **Array unions**: Class vs array of classes (`test_union_full`)
3. **Discriminated enum unions**: Complex three-way unions with enum fields (`test_union2`)
4. **Complex real-world unions**: API response unions with nested objects (`test_union3`)
5. **Validation-based unions**: Regex-based phone/email discrimination
6. **String preference tests**: String beats numeric parsing in ambiguous cases
7. **Literal union tests**: 30+ test cases covering ambiguity, extraction, case sensitivity
8. **Constraint-based unions**: Union resolution by Zod refinement validation
9. **Streaming unions**: Partial parsing with nullable annotations
10. **International character handling**: Multi-language literal unions

#### **TypeScript Test Coverage (Basic)**
Current TypeScript tests cover:

- ✅ Basic class unions
- ✅ Primitive unions (string|number, string|boolean)
- ✅ Array type unions
- ✅ String preference over numbers
- ❌ **Failing**: Discriminated union with enum discrimination (markdown extraction)
- ❌ **Failing**: Complex nested union objects (markdown extraction)
- ❌ **Failing**: Quote handling in string parsing
- ❌ **Failing**: Number array vs string array resolution

#### **Critical Missing Test Coverage**
1. **Literal union tests** - All 30+ literal union patterns from Rust
2. **Constraint-based union resolution** - Zod refinement-based selection
3. **Markdown extraction tests** - Triple-quoted JSON block parsing
4. **Streaming/partial union tests** - Partial parsing support
5. **International character tests** - Multi-language support

## Code References

### Rust Implementation
- `src/deserializer/coercer/coerce_union.rs:8-67` - `try_cast_union` conservative matching
- `src/deserializer/coercer/coerce_union.rs:69-94` - `coerce_union` aggressive conversion
- `src/deserializer/coercer/array_helper.rs:26-287` - `pick_best` selection algorithm
- `src/deserializer/score.rs:34-76` - Flag penalty scoring system
- `src/deserializer/types.rs` - `BamlValueWithFlags` structure with metadata tracking
- `src/tests/test_unions.rs` - Comprehensive union test patterns
- `src/tests/test_literals.rs` - 30+ literal union test cases
- `src/tests/test_constraints.rs:44-80` - Constraint-based union resolution

### TypeScript Implementation  
- `jsonish/src/parser.ts:823-845` - Basic `coerceUnion` function
- `jsonish/src/parser.ts:1027-1083` - Simple `calculateUnionScore` function
- `test/unions.test.ts:315-396` - Failing test cases requiring fixes
- `jsonish/src/value.ts` - Basic `Value` type without flag tracking

## Parser Flow Analysis

### Rust Flow
1. Raw input → `entry_parser.rs` → tokenization and fixing
2. Tokens → `Value` construction with completion state
3. Value → `coerce_union` or `try_cast_union` depending on strictness
4. Each union option attempted with full coercion pipeline
5. Results scored using flag-based penalty system
6. `pick_best` applies complex heuristics and selects optimal match
7. Selected result tagged with `UnionMatch` flag for traceability

### TypeScript Flow
1. Raw input → Multi-strategy parsing → `Value` construction
2. Value → `coerceUnion` with simple option trial
3. Each option coerced with basic error catching
4. Results scored using simple type matching bonuses
5. Highest-scoring result selected without advanced heuristics
6. No flag tracking or traceability metadata

## Architecture Insights

### Key Architectural Patterns
1. **Flag-based quality tracking**: Rust tracks parsing quality through comprehensive flag system
2. **Recursive scoring with penalties**: Complex types multiply child scores by 10x
3. **Conservative vs aggressive paths**: `try_cast` for exact matches, `coerce` for conversion fallbacks
4. **Union-specific heuristics**: Special logic for union contexts vs general type coercion
5. **Preference hierarchies**: Sophisticated logic for type preference (composite over primitive, real content over defaults)

### Missing TypeScript Architecture
1. **Flag/condition tracking system** - No metadata about parsing quality
2. **Weighted scoring algorithm** - No penalty-based selection
3. **Union-specific logic** - No special handling for union contexts
4. **Advanced heuristics** - No preference logic for complex type selection
5. **Discriminator optimization** - No fast path for discriminated unions

## Related Documentation
- `CLAUDE.md` - JSONish architecture and TDD approach using Zod schemas
- `specifications/requirements.md` - Original parser requirements for union handling
- `baml/engine/baml-lib/jsonish/README.md` - Rust implementation architecture

## Open Questions

### Implementation Questions
1. **Flag system design**: How to adapt Rust's flag system to TypeScript/Zod context?
2. **Scoring integration**: How to integrate weighted scoring with Zod schema validation?  
3. **Performance considerations**: Will complex heuristics impact parsing speed significantly?
4. **Memory usage**: How to track parsing metadata without excessive memory overhead?

### Feature Prioritization
1. **Critical fixes needed**: Markdown extraction, quote handling, discriminated unions
2. **Literal union implementation**: 30+ test cases need to be ported and implemented
3. **Constraint-based resolution**: Integration with Zod refinements for union selection
4. **Streaming support**: Partial parsing for incomplete union inputs

### Testing Strategy
1. **Test porting approach**: How to systematically port 60+ Rust union tests?
2. **TypeScript-specific tests**: What Zod-specific union patterns need testing?
3. **Performance benchmarks**: How to ensure union resolution remains fast?
4. **Regression prevention**: How to prevent scoring logic from breaking existing functionality?

### Design Decisions
1. **API compatibility**: Should the TypeScript API exactly match Rust behavior?
2. **Error handling strategy**: Throw vs graceful fallback for unmatchable unions?
3. **Zod integration depth**: How tightly to couple with Zod validation system?
4. **Configuration options**: Should union resolution be configurable or fixed?