import {
  compileBlocks,
  compileQwen21Bundle,
  compileQwen21NegativePrompt,
  compileQwen21Prompt,
  compilerInputHash,
} from "@/lib/compiler";
import { demoProject, emptyProject, retag } from "@/lib/project-store";
import { OPERATIONS, type ProjectState, type QwenPromptFormat } from "@/lib/types";
import { beforeEach, describe, expect, it } from "vitest";

const formats: QwenPromptFormat[] = [
  "natural",
  "structured",
  "comfyui",
  "single_line",
  "technical",
];

function fixtures(): Record<string, ProjectState> {
  const demo = demoProject();
  demo.projectId = "fixture";
  demo.createdAt = demo.updatedAt = 0;
  demo.editSteps = demo.editSteps.map((step, i) => ({ ...step, id: `step${i}` }));
  const spatial: ProjectState = {
    ...demo,
    operation: "MOVE",
    promptLevel: "expert",
    targets: [
      {
        id: "target",
        imageId: "demo1",
        type: "box",
        label: "coat",
        bbox: { x: 0.2, y: 0.3, w: 0.25, h: 0.4 },
      },
    ],
    movements: [
      { id: "movement", targetId: "target", from: { x: 0.3, y: 0.5 }, to: { x: 0.8, y: 0.6 } },
    ],
    editSteps: [{ id: "move", operation: "MOVE", targetId: "target" }],
  };
  const reordered = { ...demo, images: retag([...demo.images].reverse()) };
  const locked = {
    ...demo,
    images: demo.images.map((image) => ({ ...image, locks: [...image.uses] })),
    blocks: demo.blocks.map((block, i) =>
      i === 0
        ? { ...block, text: "Manual instruction for <image1>.", locked: true, edited: true }
        : block,
    ),
  };
  const all: Record<string, ProjectState> = {
    empty: emptyProject(),
    demo,
    spatial,
    reordered,
    locked,
  };
  for (const operation of OPERATIONS)
    all[operation] = {
      ...spatial,
      operation,
      editSteps: [
        {
          id: "operation",
          operation,
          sourceImageId: "demo2",
          targetId: "target",
          textContent: "Studio",
          exactSpelling: true,
        },
      ],
    };
  return all;
}

describe("pre-rewrite compiler compatibility", () => {
  beforeEach(() => localStorage.clear());
  for (const format of formats) {
    it(`preserves exact ${format} outputs, negatives, bundles and hashes`, () => {
      const outputs = Object.fromEntries(
        Object.entries(fixtures()).map(([name, project]) => [
          name,
          {
            prompt: compileQwen21Prompt(project, format),
            negative: compileQwen21NegativePrompt(project),
            bundle: compileQwen21Bundle(project, format),
            blocks: compileBlocks(project),
            hash: compilerInputHash(project),
          },
        ]),
      );
      expect(outputs).toMatchSnapshot();
    });
  }
});
