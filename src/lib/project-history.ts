import type { ProjectState } from "./types";

/** Bounded transaction history, independent of persistence and React. */
export function createProjectHistory(limit = 80) {
  let past: ProjectState[] = [];
  let future: ProjectState[] = [];
  return {
    push(state: ProjectState) {
      past = [...past.slice(-(limit - 1)), state];
      future = [];
    },
    clear() {
      past = [];
      future = [];
    },
    undo(state: ProjectState) {
      const previous = past.pop();
      if (previous) future = [state, ...future];
      return previous;
    },
    redo(state: ProjectState) {
      const next = future.shift();
      if (next) past = [...past.slice(-(limit - 1)), state];
      return next;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    retainedStates: () => [...past, ...future],
  };
}
