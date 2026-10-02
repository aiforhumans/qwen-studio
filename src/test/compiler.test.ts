import {
  compileBlocks,
  compileQwen21Bundle,
  compileQwen21NegativePrompt,
  compileQwen21Prompt,
  compilerInputHash,
  finalPrompt,
  qwenTokenStats,
  sourceExclusions,
} from "@/lib/compiler";
import { defaultMatrix, ROLE_POLICIES, TEMPLATES } from "@/lib/constants";
import { actions, demoProject, emptyProject, projectStore } from "@/lib/project-store";
import { refineBlocksSafely } from "@/lib/refinement";
import { parseProjectImport } from "@/lib/schema";
import { db, deleteVersion, getHistory, KEYS, saveVersion } from "@/lib/storage";
import type { ProjectState } from "@/lib/types";
import { validate } from "@/lib/validator";
import { beforeEach, describe, expect, it } from "vitest";

beforeEach(() => {
  localStorage.clear();
});

function baseProject(): ProjectState {
  const p = emptyProject();
  p.images = [
    {
      id: "a",
      tag: "<image1>",
      filename: "base.png",
      width: 1000,
      height: 1000,
      role: "Base Canvas",
      importance: "Critical",
      uses: [],
      excludes: [],
      locks: [],
    },
    {
      id: "b",
      tag: "<image2>",
      filename: "object.png",
      width: 1000,
      height: 1000,
      role: "Object",
      importance: "High",
      uses: ["objects"],
      excludes: [],
      locks: [],
    },
  ];
  p.selectedBaseImageId = "a";
  p.promptLevel = "expert";
  p.targets = [
    { id: "t", label: "the red mug", type: "point", imageId: "a", point: { x: 0.2, y: 0.8 } },
  ];
  return p;
}

describe("compiler — core relationship model", () => {
  it("keeps ten deterministic blocks in canonical order", () => {
    const p = demoProject();
    expect(compileBlocks(p).map((b) => b.id)).toEqual([
      "operation",
      "canvas",
      "roles",
      "targets",
      "spatial",
      "transfer",
      "preservation",
      "integration",
      "reconstruction",
      "consistency",
    ]);
  });

  it("demo transfers wardrobe and identity while preserving base structure", () => {
    const p = demoProject();
    const out = finalPrompt(compileBlocks(p));
    expect(out).toContain("Use <image1> as the base canvas.");
    expect(out).toMatch(
      /complete wardrobe from <image2>.*garment design, colors, materials, fit, shoes and accessories/,
    );
    expect(out).toContain("facial identity from <image3>");
    expect(out).toContain("body shape");
    expect(out).toContain("body proportions");
    expect(out).toContain("body position and limb placement");
    expect(validate(p).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("user-edited exclusions are authoritative instead of being re-added by role presets", () => {
    const p = demoProject();
    const wardrobe = p.images.find((i) => i.role === "Wardrobe")!;
    expect(sourceExclusions(p, wardrobe.id)).toContain("body_shape");
    wardrobe.excludes = wardrobe.excludes.filter((a) => a !== "body_shape");
    expect(sourceExclusions(p, wardrobe.id)).not.toContain("body_shape");
  });

  it("uses image importance in reference guidance", () => {
    const p = demoProject();
    p.images[1]!.importance = "Critical";
    const roles = compileBlocks(p).find((b) => b.id === "roles")!.text;
    expect(roles).toContain("Reference priority: critical.");
  });

  it("keeps a locked manually edited block during rebuild", () => {
    const p = demoProject();
    p.blocks = p.blocks.map((b) =>
      b.id === "canvas" ? { ...b, text: "MY TEXT", locked: true, edited: true } : b,
    );
    const rebuilt = compileBlocks({ ...p, promptLevel: "expert" });
    expect(rebuilt.find((b) => b.id === "canvas")!.text).toBe("MY TEXT");
  });

  it("treats per-image exact locks as source-fidelity rules without mutating base preservation", () => {
    const p = demoProject();
    projectStore.replace(p);
    const wardrobe = projectStore.get().images.find((i) => i.role === "Wardrobe")!;
    const before = projectStore.get().attributeMatrix.clothing;
    actions.setImageLocks(wardrobe.id, ["clothing"]);
    const q = projectStore.get();
    expect(q.attributeMatrix.clothing).toEqual(before);
    const roles = compileBlocks(q).find((b) => b.id === "roles")!.text;
    expect(roles).toContain("Source-fidelity lock");
    expect(roles).toContain("preserve clothing exactly from <image2>");
  });

  it("warns when a reference exact lock has no active source assignment and rejects lock/exclude conflicts", () => {
    const p = baseProject();
    p.images[1]!.uses = [];
    p.images[1]!.locks = ["texture"];
    let issues = validate(p);
    expect(
      issues.some((i) => i.id === "imglock-unused-b-texture" && i.severity === "warning"),
    ).toBe(true);
    p.images[1]!.excludes = ["texture"];
    issues = validate(p);
    expect(issues.some((i) => i.id === "lock-exclude-b-texture" && i.severity === "error")).toBe(
      true,
    );
  });
});

describe("pose/body ontology", () => {
  it("pose policy transfers pose + body position, never body appearance", () => {
    expect(ROLE_POLICIES.Pose.defaultTransfers).toEqual(["pose", "body_position"]);
    expect(ROLE_POLICIES.Pose.defaultExclusions).toEqual(
      expect.arrayContaining(["body_shape", "body_proportions"]),
    );
  });

  it("built-in Pose Transfer is internally valid", () => {
    const p = baseProject();
    p.images[1] = {
      ...p.images[1]!,
      role: "Pose",
      uses: [...ROLE_POLICIES.Pose.defaultTransfers],
      excludes: [...ROLE_POLICIES.Pose.defaultExclusions],
    };
    const t = TEMPLATES.find((x) => x.id === "pose")!;
    p.attributeMatrix = defaultMatrix(false);
    for (const [a, st] of Object.entries(t.matrix))
      p.attributeMatrix[a as keyof typeof p.attributeMatrix] = {
        state: st!,
        sourceImageId: st === "REPLACE" ? "b" : undefined,
      };
    p.editSteps = [{ id: "pose", operation: "POSE", sourceImageId: "b" }];
    const errors = validate(p).filter((i) => i.severity === "error");
    expect(errors).toEqual([]);
    const out = finalPrompt(compileBlocks(p));
    expect(out).toContain("pose and body position");
    expect(out).toContain("preserving body shape and body proportions");
  });

  it("migrates legacy body REPLACE to body_position and locks appearance", () => {
    const d = demoProject();
    const legacy = {
      ...d,
      schemaVersion: 1,
      attributeMatrix: {
        ...d.attributeMatrix,
        body: { state: "REPLACE", sourceImageId: "demo2" },
      },
      editSteps: [{ id: "p", operation: "POSE", sourceImageId: "demo2", sourceAttribute: "body" }],
    };
    const m = parseProjectImport(legacy, emptyProject(), true);
    expect(m.attributeMatrix.body_position).toEqual({ state: "REPLACE", sourceImageId: "demo2" });
    expect(m.attributeMatrix.body_shape.state).toBe("LOCK");
    expect(m.attributeMatrix.body_proportions.state).toBe("LOCK");
    expect(m.editSteps[0]?.sourceAttribute).toBe("body_position");
  });
});

describe("operation-specific compiler behavior", () => {
  it("MOVE produces destination and vacated-region reconstruction", () => {
    const p = baseProject();
    p.movements = [{ id: "m", targetId: "t", from: { x: 0.2, y: 0.8 }, to: { x: 0.8, y: 0.2 } }];
    p.editSteps = [{ id: "s", operation: "MOVE", targetId: "t" }];
    const out = finalPrompt(compileBlocks(p));
    expect(out).toContain("lower-left area");
    expect(out).toContain("upper-right area");
    expect(out).toContain("Reconstruct only the area newly exposed by move");
    expect(validate(p).filter((i) => i.severity === "error")).toEqual([]);
  });

  it("MOVE without destination is an error", () => {
    const p = baseProject();
    p.editSteps = [{ id: "s", operation: "MOVE", targetId: "t" }];
    expect(validate(p).some((i) => i.id === "dest-s" && i.severity === "error")).toBe(true);
  });

  it("REMOVE reconstructs without generic replacement wording", () => {
    const p = baseProject();
    p.editSteps = [{ id: "s", operation: "REMOVE", targetId: "t" }];
    const out = finalPrompt(compileBlocks(p));
    expect(out).toContain("Remove the red mug completely");
    expect(out).toContain("Reconstruct only the area newly exposed by remove");
    expect(out).not.toContain("Integrate requested replacements");
  });

  it("RESIZE reconstructs only when shrinking", () => {
    const p = baseProject();
    p.editSteps = [{ id: "s", operation: "RESIZE", targetId: "t", scale: "1.5x larger" }];
    let reconstruction = compileBlocks(p).find((b) => b.id === "reconstruction")!.text;
    expect(reconstruction).toBe("");
    p.editSteps[0]!.scale = "0.5x smaller";
    reconstruction = compileBlocks(p).find((b) => b.id === "reconstruction")!.text;
    expect(reconstruction).toContain("newly exposed by resize");
  });

  it("missing sources never compile literal undefined", () => {
    const p = baseProject();
    p.editSteps = [{ id: "s", operation: "WARDROBE" }];
    expect(finalPrompt(compileBlocks(p))).not.toContain("undefined");
    expect(validate(p).some((i) => i.id === "ss-s")).toBe(true);
  });

  it("Prompt Lab wording variants affect non-wardrobe operations", () => {
    const p = baseProject();
    p.movements = [{ id: "m", targetId: "t", from: { x: 0.2, y: 0.8 }, to: { x: 0.8, y: 0.2 } }];
    p.editSteps = [{ id: "s", operation: "MOVE", targetId: "t" }];
    p.metadata.wordingVariant = "Replace";
    const a = compileBlocks(p).find((b) => b.id === "targets")!.text;
    p.metadata.wordingVariant = "Transfer";
    const b = compileBlocks(p).find((b) => b.id === "targets")!.text;
    expect(a).not.toBe(b);
    expect(b).toContain("Relocate");
  });
});

describe("state synchronization and graph integrity", () => {
  it("marks compiled output dirty after a structured edit and ensureBuilt synchronizes it", () => {
    const p = demoProject();
    projectStore.replace(p);
    expect(projectStore.get().isPromptDirty).toBe(false);
    actions.setField("userInstruction", "Make the final composition editorial");
    expect(projectStore.get().isPromptDirty).toBe(true);
    const built = actions.ensureBuilt();
    expect(built.isPromptDirty).toBe(false);
    expect(built.lastCompiledHash).toBe(compilerInputHash(built));
    expect(finalPrompt(built.blocks)).toContain("editorial");
  });

  it("invalidates AI-refined output on structural or manual block changes", () => {
    const p = demoProject();
    p.refinedPrompt = "refined";
    projectStore.replace(p);
    projectStore.update((s) => ({ ...s, userInstruction: "new goal" }));
    expect(projectStore.get().refinedPrompt).toBeUndefined();

    actions.build();
    projectStore.update((s) => ({ ...s, refinedPrompt: "refined again" }), { history: false });
    const id = projectStore.get().blocks[0]!.id;
    projectStore.update((s) => ({
      ...s,
      blocks: s.blocks.map((b) => (b.id === id ? { ...b, text: `${b.text} manual` } : b)),
    }));
    expect(projectStore.get().refinedPrompt).toBeUndefined();
  });

  it("image deletion cascades through targets, movements, steps and matrix sources", () => {
    const p = baseProject();
    p.targets.push({
      id: "source-target",
      label: "source",
      type: "point",
      imageId: "b",
      point: { x: 0.5, y: 0.5 },
    });
    p.movements.push({
      id: "mv",
      targetId: "source-target",
      from: { x: 0.5, y: 0.5 },
      to: { x: 0.7, y: 0.7 },
    });
    p.editSteps = [
      {
        id: "e",
        operation: "REPLACE",
        sourceImageId: "b",
        sourceAttribute: "objects",
        targetId: "source-target",
      },
    ];
    p.attributeMatrix.objects = { state: "REPLACE", sourceImageId: "b" };
    projectStore.replace(p);
    actions.removeImage("b");
    const q = projectStore.get();
    expect(q.targets.some((t) => t.id === "source-target")).toBe(false);
    expect(q.movements.some((m) => m.targetId === "source-target")).toBe(false);
    expect(q.editSteps[0]?.sourceImageId).toBeUndefined();
    expect(q.editSteps[0]?.targetId).toBeUndefined();
    expect(q.attributeMatrix.objects.state).toBe("FREE");
  });

  it("baseRules=false starts with an unconstrained matrix", () => {
    const m = defaultMatrix(false);
    expect(Object.values(m).every((e) => e.state === "FREE")).toBe(true);
  });
});

describe("safe AI refinement", () => {
  it("keeps relationship-bearing blocks byte-for-byte and only refines safe blocks", async () => {
    const blocks = compileBlocks(demoProject());
    const calls: string[] = [];
    const out = await refineBlocksSafely(blocks, async (text) => {
      calls.push(text);
      return `${text} polished`;
    });
    const roles = blocks.find((b) => b.id === "roles")!.text;
    const transfer = blocks.find((b) => b.id === "transfer")!.text;
    expect(out).toContain(roles);
    if (transfer) expect(out).toContain(transfer);
    expect(calls).not.toContain(roles);
  });

  it("rejects a refinement that changes image tags", async () => {
    const blocks = compileBlocks(demoProject()).filter((b) => b.id === "canvas");
    await expect(
      refineBlocksSafely(blocks, async (text) => text.replace("<image1>", "<image2>")),
    ).rejects.toThrow(/changed image references/i);
  });
});

describe("history versioning", () => {
  it("uses max(existing)+1 instead of count+1 after deletion", () => {
    db.remove(KEYS.history);
    const p = demoProject();
    const prompt = finalPrompt(p.blocks);
    const v1 = saveVersion(p, prompt);
    const v2 = saveVersion(p, prompt);
    const v3 = saveVersion(p, prompt);
    expect([v1.version, v2.version, v3.version]).toEqual([1, 2, 3]);
    deleteVersion(v2.id);
    const v4 = saveVersion(p, prompt);
    expect(v4.version).toBe(4);
    expect(getHistory().map((v) => v.version)).toEqual([1, 3, 4]);
  });
});

describe("qwen 2.1 ready-to-copy prompt compiler", () => {
  it("compiles natural instruction format for Qwen 2.1 with clear roles and preservations", () => {
    const p = demoProject();
    const natural = compileQwen21Prompt(p, "natural");
    expect(natural).toContain("In <image1>:");
    expect(natural).toMatch(/wardrobe.*from <image2>/i);
    expect(natural).toMatch(/facial identity.*<image3>/i);
    expect(natural).toContain(
      "Preserve pose, body position and limb placement, body shape, body proportions",
    );
    expect(natural).toContain("Keep all untargeted areas of <image1> unchanged.");
    expect(natural).not.toContain("Operation:");
  });

  it("compiles structured clauses with clear sections", () => {
    const p = demoProject();
    const structured = compileQwen21Prompt(p, "structured");
    expect(structured).toContain("[Base Image]");
    expect(structured).toContain("[Edits & Reference Transfers]");
    expect(structured).toContain("[Preservation Constraints]");
    expect(structured).toContain("• Preserve from <image1>:");
  });

  it("compiles comfyui node-mapped format", () => {
    const p = demoProject();
    const comfy = compileQwen21Prompt(p, "comfyui");
    expect(comfy).toContain("<image1>: Target canvas");
    expect(comfy).toContain("<image2>: Wardrobe reference.");
    expect(comfy).toContain("<image3>: Face Identity reference.");
    expect(comfy).toContain("Instruction: In <image1>,");
  });

  it("compiles single-line format without newlines", () => {
    const p = demoProject();
    const single = compileQwen21Prompt(p, "single_line");
    expect(single).not.toContain("\n");
    expect(single).toContain("In <image1>:");
  });

  it("wires image descriptions and importance into all Qwen 2.1 formats", () => {
    const p = demoProject();
    const natural = compileQwen21Prompt(p, "natural");
    expect(natural).toContain("Navy wool coat, white shirt, loafers");
    expect(natural).toContain("high priority");

    const structured = compileQwen21Prompt(p, "structured");
    expect(structured).toContain("Navy wool coat, white shirt, loafers");
    expect(structured).toContain("[high priority]");

    const comfy = compileQwen21Prompt(p, "comfyui");
    expect(comfy).toContain("Description: Navy wool coat, white shirt, loafers.");
    expect(comfy).toContain("Priority: high.");

    const single = compileQwen21Prompt(p, "single_line");
    expect(single).toContain("Navy wool coat, white shirt, loafers");
    expect(single).toContain("high priority");
  });

  it("compiles context-aware negative prompt for Qwen 2.1", () => {
    const p = demoProject();
    const neg = compileQwen21NegativePrompt(p);
    expect(neg).toContain("deformed");
    expect(neg).toContain("distorted face");
    expect(neg).toContain("garment clipping");
  });

  it("compiles complete bundle with positive, negative, and recommended Qwen 2.1 parameters", () => {
    const p = demoProject();
    const bundle = compileQwen21Bundle(p, "natural");
    expect(bundle).toContain("=== QWEN 2.1 IMAGE EDIT PROMPT BUNDLE ===");
    expect(bundle).toContain("--- POSITIVE PROMPT (NATURAL) ---");
    expect(bundle).toContain("--- NEGATIVE PROMPT ---");
    expect(bundle).toContain("• Model: Qwen-Image-2.1 (7B Unified)");
    expect(bundle).toContain("• CFG Scale: 4.0");
    expect(bundle).toContain("• Inference Steps: 40");
  });

  it("computes accurate token stats for Qwen tokenizer", () => {
    const stats = qwenTokenStats("In <image1>, replace the wardrobe with <image2>.");
    expect(stats.words).toBe(7);
    expect(stats.estimatedTokens).toBeGreaterThan(5);
    expect(stats.isSafe).toBe(true);
  });
});
