# Development and testing

## Setup and configuration

Use npm with package-lock.json. Node requirements come from the installed Vite engine constraint: ^20.19.0 or >=22.12.0. Run npm ci, then npm run dev. The configured host is 127.0.0.1 and default port is 8080; Vite prints another port if occupied.

Vite explicitly configures TanStack Router generation/splitting, React, Tailwind, the @ source alias, and React deduplication. TypeScript uses strict checking. Vitest uses jsdom and the same source alias; fake-indexeddb tests storage transactions. Fonts load from bundled @fontsource packages.

## Required checks

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Lint fails on warnings. npm run format formats source, docs and root configuration; generated route output and package-lock.json are excluded by Prettier configuration.

Compiler characterization fixtures cover empty/demo projects, reordered references, source locks, spatial edits and every operation across all five formats. They freeze exact prompt, negative, bundle, block and hash outputs from before the rewrite. Do not regenerate these snapshots to make an internal rewrite pass.

Other tests cover validation, store subscriptions and undo/redo, refinement tag protection, stale asynchronous results, provider failures/timeouts, asset retention, legacy migration, metadata/asset backup round trips, storage failures, every route's meaningful content, and error-boundary retry/reporting.

## Browser verification

Use production preview to check each route directly and after refresh. Verify titles, nonblank content, missing-route recovery, console errors, layout at 1440×1000 and 390×844, and affected controls. Exercise image upload/canvas edits, format switching/copying, build/save shortcuts, history restore, templates, learning, settings, and mocked provider calls. Browser evidence and temporary automation scripts belong outside source.

## First push to a new repository

See the [Git submission guide](GIT_SUBMISSION.md) for identity setup, staging, required checks, branch submissions, direct pushes, and recovery.

Keep source, tests (including compiler snapshots), public assets, documentation, agent guidance, package-lock.json, and configuration in Git. Keep generated routeTree.gen.ts tracked so typechecking and tests work before running Vite; route generation updates it during builds. Build output, installed dependencies, caches, browser data exports, and credentials must stay out of Git. Environment files are ignored; there are no required environment variables for offline compilation.

The GitHub Actions workflow installs from the lockfile and runs build, typecheck, lint, and tests on pushes and pull requests. Browser smoke checks remain a separate local verification step. The repository uses LF line endings through .gitattributes and .editorconfig.

For an initialized repository with the first commit on main, connect an empty remote and push:

```sh
git remote add origin <new-repository-url>
git push -u origin main
```

Create the remote without an initial README, license, or .gitignore to avoid competing root commits. If the remote already contains history, inspect and integrate it before pushing. Never force-push a connected Lovable branch. Repository visibility and a distribution license are owner decisions; this project does not currently include a license grant. The package is marked private to prevent accidental npm publication.

## Static hosting

Publish the contents of dist over HTTP(S). Serve existing assets first and fall back to index.html for application paths. public/_redirects is copied into dist for compatible hosts; configure equivalent rewrites elsewhere. A missing application route renders the client 404 screen, usually after the host served index.html with HTTP 200.

There is no Nitro worker or SSR output. Lovable publishing compatibility is unverified; local build and preview cannot establish that its publishing pipeline accepts this SPA. No hosting credentials or deployment are required for local development.

Browser storage is scoped to the full origin (scheme, hostname, and port). Changing origins requires an exported backup with image assets. The rewrite does not add service-worker caching, so an offline compiler does not guarantee cold page loads without a network connection.

## Troubleshooting

| Symptom                     | Check                                                                          |
| --------------------------- | ------------------------------------------------------------------------------ |
| Direct route fails on host  | Configure the SPA fallback and serve dist as the site root                     |
| Route missing after editing | Restart Vite/build to regenerate routeTree.gen.ts                              |
| Saved image missing         | Same browser origin, IndexedDB availability, and backup asset inclusion        |
| Storage warning             | Export data; check browser storage restrictions and quota                      |
| Provider network error      | Endpoint, browser CORS, credentials, model selection, and timeout              |
| Canvas fails                | React/react-konva minor versions, image dimensions, and browser canvas support |
| Fonts fail in tests         | Retain bundled imports; do not add remote font stylesheets                     |
