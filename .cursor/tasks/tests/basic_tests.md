# basics.test.ts Progress Tracking

## Current Status: 66/67 tests passing (98.5%)

## Failing Tests

### 1. ✅ should handle localization with optional fields
**Fixed!** The solution was to implement recursive search in `findBestMatchRecursive` that checks nested arrays regardless of their completion state. The parser was creating deeply nested structures and the schema-aware layer needed to search through all levels to find the correct array.

### 2. ✅ should handle complex nested object with triple quotes  
**Fixed!** The solution was to make the core parser continue trying all strategies (markdown, findAllJSONObjects, etc.) when multiple sources exist, but only for cases where we have both markdown and JSON objects. This allows the parser to find JSON objects with triple quotes that come after markdown blocks.

### 3. ❌ should handle complex malformed JSON sequence
**Still failing!** The parser finds the malformed JSON correctly and captures it as field13's value, but the duplicate key handling logic is not producing the expected output. The test expects:
- foo2 to be an array with one object that has field13 containing the malformed JSON
- foo3 object with null values for fields 33-36

Current issues:
- The duplicate key handling creates the wrong structure for foo2
- foo3 has string "null" values instead of actual null values

## Key Insights

1. The iterative parser correctly identifies the malformed JSON and captures it as field13's value
2. The duplicate key handling needs to be more sophisticated to match the expected behavior
3. The test expects very specific behavior for how malformed JSON is parsed