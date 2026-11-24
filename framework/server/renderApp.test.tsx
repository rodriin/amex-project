import { afterEach, describe, expect, it, vi } from 'vitest';
import renderApp from './renderApp';
import {
  preloadCachingFetch,
  serializeCache,
  useCachingFetch,
} from '../../caching-fetch-library/cachingFetch';
import { people } from '../../test/fixtures';

vi.mock('../../caching-fetch-library/cachingFetch', () => ({
  useCachingFetch: vi.fn(),
  preloadCachingFetch: vi.fn(),
  serializeCache: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe('renderApp', () => {
  it('preloads data, serializes the cache and renders the app when loading data on the server', async () => {
    vi.mocked(useCachingFetch).mockReturnValue({
      data: people,
      isLoading: false,
      error: null,
    });
    vi.mocked(serializeCache).mockReturnValue('SERIALIZED_CACHE');

    const [html, initialData] = await renderApp(true);

    expect(preloadCachingFetch).toHaveBeenCalledTimes(1);
    expect(serializeCache).toHaveBeenCalledTimes(1);
    expect(initialData).toBe('SERIALIZED_CACHE');
    expect(html).toContain('Ada');
    expect(html).toContain('alan@example.com');
  });

  it('serializes the cache only after preloading has finished', async () => {
    const order: string[] = [];
    vi.mocked(preloadCachingFetch).mockImplementation(async () => {
      order.push('preload');
    });
    vi.mocked(serializeCache).mockImplementation(() => {
      order.push('serialize');
      return '';
    });
    vi.mocked(useCachingFetch).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    await renderApp(true);
    expect(order).toEqual(['preload', 'serialize']);
  });

  it('skips preloading and returns no initial data otherwise', async () => {
    vi.mocked(useCachingFetch).mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    });

    const [html, initialData] = await renderApp(false);

    expect(preloadCachingFetch).not.toHaveBeenCalled();
    expect(serializeCache).not.toHaveBeenCalled();
    expect(initialData).toBeUndefined();
    expect(html).toContain('Loading...');
  });
});
