# Documentation

Each maintained page has one primary responsibility. Historical audit reports were consolidated; their original contents remain in the pre-rewrite archive.

| Page                                           | Responsibility                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| [Architecture](ARCHITECTURE.md)                | State ownership, module boundaries, runtime flow, extension points |
| [Development](DEVELOPMENT.md)                  | Setup, commands, tests, troubleshooting, static hosting            |
| [Storage](STORAGE.md)                          | Project compatibility, storage keys, assets, backup contracts      |
| [Providers](PROVIDERS.md)                      | Optional integration contracts, configuration, errors, logging     |
| [Prompting guide](QWEN_2.1_PROMPTING_GUIDE.md) | Reference roles, locks, formats, and copying                       |
| [Audit](AUDIT.md)                              | Verified findings, cleanup decisions, limitations and risks        |

Architecture decisions: [deterministic compiler](adr/ADR-001-deterministic-compiler-single-source-of-truth.md), [dual storage](adr/ADR-002-dual-tier-storage-indexeddb-and-localstorage.md), [lazy canvas](adr/ADR-003-client-only-konva-canvas-isolation.md), [SPA migration](adr/ADR-004-vite-spa.md).

[AGENT.md](../AGENT.md) is the authoritative engineering manual. [README.md](../README.md) is the quickstart.
