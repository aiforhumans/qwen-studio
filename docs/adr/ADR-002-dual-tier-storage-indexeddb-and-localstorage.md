# ADR-002: Metadata and binary asset separation

Status: retained, updated for compatibility and transaction handling.

Store project/history/settings/provider/learning metadata in localStorage and image blobs in IndexedDB. ProjectState references asset IDs. Quotas still apply to metadata and histories; this split reduces pixel-related storage pressure rather than eliminating quota failures.

Legacy embedded pixels migrate to the asset layer before metadata persistence. Asset writes resolve after transaction completion. Failed migration retains original stored metadata. Undo/redo references prevent premature pixel deletion.

Evidence: [storage](../../src/lib/storage.ts), [assets](../../src/lib/assets.ts), [project persistence](../../src/lib/project-persistence.ts), and persistence regression tests.

Consequence: asset access is asynchronous, backups must include images to be portable, and imports across localStorage and IndexedDB are not one atomic transaction.
