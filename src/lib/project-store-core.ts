import { deleteImageAsset } from "./assets";
import { logger } from "./logger";
import { emptyProject } from "./project-factories";
import { createProjectHistory } from "./project-history";
import { loadInitial, persistProject } from "./project-persistence";
import { analyze, applyUpdate } from "./project-transitions";
import { parseProjectImport } from "./schema";
import { getAllReferencedAssetIds, getSettings } from "./storage";
import type { ProjectState } from "./types";
import { PROJECT_SCHEMA_VERSION } from "./types";
let state: ProjectState | null = null;
const history = createProjectHistory();
const listeners = new Set<() => void>();

function get(): ProjectState {
  if (!state) state = loadInitial();
  return state;
}
function emit() {
  listeners.forEach((l) => l());
}
function persist() {
  persistProject(get());
}

export const projectStore = {
  get,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  update(fn: (p: ProjectState) => ProjectState, opts: { history?: boolean } = {}) {
    const prev = get();
    const next = applyUpdate(prev, fn(prev));
    if (opts.history !== false) history.push(prev);
    state = next;
    persist();
    emit();
  },
  replace(p: ProjectState) {
    history.push(get());
    // Keep the imported compilerVersion until the next build so analyze() can
    // correctly mark older compiled prompts dirty.
    state = analyze({ ...p, schemaVersion: PROJECT_SCHEMA_VERSION });
    persist();
    emit();
  },
  clearHistory() {
    const candidates = this.retainedAssetIds();
    history.clear();
    const referenced = getAllReferencedAssetIds(get());
    for (const id of candidates)
      if (!referenced.has(id)) {
        void deleteImageAsset(id).catch((error) =>
          logger.warn("assets", "Could not delete released undo asset", String(error)),
        );
      }
  },
  retainedAssetIds(): Set<string> {
    return new Set(
      history
        .retainedStates()
        .flatMap((project) =>
          project.images.flatMap((image) => (image.assetId ? [image.assetId] : [])),
        ),
    );
  },
  importUnknown(raw: unknown) {
    this.replace(parseProjectImport(raw, emptyProject(), getSettings().baseRules));
  },
  undo() {
    const prev = history.undo(get());
    if (!prev) return;
    state = analyze(prev);
    persist();
    emit();
  },
  redo() {
    const next = history.redo(get());
    if (!next) return;
    state = analyze(next);
    persist();
    emit();
  },
  canUndo: history.canUndo,
  canRedo: history.canRedo,
  saveNow() {
    persistProject(get(), true);
  },
};
