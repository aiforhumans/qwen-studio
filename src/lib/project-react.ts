import { useSyncExternalStore } from "react";
import { projectStore } from "./project-store-core";
export function useProject() {
  return useSyncExternalStore(projectStore.subscribe, projectStore.get);
}
