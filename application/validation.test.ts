import { describe, expect, it } from 'vitest';
import { validateData } from './validation';
import { people } from '../test/fixtures';

describe('validateData', () => {
  it('returns the data when it matches the schema', () => {
    expect(validateData(people)).toEqual(people);
  });

  it('accepts an empty list', () => {
    expect(validateData([])).toEqual([]);
  });

  it('throws when a field is missing', () => {
    const { email: _email, ...withoutEmail } = people[0];
    expect(() => validateData([withoutEmail])).toThrow();
  });

  it('throws when a field has the wrong type', () => {
    expect(() => validateData([{ ...people[0], balance: 100 }])).toThrow();
  });

  it('throws when the payload is not an array', () => {
    expect(() => validateData(people[0])).toThrow();
    expect(() => validateData(null)).toThrow();
  });
});
