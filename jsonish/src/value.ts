export type CompletionState = 'Complete' | 'Incomplete';

export type Value = 
  | { type: 'string', value: string, completion: CompletionState }
  | { type: 'number', value: number, completion: CompletionState }
  | { type: 'boolean', value: boolean }
  | { type: 'null' }
  | { type: 'object', entries: [string, Value][], completion: CompletionState }
  | { type: 'array', items: Value[], completion: CompletionState }
  | { type: 'markdown', language: string, content: Value, completion: CompletionState }
  | { type: 'fixedJson', value: Value, fixes: string[] }
  | { type: 'anyOf', candidates: Value[], originalString: string };

export function createStringValue(value: string, completion: CompletionState = 'Complete'): Value {
  return { type: 'string', value, completion };
}

export function createNumberValue(value: number, completion: CompletionState = 'Complete'): Value {
  return { type: 'number', value, completion };
}

export function createBooleanValue(value: boolean): Value {
  return { type: 'boolean', value };
}

export function createNullValue(): Value {
  return { type: 'null' };
}

export function createObjectValue(entries: [string, Value][], completion: CompletionState = 'Complete'): Value {
  return { type: 'object', entries, completion };
}

export function createArrayValue(items: Value[], completion: CompletionState = 'Complete'): Value {
  return { type: 'array', items, completion };
}

export function createValueFromParsed(parsed: any): Value {
  if (parsed === null) {
    return createNullValue();
  }
  if (typeof parsed === 'string') {
    return createStringValue(parsed);
  }
  if (typeof parsed === 'number') {
    return createNumberValue(parsed);
  }
  if (typeof parsed === 'boolean') {
    return createBooleanValue(parsed);
  }
  if (Array.isArray(parsed)) {
    const items = parsed.map(createValueFromParsed);
    return createArrayValue(items);
  }
  if (typeof parsed === 'object') {
    const entries: [string, Value][] = Object.entries(parsed).map(([k, v]) => [k, createValueFromParsed(v)]);
    return createObjectValue(entries);
  }
  
  throw new Error(`Cannot create Value from: ${typeof parsed}`);
}

export function getCompletionState(value: Value): CompletionState {
  switch (value.type) {
    case 'string':
    case 'number':
    case 'object':
    case 'array':
    case 'markdown':
      return value.completion;
    case 'boolean':
    case 'null':
      return 'Complete';
    case 'fixedJson':
      return getCompletionState(value.value);
    case 'anyOf':
      // Completion state is incomplete if any candidate is incomplete
      for (const candidate of value.candidates) {
        if (getCompletionState(candidate) === 'Incomplete') {
          return 'Incomplete';
        }
      }
      return 'Complete';
  }
}