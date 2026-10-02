<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# Qwen Prompt Studio architecture manual

## Invariants

1. ProjectState in src/lib/types.ts owns structured project state. Compiler API src/lib/compiler.ts derives outputs deterministically; compiler version remains qwen-pc-2.1.
2. src/lib/validator.ts recomputes issues and diagnostic scores on every store transition. Components display these results rather than maintaining competing validation rules.
3. ROLE_POLICIES and OPERATION_POLICY in constants are canonical semantics. Do not duplicate them.
4. Per-image locks preserve source fidelity. Global matrix LOCK preserves attributes from the selected base canvas. Source locks never modify matrix locks.
5. src/lib/storage.ts persists metadata; src/lib/assets.ts stores original/preview blobs in IndexedDB. New project metadata references asset IDs. Legacy data URLs are import-only compatibility data and migrate before persistence.
6. Optional refinement goes through src/lib/refinement.ts. Relationship-bearing blocks remain verbatim and other blocks retain their ordered image tags. Reject asynchronous results when project inputs changed during refinement.
7. Keep Konva lazy-loaded, React and react-konva minor versions compatible, and typography bundled through @fontsource imports in styles.css.
8. No local Qwen model deployment is required or part of development. Use offline compilation, mock endpoints, or optional cloud providers.

## Application structure

The runtime is a browser-only React/Vite SPA with TanStack Router file-based routes. There is no server entry, Nitro runtime, or server function layer. index.html owns document markup; src/main.tsx migrates legacy storage and mounts the router. Route metadata is rendered through HeadContent.

The project-store module is a compatibility facade. Factories create projects; transitions validate and invalidate derived outputs; bounded history owns undo/redo; persistence owns metadata saves and migration; the core store publishes snapshots; the React adapter subscribes with useSyncExternalStore. Project commands use that transition pipeline.

The compiler facade exposes block, format, negative, bundle, hash, and statistics helpers implemented under src/lib/compiler/. The inspector comprises focused panels and a UI hook; build/save/copy/refinement/import/export/generation workflows reside in src/lib/studio-workflows.ts.

Preserve the existing compiler and store public exports. Copy-only text drafts remain transient UI state and do not become canonical compiler inputs. The logger keeps a 500-event in-memory ring buffer. Lovable reporting is an optional browser hook, not an installed telemetry transport.

## Verification

On Windows PowerShell use explicit Node paths:

```powershell
$env:PATH = "C:\Program Files\nodejs;$env:PATH"
& 'C:\Program Files\nodejs\npm.cmd' test -- --run
& 'C:\Program Files\nodejs\npm.cmd' run typecheck
& 'C:\Program Files\nodejs\npm.cmd' run lint
& 'C:\Program Files\nodejs\npm.cmd' run build
```

Compiler characterization snapshots encode pre-rewrite output; changing them requires an intentional output specification, not a refactor. Verify production-preview routing, desktop/mobile layout, storage reload, and the affected interactions after runtime or UI changes.

Production output is dist. Static hosting needs an application-route fallback to index.html. Lovable publishing remains unverified until checked in its hosting environment. Never force-push or rewrite published history.

See [the documentation index](docs/README.md) for implementation contracts and [the audit](docs/AUDIT.md) for remaining risks.
