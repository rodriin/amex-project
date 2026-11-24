import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupServer } from 'msw/node';
import { handler } from './handler';
import { validateData } from '../../application/validation';
import { PEOPLE_URL } from '../../test/fixtures';

const server = setupServer(handler);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());

describe('mock people API handler', () => {
  it('responds to the people URL with data the application can validate', async () => {
    const response = await fetch(PEOPLE_URL);

    // The mock deliberately answers 202 rather than 200
    expect(response.status).toBe(202);
    expect(response.ok).toBe(true);

    const people = validateData(await response.json());
    expect(people.length).toBeGreaterThan(0);
    expect(new Set(people.map((p) => p.email)).size).toBe(people.length);
  });
});
