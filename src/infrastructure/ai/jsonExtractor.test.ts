import { extractJson } from '@/infrastructure/ai/jsonExtractor';

describe('extractJson', () => {
  it('extracts JSON from ```json fenced block', () => {
    const text = '```json\n{"a":1}\n```';
    expect(extractJson(text)).toBe('{"a":1}');
  });

  it('extracts JSON from ``` fenced block without json tag', () => {
    const text = '```\n{"a":1}\n```';
    expect(extractJson(text)).toBe('{"a":1}');
  });

  it('returns trimmed text when no fence is present', () => {
    const text = '  {"a":1}  ';
    expect(extractJson(text)).toBe('{"a":1}');
  });

  it('handles multiline JSON inside fences', () => {
    const text = '```json\n{\n  "name": "test",\n  "value": 42\n}\n```';
    const result = extractJson(text);
    expect(result).toBe('{\n  "name": "test",\n  "value": 42\n}');
    expect(JSON.parse(result)).toEqual({ name: 'test', value: 42 });
  });

  it('extracts JSON from fence with surrounding text', () => {
    const text = 'Here is the result: ```json\n{"a":1}\n``` Done';
    expect(extractJson(text)).toBe('{"a":1}');
  });
});
