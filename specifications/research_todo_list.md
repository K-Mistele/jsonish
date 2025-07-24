# JSONish Feature Research Todo List

## Instructions for Resume
When resuming this task, continue from the first "pending" item in the list below. For each feature:
1. Read the feature.md file to understand what needs to be researched
2. Use Task agents to analyze the Rust codebase in @baml/engine/baml-lib/jsonish/
3. Create a research document in the feature's directory describing how it works at a HIGH LEVEL
4. Focus on architecture, file locations, and implementation approach (minimal Rust snippets)
5. Mark the item as completed and move to the next

## Progress Tracking

- [x] 01-basic-parsing - COMPLETED (already has research document)
- [x] 05-enum-parsing - COMPLETED (already has research document)
- [x] 02-object-class-parsing - COMPLETED (research_2025-07-24_03-23-13_rust-object-class-parsing-architecture.md)
- [x] 03-advanced-object-parsing - COMPLETED (research_2025-07-23_22-46-43_rust-advanced-object-parsing-architecture.md)
- [x] 04-array-list-parsing - COMPLETED (research_2025-07-23_23-02-04_rust-array-list-parsing-architecture.md)
- [ ] 06-union-type-resolution - PENDING
- [ ] 07-literal-value-parsing - PENDING
- [ ] 08-map-record-parsing - PENDING
- [ ] 09-alias-type-system - PENDING
- [ ] 10-constraint-validation - PENDING
- [ ] 11-streaming-parsing - PENDING
- [ ] 12-partial-object-parsing - PENDING
- [ ] 13-code-extraction-parsing - PENDING

## Current Status
Completed 04-array-list-parsing. Next: 06-union-type-resolution

## Notes
- Each research document should be saved as `research_YYYY-MM-DD_HH-MM-SS_rust-[feature-name]-architecture.md`
- Focus on high-level architecture and file locations, not implementation details
- Minimal Rust code snippets, emphasize conceptual understanding