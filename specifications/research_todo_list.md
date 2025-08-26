# JSONish Feature Research Todo List

## Instructions for Resume
When resuming this task, continue from the first "pending" item in the list below. For each feature:
1. Read the feature.md file to understand what needs to be researched
2. Use Task agents to analyze the Rust codebase in @baml/engine/baml-lib/jsonish/
3. Create a research document in the feature's directory describing how it works at a HIGH LEVEL
4. Focus on architecture, file locations, and implementation approach (minimal Rust snippets)
5. Mark the item as completed and move to the next

## Progress Tracking

- [x] 01-basic-parsing - COMPLETED (implementation completed, has research and handoffs)
- [x] 02-object-class-parsing - COMPLETED (implementation completed, has research and handoffs) 
- [x] 03-advanced-object-parsing - COMPLETED (implementation completed, has research)
- [x] 04-array-list-parsing - RESEARCH COMPLETED (has research analysis, needs implementation)
- [ ] 05-enum-parsing - NO RESEARCH OR IMPLEMENTATION (only feature.md)
- [ ] 06-union-type-resolution - NO RESEARCH OR IMPLEMENTATION (only feature.md)
- [ ] 07-literal-value-parsing - NO RESEARCH OR IMPLEMENTATION (only feature.md)
- [ ] 08-map-record-parsing - NO RESEARCH OR IMPLEMENTATION (only feature.md)
- [ ] 09-alias-type-system - NO RESEARCH OR IMPLEMENTATION (only feature.md)
- [ ] 10-constraint-validation - NO RESEARCH OR IMPLEMENTATION (only feature.md)
- [ ] 11-streaming-parsing - NO RESEARCH OR IMPLEMENTATION (only feature.md)
- [ ] 12-partial-object-parsing - NO RESEARCH OR IMPLEMENTATION (only feature.md)
- [ ] 13-code-extraction-parsing - NO RESEARCH OR IMPLEMENTATION (only feature.md)
- [ ] 14-discriminated-union - NO RESEARCH OR IMPLEMENTATION (only feature.md)

## Current Status
Features 01-03 have been implemented. Feature 04 has research completed. Features 05-14 need research and implementation. Only feature 07 has previous research documentation.

## Notes
- Each research document should be saved as `research_YYYY-MM-DD_HH-MM-SS_rust-[feature-name]-architecture.md`
- Focus on high-level architecture and file locations, not implementation details
- Minimal Rust code snippets, emphasize conceptual understanding