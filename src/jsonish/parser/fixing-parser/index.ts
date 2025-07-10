// Export the main fixing parser functionality
export { collectionToValue, getCollectionName, getCompletionState } from './json-collection'
export type { JsonCollection } from './json-collection'
export { JsonParseState } from './json-parse-state'

// Main fixing parser entry point
export { parse as parseFixing } from './fixing-parser'
