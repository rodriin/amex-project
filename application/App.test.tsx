// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import App from './App';
import {
  preloadCachingFetch,
  useCachingFetch,
} from '../caching-fetch-library/cachingFetch';
import { PEOPLE_URL, people } from '../test/fixtures';

// The application is tested against a stubbed hook so these tests
// don't depend on the (separately tested) caching fetch library.
vi.mock('../caching-fetch-library/cachingFetch', () => ({
  useCachingFetch: vi.fn(),
  preloadCachingFetch: vi.fn(),
}));

const mockedUseCachingFetch = vi.mocked(useCachingFetch);

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('App', () => {
  it('shows a loading state while the fetch is in progress', () => {
    mockedUseCachingFetch.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });
    render(<App />);
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('shows the error message when the fetch fails', () => {
    mockedUseCachingFetch.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('network down'),
    });
    render(<App />);
    expect(screen.getByText('Error: network down')).toBeTruthy();
  });

  it('renders every person, including nested Person and Name components', () => {
    mockedUseCachingFetch.mockReturnValue({
      data: people,
      isLoading: false,
      error: null,
    });
    render(<App />);

    expect(screen.getByText('Welcome to the People Directory')).toBeTruthy();
    for (const person of people) {
      expect(screen.getByText(`${person.first} ${person.last}`)).toBeTruthy();
      expect(screen.getByText(person.email)).toBeTruthy();
      expect(screen.getByText(person.balance)).toBeTruthy();
    }
    // App, each Person and each Name all read from the hook with the same URL
    expect(mockedUseCachingFetch).toHaveBeenCalledTimes(1 + people.length * 2);
    expect(
      mockedUseCachingFetch.mock.calls.every(([url]) => url === PEOPLE_URL),
    ).toBe(true);
  });

  it('throws when the data does not match the schema', () => {
    // React reports the render error to the console and to window 'error';
    // silence both so the expected failure doesn't clutter the test output.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const swallow = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', swallow);
    onTestFinished(() => window.removeEventListener('error', swallow));
    mockedUseCachingFetch.mockReturnValue({
      data: [{ first: 'Missing fields' }],
      isLoading: false,
      error: null,
    });
    expect(() => render(<App />)).toThrow();
  });

  it('preloads the people URL for server rendering', async () => {
    await App.preLoadServerData?.();
    expect(preloadCachingFetch).toHaveBeenCalledWith(PEOPLE_URL);
  });
});
