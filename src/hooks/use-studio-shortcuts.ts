import { projectStore } from "@/lib/project-store";
import { doBuild, doSave } from "@/lib/studio-workflows";
import { useEffect } from "react";

export function useStudioShortcuts(copyPrompt: () => Promise<void>) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      const key = event.key.toLowerCase();
      const editing =
        event.target instanceof HTMLElement &&
        !!event.target.closest("input,textarea,[contenteditable='true']");
      if (key === "b") {
        event.preventDefault();
        doBuild();
      } else if (key === "s") {
        event.preventDefault();
        doSave();
      } else if (event.shiftKey && key === "c") {
        event.preventDefault();
        void copyPrompt();
      } else if (key === "z" && !editing) {
        event.preventDefault();
        if (event.shiftKey) projectStore.redo();
        else projectStore.undo();
      } else if (key === "y" && !editing) {
        event.preventDefault();
        projectStore.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [copyPrompt]);
}
