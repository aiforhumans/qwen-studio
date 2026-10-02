import { EditSteps } from "@/components/studio/EditBuilder";
import { compileQwen21Prompt } from "@/lib/compiler";
import { loadInitial, persistProject } from "@/lib/project-persistence";
import { actions, demoProject, projectStore } from "@/lib/project-store";
import { parseProjectImport } from "@/lib/schema";
import type { QwenPromptFormat } from "@/lib/types";
import { validate } from "@/lib/validator";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";

beforeEach(() => {
  localStorage.clear();
  const p = demoProject();
  p.editSteps = [{ id: "canvas-edit", operation: "REPLACE", sourceImageId: p.images[1]!.id }];
  projectStore.replace(p);
  projectStore.clearHistory();
});
afterEach(cleanup);

it("selects the canvas, persists it, and can return to a drawn target or no target", () => {
  render(<EditSteps />);
  const select = screen.getByRole("combobox", { name: "Canvas target" });
  fireEvent.change(select, { target: { value: "__canvas__" } });
  expect(projectStore.get().editSteps[0]?.targetScope).toBe("canvas");
  expect(projectStore.get().issues.some((issue) => issue.id === "st-canvas-edit")).toBe(false);
  persistProject(projectStore.get(), true);
  expect(loadInitial().editSteps[0]?.targetScope).toBe("canvas");
  act(() => projectStore.undo());
  expect(projectStore.get().editSteps[0]?.targetScope).toBeUndefined();
  act(() => projectStore.redo());
  expect(projectStore.get().editSteps[0]?.targetScope).toBe("canvas");
  act(() =>
    actions.setField("targets", [
      {
        id: "region",
        label: "Mug",
        type: "point",
        imageId: projectStore.get().selectedBaseImageId!,
        point: { x: 0.5, y: 0.5 },
      },
    ]),
  );
  fireEvent.change(select, { target: { value: "region" } });
  expect(projectStore.get().editSteps[0]).toMatchObject({
    targetId: "region",
    targetScope: undefined,
  });
  fireEvent.change(select, { target: { value: "" } });
  expect(projectStore.get().editSteps[0]?.targetId).toBeUndefined();
});

const formats: QwenPromptFormat[] = [
  "natural",
  "structured",
  "comfyui",
  "single_line",
  "technical",
];
it.each(formats)("compiles an explicit base canvas target in %s", (format) => {
  actions.updateStep("canvas-edit", { targetScope: "canvas" });
  actions.build();
  const p = projectStore.get();
  const base = p.images.find((image) => image.id === p.selectedBaseImageId)!;
  expect(compileQwen21Prompt(p, format)).toContain(`the entire canvas of ${base.tag}`);
  expect(validate(p).some((issue) => issue.id === "st-canvas-edit")).toBe(false);
  const imported = parseProjectImport(JSON.parse(JSON.stringify(p)), demoProject(), true);
  expect(imported.editSteps[0]?.targetScope).toBe("canvas");
});
