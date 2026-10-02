# Storage and contracts

## Project contract

ProjectState remains schema version 2. Public store and compiler entry points are preserved through facade modules. The compiler version remains qwen-pc-2.1. Role and operation policies remain canonical in constants.ts.

schema.ts parses imported projects, migrates legacy attribute names, retags ordered references, clamps geometry, and drops broken graph edges. Old compiler versions remain old until the next build, allowing dirty-state detection. Valid promptFormat metadata now survives reload/import.

## Metadata and pixels

| Key          | Data                                                |
| ------------ | --------------------------------------------------- |
| qps.project  | Active ProjectState metadata                        |
| qps.history  | Saved prompt versions and project snapshots         |
| qps.learning | Result ratings and asset references                 |
| qps.prefs    | Wording preference events                           |
| qps.settings | Theme, density, autosave, default level, base rules |
| qps.models   | Provider settings, including any saved API keys     |
| qps.seeded   | Initial demonstration marker                        |

IndexedDB database qwen-prompt-studio-assets, version 1, contains an assets store keyed by id. Each record contains filename, MIME type, dimensions, original blob, preview blob, and creation time. Upload previews have a maximum dimension of 1024 and use WebP. Legacy migration uses the original pixels as the preview to avoid changing image content.

Asset writes resolve after transaction completion; failed writes never enter the memory cache. Without IndexedDB, low-level asset helpers have a session-memory fallback. Such assets do not survive reload. Legacy migration requires IndexedDB and retains original metadata when it is unavailable.

## Save and migration flow

Bootstrap migrates data URLs in the active project and historical snapshots before the store loads them. Each image's pixels are stored before its metadata representation is removed. An unsuccessful migration leaves the original saved metadata for that record intact. Metadata persistence refuses unmigrated legacy images, and version saving rejects legacy pixels without an asset ID.

Autosave applies to store transitions; saveNow explicitly saves regardless of that setting. Storage write failure leaves the in-memory state editable and shows an error. Browser quota remains relevant to large histories even with pixel separation.

Undo/redo retains up to 80 project snapshots. Image removal retains pixels referenced by undo/redo, active state, saved history, or learning. Clearing undo history releases its otherwise-unreferenced assets. Assets from evicted snapshots may remain until a later explicit cleanup; deletion must never sacrifice recoverable user data.

## Export and import

Project export uses format qps-project, version 1, with project metadata and an assets map. Asset entries contain originalDataUrl and optional previewDataUrl specifically for transport; these are not new embedded image fields in persisted ProjectState.

Settings backup uses format qps-backup, version 2, containing data keyed by metadata storage keys and an optional assets map. Unwrapped historical metadata backups remain accepted. Keys are excluded by default and can be included explicitly. Metadata-only backups cannot reconstruct missing image pixels.

Backup metadata is validated before storage mutation. Multi-key writes and asset imports are not one cross-store atomic transaction; a browser quota/write failure can leave a partial import. Export a recoverable backup before replacing data. Startup performs legacy migration after backup reload.

Importing a standalone project validates its envelope, imports embedded assets, parses the state, migrates legacy pixels, then replaces the active state. History restore reports missing assets while restoring the structured state.
