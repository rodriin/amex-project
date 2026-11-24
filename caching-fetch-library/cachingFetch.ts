// You may edit this file, add new files to support this file,
// and/or add new dependencies to the project as you see fit.
// However, you must not change the surface API presented from this file,
// and you should not need to change any other files in the project to complete the challenge

import { useEffect, useSyncExternalStore } from 'react';

type UseCachingFetch = (url: string) => {
  isLoading: boolean;
  data: unknown;
  error: Error | null;
};

// ---------------------------------------------------------------------------
// Cache store
//
// One module-level map, keyed by URL. Entries are immutable: every state
// change replaces the entry, so `useSyncExternalStore` can compare snapshots
// by reference. A `loading` entry holds the in-flight promise, which is how
// concurrent callers for the same URL share a single network request.
// ---------------------------------------------------------------------------

type CacheEntry =
  | { status: 'loading'; promise: Promise<void> }
  | { status: 'success'; data: unknown }
  | { status: 'error'; error: Error };

// Only settled entries can be sent to the browser.
type SerializedEntry =
  { status: 'success'; data: unknown } | { status: 'error'; message: string };

const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

const setEntry = (url: string, entry: CacheEntry) => {
  cache.set(url, entry);
  notify();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const toError = (value: unknown): Error =>
  value instanceof Error ? value : new Error(String(value));

/**
 * Starts a request for `url` unless one is already cached or in flight, and
 * returns a promise that settles when the entry does. Errors are stored in the
 * cache rather than thrown, so this promise never rejects.
 */
const load = (url: string): Promise<void> => {
  const existing = cache.get(url);
  if (existing?.status === 'loading') return existing.promise;
  if (existing) return Promise.resolve();

  // Start on the next microtask so `entry` below is assigned before the
  // callback reads it.
  const promise = Promise.resolve().then(async () => {
    try {
      const response = await fetch(url);
      // `ok` covers the whole 2xx range; the mock API answers 202.
      if (!response.ok) {
        throw new Error(
          `Request failed with status ${response.status} ${response.statusText}`.trim(),
        );
      }
      const data: unknown = await response.json();
      // Only write if the entry is still ours: wipeCache() may have run while
      // the request was in flight, and a stale result must not reappear.
      if (cache.get(url) === entry) setEntry(url, { status: 'success', data });
    } catch (error) {
      if (cache.get(url) === entry)
        setEntry(url, { status: 'error', error: toError(error) });
    }
  });
  const entry: CacheEntry = { status: 'loading', promise };
  setEntry(url, entry);
  return promise;
};

const LOADING = { isLoading: true, data: null, error: null } as const;

/**
 * 1. Implement a caching fetch hook. The hook should return an object with the following properties:
 * - isLoading: a boolean that is true when the fetch is in progress and false otherwise
 * - data: the data returned from the fetch, or null if the fetch has not completed
 * - error: an error object if the fetch fails, or null if the fetch is successful
 *
 * This hook is called three times on the client:
 *  - 1 in App.tsx
 *  - 2 in Person.tsx
 *  - 3 in Name.tsx
 *
 * Acceptance Criteria:
 * 1. The application at /appWithoutSSRData should properly render, with JavaScript enabled, you should see a list of people.
 * 2. You should only see 1 network request in the browser's network tab when visiting the /appWithoutSSRData route.
 * 3. You have not changed any code outside of this file to achieve this.
 * 4. This file passes a type-check.
 *
 */
export const useCachingFetch: UseCachingFetch = (url) => {
  // The server snapshot is the same cache: on the server it holds whatever
  // preloadCachingFetch stored, and in the browser during hydration it holds
  // what initializeCache restored, so the first render matches the HTML.
  const entry = useSyncExternalStore(
    subscribe,
    () => cache.get(url),
    () => cache.get(url),
  );

  // Fetch from an effect, never during render: effects don't run on the
  // server, so a non-preloaded server render shows the loading state, and the
  // browser's first render matches it before the request starts.
  useEffect(() => {
    load(url);
  }, [url]);

  if (!entry || entry.status === 'loading') return LOADING;
  if (entry.status === 'error')
    return { isLoading: false, data: null, error: entry.error };
  return { isLoading: false, data: entry.data, error: null };
};

/**
 * 2. Implement a preloading caching fetch function. The function should fetch the data.
 *
 * This function will be called once on the server before any rendering occurs.
 *
 * Any subsequent call to useCachingFetch should result in the returned data being available immediately.
 * Meaning that the page should be completely serverside rendered on /appWithSSRData
 *
 * Acceptance Criteria:
 * 1. The application at /appWithSSRData should properly render, with JavaScript disabled, you should see a list of people.
 * 2. You have not changed any code outside of this file to achieve this.
 * 3. This file passes a type-check.
 *
 */
export const preloadCachingFetch = async (url: string): Promise<void> => {
  // A failed request is cached as an error and rendered by the app, rather
  // than turning the whole page into a 500.
  await load(url);
};

/**
 * 3.1 Implement a serializeCache function that serializes the cache to a string.
 * 3.2 Implement an initializeCache function that initializes the cache from a serialized cache string.
 *
 * Together, these two functions will help the framework transfer your cache to the browser.
 *
 * The framework will call `serializeCache` on the server to serialize the cache to a string and inject it into the dom.
 * The framework will then call `initializeCache` on the browser with the serialized cache string to initialize the cache.
 *
 * Acceptance Criteria:
 * 1. The application at /appWithSSRData should properly render, with JavaScript enabled, you should see a list of people.
 * 2. You should not see any network calls to the people API when visiting the /appWithSSRData route.
 * 3. You have not changed any code outside of this file to achieve this.
 * 4. This file passes a type-check.
 *
 */
export const serializeCache = (): string => {
  const entries: Record<string, SerializedEntry> = {};
  for (const [url, entry] of cache) {
    if (entry.status === 'success')
      entries[url] = { status: 'success', data: entry.data };
    else if (entry.status === 'error')
      entries[url] = { status: 'error', message: entry.error.message };
  }
  // The framework pastes this string, unescaped, into a single-quoted JS
  // string inside a <script> tag. URI-encoding leaves no quotes, backslashes,
  // angle brackets or line breaks, so the data can neither end the string nor
  // the script. encodeURIComponent leaves ' alone, so encode it by hand.
  return encodeURIComponent(JSON.stringify(entries)).replace(/'/g, '%27');
};

export const initializeCache = (serializedCache: string): void => {
  let entries: Record<string, SerializedEntry>;
  try {
    entries = JSON.parse(decodeURIComponent(serializedCache)) as Record<
      string,
      SerializedEntry
    >;
  } catch {
    // Bad initial data shouldn't break the page: the hook will fetch instead.
    return;
  }
  for (const [url, entry] of Object.entries(entries)) {
    cache.set(
      url,
      entry.status === 'success'
        ? { status: 'success', data: entry.data }
        : { status: 'error', error: new Error(entry.message) },
    );
  }
  notify();
};

export const wipeCache = (): void => {
  cache.clear();
  notify();
};
