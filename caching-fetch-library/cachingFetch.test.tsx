// @vitest-environment jsdom
import React from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  initializeCache,
  preloadCachingFetch,
  serializeCache,
  useCachingFetch,
  wipeCache,
} from './cachingFetch';
import { PEOPLE_URL, people } from '../test/fixtures';

const fetchMock = vi.fn<typeof fetch>();

const respondWith = (body: unknown, status = 202) =>
  fetchMock.mockImplementation(async () => Response.json(body, { status }));

// Renders the hook's state as text so tests can assert on what a user sees.
const Probe = ({ url = PEOPLE_URL }: { url?: string }) => {
  const { isLoading, data, error } = useCachingFetch(url);
  if (isLoading) return <p>loading</p>;
  if (error) return <p>error: {error.message}</p>;
  return <p>data: {JSON.stringify(data)}</p>;
};

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  wipeCache();
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

describe('useCachingFetch', () => {
  it('shows loading, then the data', async () => {
    respondWith(people);
    render(<Probe />);
    expect(screen.getByText('loading')).toBeTruthy();
    expect(await screen.findByText(`data: ${JSON.stringify(people)}`));
  });

  it('makes a single request for many components using the same URL', async () => {
    respondWith(people);
    render(
      <>
        <Probe />
        <Probe />
        <Probe />
      </>,
    );
    expect(
      await screen.findAllByText(`data: ${JSON.stringify(people)}`),
    ).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(PEOPLE_URL);
  });

  it('serves later mounts from the cache without fetching again', async () => {
    respondWith(people);
    const { unmount } = render(<Probe />);
    await screen.findByText(/^data:/);
    unmount();

    render(<Probe />);
    expect(screen.getByText(/^data:/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches different URLs separately', async () => {
    fetchMock.mockImplementation(async (input) =>
      Response.json({ url: String(input) }),
    );
    render(
      <>
        <Probe url="https://example.com/a" />
        <Probe url="https://example.com/b" />
      </>,
    );
    expect(await screen.findByText('data: {"url":"https://example.com/a"}'));
    expect(await screen.findByText('data: {"url":"https://example.com/b"}'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports an error for a non-2xx response', async () => {
    fetchMock.mockResolvedValue(
      new Response('nope', { status: 500, statusText: 'Server Error' }),
    );
    render(<Probe />);
    expect(
      await screen.findByText(
        'error: Request failed with status 500 Server Error',
      ),
    );
  });

  it('reports network failures as errors', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    render(<Probe />);
    expect(await screen.findByText('error: Failed to fetch'));
  });

  it('does not fetch during server rendering', () => {
    respondWith(people);
    expect(renderToString(<Probe />)).toContain('loading');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('preloadCachingFetch', () => {
  it('makes data available synchronously to a server render', async () => {
    respondWith(people);
    await preloadCachingFetch(PEOPLE_URL);
    expect(renderToString(<Probe />)).toContain('Ada');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shares an in-flight request with the hook', async () => {
    respondWith(people);
    const preload = preloadCachingFetch(PEOPLE_URL);
    render(<Probe />);
    await act(() => preload);
    expect(screen.getByText(/^data:/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('resolves and caches the error when the request fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(preloadCachingFetch(PEOPLE_URL)).resolves.toBeUndefined();
    expect(renderToString(<Probe />)).toContain('offline');
  });
});

describe('serializeCache / initializeCache', () => {
  it('round-trips the cache so the browser needs no request', async () => {
    respondWith(people);
    await preloadCachingFetch(PEOPLE_URL);
    const serialized = serializeCache();

    wipeCache();
    fetchMock.mockReset();
    initializeCache(serialized);

    render(<Probe />);
    expect(screen.getByText(`data: ${JSON.stringify(people)}`)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('round-trips cached errors', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await preloadCachingFetch(PEOPLE_URL);
    const serialized = serializeCache();
    wipeCache();
    initializeCache(serialized);
    render(<Probe />);
    expect(screen.getByText('error: offline')).toBeTruthy();
  });

  it('is safe to embed in a single-quoted string inside a script tag', async () => {
    const nasty = [`it's a "quote" \\ </script><script>alert(1)</script>\n`];
    respondWith(nasty);
    await preloadCachingFetch(PEOPLE_URL);
    const serialized = serializeCache();

    expect(serialized).not.toMatch(/['"\\<>\n\r\u2028\u2029]/);
    // Evaluate it the way the browser would after buildHtmlDoc injects it.
    const evaluated = new Function(`return '${serialized}'`)() as string;

    wipeCache();
    initializeCache(evaluated);
    render(<Probe />);
    expect(screen.getByText(`data: ${JSON.stringify(nasty)}`)).toBeTruthy();
  });

  it('serializes an empty cache and skips in-flight requests', () => {
    fetchMock.mockReturnValue(new Promise(() => { }));
    expect(initializeCache(serializeCache())).toBeUndefined();
    void preloadCachingFetch(PEOPLE_URL);
    expect(decodeURIComponent(serializeCache())).toBe('{}');
  });

  it('ignores malformed input and falls back to fetching', async () => {
    respondWith(people);
    expect(() => initializeCache('%E0%A4%A')).not.toThrow();
    expect(() => initializeCache('not json')).not.toThrow();
    render(<Probe />);
    expect(await screen.findByText(/^data:/));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('wipeCache', () => {
  it('forces the next use to fetch again', async () => {
    respondWith(people);
    await preloadCachingFetch(PEOPLE_URL);
    wipeCache();
    await preloadCachingFetch(PEOPLE_URL);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops the result of a request that was in flight when wiped', async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    const preload = preloadCachingFetch(PEOPLE_URL);
    await Promise.resolve(); // let the request start
    wipeCache();
    resolve(Response.json(people));
    await preload;
    expect(serializeCache()).toBe(encodeURIComponent('{}'));
  });
});
