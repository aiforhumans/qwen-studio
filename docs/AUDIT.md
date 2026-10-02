# Verified rewrite audit

Date: 2026-10-03 (Europe/Amsterdam).

## Baseline and method

At the start of the rewrite, the workspace contained no Git metadata. A source/configuration/documentation archive was created before edits and stored outside the workspace. Desktop and mobile baseline screenshots were also captured outside the repository.

The baseline passed 54 tests and TypeScript checking. Lint had one formatting error and eight warnings. Earlier audit documents were treated as unverified claims; this report replaces their overlapping findings, health, risk, cleanup, and roadmap content.

Inspection covered entry points, routes, compiler, store, validator, canonical policies, schema, storage/assets, providers, refinement, logging, configuration, dependency declarations, tests, and documentation. Import/export and dynamic-import references were traced from main.tsx and test entry points before removing unused UI components.

## Architecture and improvements

- Replaced Start/Nitro with React/Vite static runtime while retaining file-based TanStack Router URLs and route metadata.
- Constrained React, React DOM, and their types to the 19.2 minor to match react-konva. Installed runtime versions are React/React DOM 19.2.8 and react-konva 19.2.7.
- Split the compiler into responsibility-specific implementations behind its original public API. Pre-rewrite snapshots cover all operations and five formats, including negatives, bundles, hashes, source locks, reordered images, and spatial edits.
- Split factories, state transitions, history, persistence, core store, commands, and React subscriptions. Preserve canonical state and validation ownership.
- Decomposed the 1,074-line inspector into focused panels and a presentation hook. Shared services now own build/save/copy/import/export/refinement/generation.
- Added transaction-completion handling so asset writes are not accepted before commit; failed writes do not enter the memory cache.
- Added legacy pixel migration and metadata guards, retained prompt-format selection on reload, and prevented stale asynchronous refinement from replacing current output.
- Fixed deletion of image assets still referenced by Undo. Assets remain until recoverable states no longer reference them.
- Consolidated docs and architecture decisions; removed unsupported zero-telemetry, fixed storage-key, server-runtime, and model-quality claims.

Runtime flow: bootstrap migration → router → UI commands → store analysis/history/persistence → subscribed UI and deterministic compilation. Optional refinement/generation goes through provider adapters; mandatory local inference is absent.

## Cleanup decisions

| Candidate                                                                                                    | Classification                     | Result and evidence                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Start/Nitro wrapper, server entry, server middleware, server error helpers                                   | SAFE TO REMOVE                     | Replaced by SPA entry and tested browser error boundaries; no remaining runtime callers                         |
| React Query provider/client and dependency                                                                   | SAFE TO REMOVE                     | No query or mutation users were found; removed root/router scaffolding                                          |
| Unused dialog, sheet, input, label, separator, skeleton, toggle, tooltip wrappers                            | SAFE TO REMOVE                     | Unreachable from application/tests, no runtime discovery; removed wrappers and unused direct Radix dependencies |
| Bun lock and configuration                                                                                   | SAFE TO REMOVE                     | Standardized scripts/docs on npm and package-lock.json                                                          |
| Overlapping audit, data-flow, setup, API, health, risk and roadmap documents; PROJECT/IMPLEMENTATION reports | SAFE TO REMOVE after consolidation | Replaced by canonical pages and this dated audit; originals in baseline archive                                 |
| Existing compiler/store public APIs, schema/storage versions and keys                                        | KEEP                               | Compatibility and saved-data requirements                                                                       |
| Canonical policies, refinement guards, bundled fonts, lazy canvas                                            | KEEP                               | Architecture invariants and tested behavior                                                                     |
| Provider adapters and optional Lovable browser hooks                                                         | KEEP                               | Existing functionality; no local model dependency                                                               |
| Public assets, local .wrangler state, historical ignored build output                                        | REQUIRES REVIEW                    | Not deleted based on names alone; external/local runtime usage not established                                  |
| Further schema changes, performance optimizations and hosting migration                                      | REQUIRES REVIEW                    | No new format or measured bottleneck requires them; hosting is outside delivery                                 |

## Remaining risks

| Severity | Risk                                                                           | Practical limit                                                                                                        |
| -------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| High     | Lovable publishing may depend on its former wrapper/runtime                    | SPA builds locally; actual publishing compatibility remains unverified. No deployment performed                        |
| High     | Storage origin changes isolate existing browser data                           | Export/import a backup including image assets before changing origin                                                   |
| Medium   | Multi-key backup writes and asset imports are not atomic across browser stores | Validation precedes mutation, but write failure can leave partial import                                               |
| Medium   | Provider keys are persisted in browser metadata                                | Keys excluded from backups by default; browser CORS and provider access remain required                                |
| Medium   | Low-level asset memory fallback without IndexedDB is temporary                 | Legacy migration retains original metadata rather than converting to transient references                              |
| Low      | Assets from evicted undo snapshots can remain unreferenced                     | Conservative retention avoids data loss; a separately specified garbage-collection policy can address residual storage |
| Low      | Browser-only rendering changes initial HTML and HTTP 404 semantics             | Host serves the SPA shell; client route metadata and missing-page handling are verified                                |

No critical findings were established. Live model output quality, provider availability, and hosted Lovable publishing were not tested.

## Verification

Final checks: npm test -- --run passed **87 tests in 11 files**, including all unchanged pre-rewrite characterization snapshots. TypeScript passed with unused-local and unused-parameter checks enabled. ESLint passed with zero warnings. The Vite production build passed, producing static dist output with lazy route/canvas chunks and the hosting fallback file. npm ls confirms installed dependencies and the matching React/react-konva minor versions. npm installation audit reported zero vulnerabilities; this is an inventory result, not a security proof.

Production-preview browser checks used http://127.0.0.1:4173 at 1440×1000 and 390×844. All seven routes and the missing-page route passed direct navigation and refresh, with correct visible content and no framework overlay. Tests exercised formats, clipboard positive/negative/bundle copying, copy/build/save shortcuts, saved-version restore, templates, ratings and A/B preferences, theme, three image uploads, role selection, point/box/movement canvas edits, deletion/Undo with pixels restored, reload persistence, standalone project export/import, full backup export/import including pixels, mocked connection/analysis/refinement success/reset/failure, and mocked Qwen generation with three ordered inputs and a rendered result.

Console health: zero unexpected warnings/errors. One HTTP 500 was intentionally injected to verify provider error feedback. Compiler strings remain unchanged; Windows clipboard round-trip assertions normalize the operating system's CRLF conversion.

Baseline and rewritten layouts were captured with the same demo state on desktop/mobile; mobile prompt navigation was also captured. Original navigation/layout classes were retained. Browser automation uses bundled Playwright because the Browser plugin is not available. Temporary scripts, JSON results, and screenshots are stored outside the repository.

## Initial repository preparation — 2026-10-03

After the initial push, the owner requested that .agents remain local. A follow-up commit removes that directory from tracking and ignores it while preserving the local files. Root AGENT.md and AGENTS.md remain shared guidance. Earlier published commits retain the directory; history is not rewritten.

Initialized a new local main branch and configured the empty aiforhumans/qwen-studio remote. Retained source, documentation, compiler snapshots, the npm lockfile, generated route declarations, and agent guidance. Excluded installed dependencies, build output, caches, environment credentials, test reports, and local backups. Added LF normalization, editor configuration, and a GitHub Actions verification workflow with pinned action revisions and read-only permissions. No license was inferred or added.

Exported the staged files into a separate clean directory. npm ci, production build, typecheck, lint with zero warnings, and **93 tests in 12 files** passed there. The six additional tests cover the Canvas target option, persistence/import, undo/redo, and all five prompt formats. Earlier compiler characterization snapshots remain unchanged. Staged-file checks found no credential files, dependency/build/cache directories, or individual files over 5 MB. A credential-pattern scan found no credentials; this is a limited check, not a complete security audit.

The Canvas target feature also passed production-preview selection, compiled output, reload, and desktop/mobile checks without browser exceptions. GitHub-hosted CI and Lovable publishing remain unverified until run in those environments. Preparing this repository does not transfer existing browser data or connect the new remote to Lovable automatically.

Maintained local Markdown links were checked after consolidation with zero broken links. The recoverable baseline archive contains 134 entries. No deployment or Git operation was performed.
