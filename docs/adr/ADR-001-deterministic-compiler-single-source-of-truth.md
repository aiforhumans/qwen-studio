# ADR-001: Deterministic compiler and authoritative project state

Status: retained, updated for the SPA rewrite.

ProjectState owns structured input; compiler.ts is its stable output API. Implementation modules separate context, blocks, hashing, formats, negatives, bundles, and statistics without changing compiler version or output wording.

Transitions invalidate stale derived output and recompute validator diagnostics. Technical block locks remain supported, and copy-only drafts stay transient. Optional refinement protects relationship-bearing blocks and ordered image references, including a check against asynchronous project changes.

Evidence: [types](../../src/lib/types.ts), [compiler facade](../../src/lib/compiler.ts), [transitions](../../src/lib/project-transitions.ts), and pre-rewrite characterization snapshots under src/test/**snapshots**.

Consequence: internal restructuring must preserve exact compiler output unless a separately specified behavior change is intentional.
