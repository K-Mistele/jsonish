# Research Codebase

You are tasked with conducting comprehensive research across the JSONish TypeScript parser library to answer user questions by spawning parallel sub-agents and synthesizing their findings.

## Initial Setup:

When this command is invoked, respond with:
```
I'm ready to research the JSONish parser codebase. Please provide your research question or area of interest, and I'll analyze it thoroughly by exploring the parser architecture, type coercion system, error recovery mechanisms, and test patterns.
```

Then wait for the user's research query.

## Steps to follow after receiving the research query:

1. **Read any directly mentioned files first:**
   - If the user mentions specific files (test files, docs, configs), read them FULLY first
   - **IMPORTANT**: Use the Read tool WITHOUT limit/offset parameters to read entire files
   - **CRITICAL**: Read these files yourself in the main context before spawning any sub-tasks
   - This ensures you have full context before decomposing the research

2. **Analyze and decompose the research question:**
   - Break down the user's query into composable research areas
   - Identify specific components, patterns, or concepts to investigate
   - Create a research plan using TodoWrite to track all subtasks
   - Consider which directories, files, or architectural patterns are relevant

3. **Spawn parallel sub-agent tasks for comprehensive research:**
   - Create multiple Task agents to research different aspects concurrently
   - Always include these parallel tasks:
     - **Core parsing system tasks** (src/jsonish/parser/ directory - entry_parser.ts, fixing-parser/)
     - **Type coercion system tasks** (src/deserializer/coercer/ - primitive, array, union, map coercers)
     - **Test coverage analysis tasks** (test/ directory - basics.test.ts, streaming.test.ts, partials.test.ts)
   - Optionally include if it makes sense for the task:
     - **Value representation tasks** (src/jsonish/value.ts - internal value types)
     - **Scoring system tasks** (src/deserializer/score.ts - type matching logic)
     - **Error recovery tasks** (src/jsonish/parser/fixing-parser/ - malformed JSON handling)
     - **Helper utilities tasks** (src/helpers/ directory exploration)
     - **Web Research tasks** (only if the user explicitly asks you to search the web)
   - Each codebase sub-agent should focus on a specific parser component or coercion mechanism
   - Write detailed prompts for each sub-agent following these guidelines:
     - Instruct them to use READ-ONLY tools (Read, Grep, Glob, LS)
     - Ask for specific file paths and line numbers
     - Request they identify parser flow: Parser → Value → Deserializer → Coercer
     - Have them trace type coercion paths and scoring logic
     - Ask them to find test cases demonstrating edge cases
   - Example parser research sub-agent prompt:
     ```
     Research [parser component/error recovery mechanism] in src/jsonish/parser/:
     1. Find all TypeScript files implementing [parsing feature]
     2. Trace how malformed JSON is handled (include file:line references)
     3. Identify connections between parser and Value types
     4. Find test cases demonstrating this parser behavior (test/*.test.ts)
     5. Note error recovery strategies and fixing patterns
     6. Use only READ-ONLY tools (Read, Grep, Glob, LS)
     Return: Parser flow, error handling logic, test coverage, and implementation details
     ```
   - Example coercion research sub-agent prompt:
     ```
     Research [type coercion/scoring] in src/deserializer/:
     1. Find coercer implementations for [data type]
     2. Trace how values are coerced to match Zod schemas (include file:line refs)
     3. Analyze scoring system for union type resolution
     4. Find test cases showing coercion edge cases
     5. Note how partial/streaming data is handled
     6. Use only READ-ONLY tools (Read, Grep, Glob, LS)
     Return: Coercion logic, score calculations, Zod integration patterns
     ```
   - Example web sub-agent prompt (only create if user explicitly asks for web search):
     ```
     Research [specific component/pattern] using WebSearch and/or WebFetch:
     1. Find all pages related to [topic]
     2. Identify how [concept] could be implemented (include page:quotation references)
     3. Look for connections to [related components]
     4. Find examples of usage in [relevant areas]
     5. Note any patterns or conventions used
     6. Use only WEB TOOLS (WebFetch, WebSearch) and READ-ONLY tools (Read, Grep, Glob, LS)
     Return: web pages, exact quotations, and concise explanations of findings
     ```

4. **Wait for all sub-agents to complete and synthesize findings:**
   - IMPORTANT: Wait for ALL sub-agent tasks to complete before proceeding
   - Compile all sub-agent results focusing on parser architecture
   - Trace the complete flow: Raw JSON → Parser → Value → Deserializer → Coercer → Result
   - Connect findings across parser, deserializer, and test components
   - Include specific file paths and line numbers for reference
   - Highlight key patterns:
     - Error recovery strategies in fixing-parser
     - Type coercion logic and scoring algorithms
     - Zod schema integration points
     - Streaming/partial parsing capabilities
   - Answer the user's specific questions with concrete code examples

5. **Gather metadata for the research document:**
   - Get current date/time, git commit hash, branch name, and repository info using bash commands
   - Filename: should be under the `specifications/[feature]/research` directory (note: with an 's'). Name the file `research_YYYY-MM-DD_HH-MM-SS_topic.md`

6. **Generate research document:**
   - Use the metadata gathered in step 4
   - Structure the document with YAML frontmatter followed by content:
     ```markdown
     ---
     date: [Current date and time with timezone in ISO format]
     researcher: [Researcher name from thoughts status]
     git_commit: [Current commit hash]
     branch: [Current branch name]
     repository: [Repository name]
     topic: "[User's Question/Topic]"
     tags: [research, codebase, relevant-component-names]
     status: complete
     last_updated: [Current date in YYYY-MM-DD format]
     last_updated_by: [Researcher name]
     type: research
     ---

     # Research: [User's Question/Topic]

     **Date**: [Current date and time with timezone from step 4]
     **Researcher**: [Researcher name from thoughts status]
     **Git Commit**: [Current commit hash from step 4]
     **Branch**: [Current branch name from step 4]
     **Repository**: [Repository name]

     ## Research Question
     [Original user query]

     ## Summary
     [High-level findings answering the user's question]

     ## Detailed Findings

     ### [Component/Area 1]
     - Finding with reference ([file.ext:line](link))
     - Connection to other components
     - Implementation details

     ### [Component/Area 2]
     ...

     ## Code References
     - `src/jsonish/parser/entry_parser.ts:123` - Main parser entry point and configuration
     - `src/jsonish/parser/fixing-parser/index.ts:45-67` - Error recovery implementation
     - `src/deserializer/deserializer.ts:89` - Main deserialization logic
     - `src/deserializer/coercer/union_coercer.ts:23-45` - Union type resolution and scoring
     - `src/deserializer/score.ts:12-34` - Scoring algorithm for type matching
     - `test/streaming.test.ts:56` - Streaming JSON parsing test cases
     - `test/partials.test.ts:78` - Partial object handling examples

     ## Parser Flow
     [Detailed trace of how data flows through the system]
     1. Raw input → `entry_parser.ts` → tokenization
     2. Tokens → `fixing-parser` → error recovery
     3. Fixed tokens → `Value` construction
     4. Value → `deserializer.ts` → schema matching
     5. Schema → appropriate `coercer` → type conversion
     6. Score calculation → best match selection

     ## Architecture Insights
     [Key architectural patterns discovered]
     - Error recovery mechanisms and strategies
     - Type coercion patterns and edge cases
     - Scoring system for ambiguous type resolution
     - Zod schema integration approach
     - Streaming/partial data handling

     ## Related Documentation
     [Relevant insights from project documentation]
     - `CLAUDE.md` - JSONish architecture and development guidelines
     - `README.md` - Feature documentation and API examples
     - `specifications/requirements.md` - Original parser requirements
     - `test/README.md` - Testing patterns and conventions

     ## Related Research
     [Links to other research documents in `specifications/[feature]/research`]

     ## Open Questions
     [Any areas that need further investigation]
     ```

7. **Add GitHub permalinks (if applicable):**
   - Check if on main branch or if commit is pushed: `git branch --show-current` and `git status`
   - If on main/master or pushed, generate GitHub permalinks:
     - Get repo info: `gh repo view --json owner,name`
     - Create permalinks: `https://github.com/{owner}/{repo}/blob/{commit}/{file}#L{line}`
   - Replace local file references with permalinks in the document

8. **Sync and present findings:**
   - Present a concise summary of findings to the user
   - Include key file references for easy navigation
   - Ask if they have follow-up questions or need clarification

9. **Handle follow-up questions:**
   - If the user has follow-up questions, append to the same research document
   - Update the frontmatter fields `last_updated` and `last_updated_by` to reflect the update
   - Add `last_updated_note: "Added follow-up research for [brief description]"` to frontmatter
   - Add a new section: `## Follow-up Research [timestamp]`
   - Spawn new sub-agents as needed for additional investigation
   - Continue updating the document and syncing

## Important notes:
- Always use parallel Task agents to maximize efficiency and minimize context usage
- Always run fresh codebase research - never rely solely on existing research documents
- Focus on finding concrete file paths and line numbers for developer reference
- Research documents should be self-contained with all necessary context
- Each sub-agent prompt should be specific and focused on read-only operations
- **Parser Architecture Focus**:
  - Trace the complete parser flow: Input → Parser → Value → Deserializer → Coercer → Output
  - Understand error recovery mechanisms in fixing-parser
  - Analyze type coercion strategies for different data types
  - Study scoring algorithms for union type resolution
  - Examine streaming and partial JSON handling
- **Key Components to Research**:
  - Parser: entry_parser.ts, fixing-parser/* (error recovery)
  - Value: value.ts (internal representation)
  - Deserializer: deserializer.ts, flags.ts, score.ts
  - Coercers: primitive, array, union, map, literal, ir_ref/*
  - Tests: basics, streaming, partials, unions, enums
- Include temporal context (when the research was conducted)
- Link to GitHub when possible for permanent references
- Keep the main agent focused on synthesis, not deep file reading
- Encourage sub-agents to find test cases demonstrating edge cases
- Pay special attention to:
  - Zod schema integration patterns
  - Malformed JSON handling strategies
  - Type coercion edge cases
  - Scoring system for ambiguous types
  - Partial/streaming data support
- **File reading**: Always read mentioned files FULLY (no limit/offset) before spawning sub-tasks
- **Critical ordering**: Follow the numbered steps exactly
  - ALWAYS read mentioned files first before spawning sub-tasks (step 1)
  - ALWAYS wait for all sub-agents to complete before synthesizing (step 4)
  - ALWAYS gather metadata before writing the document (step 5 before step 6)
  - NEVER write the research document with placeholder values
- **Frontmatter consistency**:
  - Always include frontmatter at the beginning of research documents
  - Keep frontmatter fields consistent across all research documents
  - Update frontmatter when adding follow-up research
  - Use snake_case for multi-word field names (e.g., `last_updated`, `git_commit`)
  - Tags should be parser-specific (e.g., parser, deserializer, coercer, zod, streaming, error-recovery, type-coercion)