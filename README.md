# People Directory

A small server-rendered React app that lists people from a (mocked) API. It has three parts:

- **`framework/`**: a minimal SSR framework. It has a Fastify server, a client runtime that hydrates the page, and an [MSW](https://mswjs.io/) mock server so the app runs without a network connection.
- **`application/`**: the React app (`App` → `Person` → `Name`). Responses are validated with [valibot](https://valibot.dev/).
- **`caching-fetch-library/`**: a caching fetch hook plus helpers to preload data on the server and pass the cache to the browser.

The original brief is in [`DevTask.md`](./DevTask.md).

[`DECISIONS.md`](./DECISIONS.md) records each tooling and setup choice made for this project (git ignores, the Mock Service Worker fix, type checking, linting, formatting and tests) and the reasoning behind it. It's kept separate so this README stays a quick guide to running the project, while reviewers and future contributors can see why things are set up the way they are.

## Getting started

Requires Node.js **22.12 or newer** (Vitest 5's minimum; developed on Node 26).

```bash
npm ci       # install the exact versions from package-lock.json
npm start    # build, then serve on http://localhost:3000
```

The landing page links to the two versions of the app:

| Route                | Data loaded on | What it shows                                                                                     |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------- |
| `/appWithoutSSRData` | the client     | The server renders the loading state, then the browser fetches the data (through the MSW worker). |
| `/appWithSSRData`    | the server     | The server preloads the data, renders the full page, and sends the cache to the browser.          |

## Scripts

| Command             | What it does                                                                     |
| ------------------- | -------------------------------------------------------------------------------- |
| `npm start`         | Build everything and start the server on port 3000.                              |
| `npm run build`     | Bundle the server (`dist/server.js`) and client (`dist/client.js`) with esbuild. |
| `npm run typecheck` | Type-check the whole project with `tsc` (no output files).                       |
| `npm run lint`      | Lint with ESLint. `npm run lint:fix` applies automatic fixes.                    |
| `npm run format`    | Format with Prettier. `npm run format:check` only reports problems.              |
| `npm test`          | Run the unit tests once with Vitest. `npm run test:watch` re-runs on changes.    |
| `npm run check`     | Type check, lint, format check and tests in one go. Run this before pushing.     |

To run a single test file or test, pass a path or name filter to Vitest:

```bash
npx vitest run application/validation.test.ts
npx vitest run -t "injects initial data"
```

## Upgrading MSW

After upgrading MSW, regenerate the worker so it matches the new library version:

```bash
npx msw init   # writes the worker into the workerDirectory from package.json (mock-service-worker/)
```

MSW's `postinstall` script runs this step automatically, but only when npm runs install scripts. npm can be configured to skip install scripts for packages that haven't been approved, so don't rely on it. If the versions get out of sync, MSW logs a warning in the browser console.

## Known issues and next steps

- **Dependency upgrades.** A few dependencies are on older major versions that `npm update` won't move past, and `npm audit` flags some of them. Upgrading needs some code changes and testing, so it's been left for later.
- **Continuous integration.** No CI pipeline is set up yet. A GitHub Actions workflow running `npm ci && npm run check && npm run build` on each push and pull request would enforce everything above.
- **Node version.** Add an `.nvmrc` file and an `engines` field in `package.json` so the Node 22.12+ requirement is enforced, not just documented.
- **Pre-commit hooks.** Run Prettier and ESLint on staged files (husky with lint-staged) to catch problems before CI does.
- **Production readiness of the framework.** The MSW mock is always on, the port is hard-coded to 3000, and there's no production or development switch. `__INITIAL_DATA__` is placed inside a single-quoted script string without escaping, so serialized data must be encoded safely or it could break the page or allow script injection.
- **Development workflow.** There's no watch mode or live reload; every change needs a full `npm start`.
- **Package metadata.** `package.json` still has the placeholder `name`, `"main": "index.js"` (which doesn't exist) and no `"private": true` flag to prevent accidental publishing.
