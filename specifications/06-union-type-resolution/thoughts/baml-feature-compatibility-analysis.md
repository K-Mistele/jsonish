# BAML Feature Compatibility Analysis

**Date:** 2025-08-26  
**Context:** Union Type Resolution Feature Implementation  
**Author:** Claude  

## Overview

This document provides guidance on which BAML features should be included vs excluded when porting BAML's JSONish parser capabilities to TypeScript + Zod. Based on analysis of enum tests and BAML documentation, it establishes clear compatibility boundaries for the JSONish TypeScript implementation.

## Current Test Compatibility Status

### ✅ Enum Tests - 100% Compatible (19/19 Passing)

**Good News:** All current enum tests in `test/enum.test.ts` are **fully compatible** with TypeScript + Zod and are already passing.

**Test Categories Covered:**
- **Basic enum parsing** (exact matches, case-insensitive, quotes)
- **Array extraction** (single/multi-item arrays → enum value)  
- **Text extraction** (enum values from descriptive text, markdown)
- **Error cases** (ambiguous matches, multiple values)
- **Complex scenarios** (streaming context, special characters)

**Key Finding:** All tests use standard `z.enum()` schemas with no BAML DSL dependency.

### ❌ Union Tests - Compatibility Issues (5/17 Failing)

**Current Issues:** Union test failures are due to **implementation gaps**, not BAML compatibility issues:
- Markdown extraction not integrated with union resolution
- Quote handling inconsistencies  
- Array type resolution errors
- Missing graceful error handling

**Compatibility:** Union test patterns are TypeScript + Zod compatible.

## BAML-Specific Features to EXCLUDE

### 🚫 1. `@alias` DSL Annotations

**BAML Syntax (DO NOT IMPLEMENT):**
```rust
// BAML DSL - language-specific feature
enum Color {
    RED @alias("crimson") @alias("scarlet")
    BLUE @alias("navy") @alias("azure") 
    GREEN @alias("emerald") @alias("jade")
}
```

**Why Excluded:**
- BAML domain-specific language syntax
- Not supported in Zod schema definitions
- Would require custom BAML parser implementation

**TypeScript + Zod Alternative:**
```typescript
// Use standard Zod enums
const colorSchema = z.enum(["RED", "BLUE", "GREEN"]);
// Handle aliases through text extraction logic, not schema definitions
```

### 🚫 2. Dynamic Enum/Type Modification APIs

**BAML Runtime API (DO NOT IMPLEMENT):**
```typescript
// BAML TypeBuilder DSL
const dynamicEnum = tb.Enum("Categories", ["cat1", "cat2"])
  .addValue("cat3")
  .modify("OriginalEnum");
```

**Why Excluded:**
- BAML client-specific functionality, not JSONish parsing
- Runtime schema modification, not parsing pre-defined schemas
- Requires BAML compilation and runtime infrastructure

### 🚫 3. BAML Function/Prompt Compilation

**BAML Language Features (DO NOT IMPLEMENT):**
```rust  
// BAML function definitions
function ParseMyEnum() -> MyEnum {
    client "openai/gpt-4"
    prompt #"Return a color"#
}
```

**Why Excluded:**
- BAML language compilation features
- Prompt engineering and LLM client management
- Outside scope of JSONish parsing (we parse outputs, not generate prompts)

### 🚫 4. Advanced Unicode Normalization (Initially)

**BAML Features (DEFER FOR NOW):**
- **Tier 4/5 Unicode matching** - Complex character normalization
- **International character folding** - Beyond basic case conversion  
- **Diacritic stripping** - Complex Unicode equivalence rules

**Why Initially Excluded:**
- Significant complexity without immediate test coverage
- Current tests pass with basic case-insensitive matching
- Can be added later as enhancement when needed

## ✅ TypeScript + Zod Compatible Patterns

### Standard Zod Schema Patterns
```typescript
// ✅ These patterns ARE supported and appropriate
const enumSchema = z.enum(["ONE", "TWO", "THREE"]);
const optionalEnum = z.enum(["A", "B"]).optional();
const nullableEnum = z.enum(["X", "Y"]).nullable();

// ✅ Enum unions
const enumUnion = z.union([
  z.enum(["TYPE_A", "TYPE_B"]), 
  z.enum(["CATEGORY_1", "CATEGORY_2"])
]);

// ✅ Complex objects with enums
const complexSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
  category: z.enum(["SPAM", "NOT_SPAM"]),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional()
});

// ✅ Discriminated unions with enums
const apiResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("success"), data: z.any() }),
  z.object({ status: z.literal("error"), error: z.string() }),
  z.object({ status: z.literal("partial"), progress: z.number() })
]);
```

### Advanced Zod Integration Patterns
```typescript
// ✅ Refinements and custom validation
const constraintEnum = z.enum(["LOW", "MEDIUM", "HIGH"])
  .refine(val => ["LOW", "MEDIUM"].includes(val), {
    message: "Priority must be LOW or MEDIUM in demo mode"
  });

// ✅ Union type resolution with validation
const phoneOrEmail = z.union([
  z.string().regex(/^\d{3}-\d{3}-\d{4}$/), // Phone schema
  z.string().email()                        // Email schema  
]);
```

## Decision Criteria for Future Features

When evaluating whether to port a BAML feature:

### ✅ INCLUDE if:
- Uses standard Zod schema patterns (`z.enum()`, `z.union()`, `z.object()`)
- Focuses on **parsing** existing JSON-ish content (not generating)
- Enhances type coercion and error recovery capabilities
- Compatible with TypeScript type system
- Testable with existing Bun test infrastructure

### 🚫 EXCLUDE if:
- Requires BAML DSL syntax (`@alias`, `@@dynamic`, etc.)
- Involves runtime schema compilation or modification
- Part of BAML client/prompt engineering (not parsing)
- Requires BAML language parser infrastructure
- Outside scope of "parse JSON-ish → typed object" flow

### 🤔 EVALUATE CAREFULLY if:
- Complex Unicode/internationalization features
- Performance optimizations with significant complexity
- Advanced error recovery requiring new architecture
- Features that blur line between parsing and generation

## Implementation Guidelines

### For Enum Features:
- ✅ Focus on text extraction and case-insensitive matching
- ✅ Support enum values embedded in natural language
- 🚫 Avoid implementing `@alias` DSL syntax
- 🔄 Consider alias-like behavior through extraction logic

### For Union Features:  
- ✅ Implement sophisticated scoring and selection algorithms
- ✅ Support discriminated unions with Zod schemas
- ✅ Add validation-driven type selection (using Zod refinements)
- 🚫 Avoid BAML-specific union syntax or compilation

### For Future Features:
- Always check: "Does this require BAML DSL syntax?"
- Always check: "Can this be expressed with standard Zod schemas?"
- Always check: "Is this about parsing input or generating output?"
- Document exclusions clearly in implementation plans

## References

- **BAML JSONish Parser:** `baml/engine/baml-lib/jsonish/` - Original Rust implementation
- **TypeScript Implementation:** `jsonish/src/` - Current port with Zod integration
- **Exclusion Policy:** `/CLAUDE.md` - High-level guidance on BAML feature exclusions
- **Test Coverage:** `test/*.test.ts` - Comprehensive test suite using Zod schemas
- **Feature Specifications:** `specifications/*/feature.md` - Feature requirements using TypeScript + Zod patterns

## Conclusion

The JSONish TypeScript implementation should focus on **parsing capabilities** using **standard TypeScript + Zod patterns**. BAML's sophisticated text extraction, error recovery, and type coercion algorithms are valuable to port, but BAML's domain-specific language features, runtime compilation, and prompt engineering capabilities are outside the scope.

This approach maintains the powerful parsing capabilities while keeping the implementation focused, maintainable, and compatible with standard TypeScript tooling.