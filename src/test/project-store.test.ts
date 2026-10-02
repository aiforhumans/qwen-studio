import { actions, demoProject, emptyProject, projectStore } from "@/lib/project-store";
import type { EditStep, Movement, RefImage, Target } from "@/lib/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("projectStore reactive state machine", () => {
  beforeEach(() => {
    localStorage.clear();
    projectStore.replace(emptyProject());
    projectStore.clearHistory();
  });

  it("initializes with a valid empty project", () => {
    const p = projectStore.get();
    expect(p).toBeDefined();
    expect(p.schemaVersion).toBe(2);
    expect(p.images).toHaveLength(0);
    expect(p.isPromptDirty).toBe(true);
  });

  it("subscribes to updates and receives notifications on state mutations", () => {
    const listener = vi.fn();
    const unsubscribe = projectStore.subscribe(listener);

    actions.setField("userInstruction", "Make the lighting dramatic golden hour.");
    expect(listener).toHaveBeenCalled();
    expect(projectStore.get().userInstruction).toBe("Make the lighting dramatic golden hour.");

    unsubscribe();
    listener.mockClear();
    actions.setField("userInstruction", "Another update");
    expect(listener).not.toHaveBeenCalled();
  });

  it("supports undo and redo transactions", () => {
    expect(projectStore.canUndo()).toBe(false);
    expect(projectStore.canRedo()).toBe(false);

    actions.setField("userInstruction", "Initial step");
    expect(projectStore.canUndo()).toBe(true);

    actions.setField("userInstruction", "Second step");
    expect(projectStore.get().userInstruction).toBe("Second step");

    projectStore.undo();
    expect(projectStore.get().userInstruction).toBe("Initial step");
    expect(projectStore.canRedo()).toBe(true);

    projectStore.redo();
    expect(projectStore.get().userInstruction).toBe("Second step");
  });

  it("caps undo history at 80 items without unbounded memory growth", () => {
    for (let i = 1; i <= 95; i++) {
      actions.setField("userInstruction", `Step ${i}`);
    }
    expect(projectStore.get().userInstruction).toBe("Step 95");

    let undoCount = 0;
    while (projectStore.canUndo()) {
      projectStore.undo();
      undoCount++;
    }
    // Capped at 80 history transactions
    expect(undoCount).toBe(80);
    expect(projectStore.canUndo()).toBe(false);
  });

  it("cascades image deletion across targets, movements, edit steps, and attribute matrix", () => {
    const dummyImageA: RefImage = {
      id: "img-a",
      tag: "<image1>",
      filename: "a.png",
      width: 512,
      height: 512,
      role: "Base Canvas",
      importance: "Critical",
      uses: [],
      excludes: [],
      locks: [],
    };
    const dummyImageB: RefImage = {
      id: "img-b",
      tag: "<image2>",
      filename: "b.png",
      width: 512,
      height: 512,
      role: "Wardrobe",
      importance: "High",
      uses: [],
      excludes: [],
      locks: [],
    };

    const targetB: Target = {
      id: "target-b",
      label: "Jacket",
      type: "box",
      imageId: "img-b",
      bbox: { x: 0.1, y: 0.1, w: 0.4, h: 0.4 },
    };

    const movementB: Movement = {
      id: "mv-b",
      targetId: "target-b",
      from: { x: 0.1, y: 0.1 },
      to: { x: 0.5, y: 0.5 },
    };

    const stepB: EditStep = {
      id: "step-b",
      operation: "MOVE",
      sourceImageId: "img-b",
      targetId: "target-b",
    };

    projectStore.update((p) => ({
      ...p,
      images: [dummyImageA, dummyImageB],
      selectedBaseImageId: "img-b",
      targets: [targetB],
      movements: [movementB],
      editSteps: [stepB],
      attributeMatrix: {
        ...p.attributeMatrix,
        clothing: { state: "REPLACE", sourceImageId: "img-b" },
      },
    }));

    const before = projectStore.get();
    expect(before.images).toHaveLength(2);
    expect(before.targets).toHaveLength(1);
    expect(before.movements).toHaveLength(1);
    expect(before.editSteps).toHaveLength(1);
    expect(before.attributeMatrix.clothing.state).toBe("REPLACE");
    expect(before.selectedBaseImageId).toBe("img-b");

    // Remove image B
    actions.removeImage("img-b");

    const after = projectStore.get();
    expect(after.images).toHaveLength(1);
    expect(after.images[0]?.id).toBe("img-a");
    expect(after.images[0]?.tag).toBe("<image1>"); // Re-tagged

    // Cascaded deletions
    expect(after.targets).toHaveLength(0);
    expect(after.movements).toHaveLength(0);
    expect(after.selectedBaseImageId).toBeUndefined();
    expect(after.attributeMatrix.clothing.state).toBe("FREE");
    expect(after.editSteps[0]?.sourceImageId).toBeUndefined();
    expect(after.editSteps[0]?.targetId).toBeUndefined();
  });

  it("invalidates refinedPrompt on structural state mutation", () => {
    const demo = demoProject();
    projectStore.replace({
      ...demo,
      refinedPrompt: "Artfully styled subject with custom AI refined phrasing.",
    });

    expect(projectStore.get().refinedPrompt).toBeDefined();

    // Mutating a compiler-relevant property
    actions.setField("userInstruction", "Add subtle rain reflection on the pavement.");

    const updated = projectStore.get();
    expect(updated.refinedPrompt).toBeUndefined();
    expect(updated.isPromptDirty).toBe(true);
  });
});
