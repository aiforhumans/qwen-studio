import {
  deleteImageAsset,
  getAllAssetIds,
  getImageAsset,
  putImageAsset,
  type ImageAssetRecord,
} from "@/lib/assets";
import { actions, emptyProject, projectStore } from "@/lib/project-store";
import { addLearning, getAllReferencedAssetIds, saveVersion } from "@/lib/storage";
import type { RefImage } from "@/lib/types";
import { beforeEach, describe, expect, it } from "vitest";

describe("IndexedDB asset lifecycle and garbage collection", () => {
  beforeEach(async () => {
    localStorage.clear();
    const all = await getAllAssetIds();
    for (const id of all) {
      await deleteImageAsset(id);
    }
  });

  const dummyAsset = (id: string): ImageAssetRecord => ({
    id,
    filename: `test-${id}.png`,
    mimeType: "image/png",
    width: 200,
    height: 200,
    original: new Blob(["dummy-orig"], { type: "image/png" }),
    preview: new Blob(["dummy-prev"], { type: "image/png" }),
    createdAt: Date.now(),
  });

  const dummyImage = (id: string, assetId: string): Omit<RefImage, "tag"> => ({
    id,
    filename: `test-${id}.png`,
    width: 200,
    height: 200,
    assetId,
    role: "Base Canvas",
    importance: "Medium",
    uses: [],
    excludes: [],
    locks: [],
  });

  it("stores and retrieves image assets", async () => {
    const asset = dummyAsset("asset-1");
    await putImageAsset(asset);
    const retrieved = await getImageAsset("asset-1");
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe("asset-1");
    expect(retrieved?.filename).toBe("test-asset-1.png");
  });

  it("identifies referenced asset IDs across project, history, and learning", () => {
    const project = emptyProject();
    project.images = [dummyImage("img-1", "asset-in-proj") as RefImage];

    saveVersion(
      {
        ...project,
        images: [dummyImage("img-2", "asset-in-history") as RefImage],
      },
      "Test version prompt",
    );

    addLearning({
      id: "learn-1",
      timestamp: Date.now(),
      verdict: "good",
      ratings: { identity: 8, clothing: 8, pose: 8, background: 8, spatial: 8, coherence: 8 },
      prompt: "learn prompt",
      projectId: "proj-1",
      projectStateHash: "hash-1",
      compilerVersion: "1.0",
      editOperations: [],
      roles: [],
      references: [
        { imageId: "img-3", tag: "<image1>", role: "Base Canvas", assetId: "asset-in-learning" },
      ],
      model: "test-model",
      templateId: "custom",
      wordingVariant: "Replace",
      settings: { level: "expert" },
      resultAssetId: "asset-result-learning",
    });

    const referenced = getAllReferencedAssetIds(project);
    expect(referenced.has("asset-in-proj")).toBe(true);
    expect(referenced.has("asset-in-history")).toBe(true);
    expect(referenced.has("asset-in-learning")).toBe(true);
    expect(referenced.has("asset-result-learning")).toBe(true);
    expect(referenced.has("unreferenced-asset")).toBe(false);
  });

  it("preserves removed image assets for undo, then collects them when history is cleared", async () => {
    await putImageAsset(dummyAsset("asset-orphan"));
    expect(await getImageAsset("asset-orphan")).toBeDefined();

    // Reset project and add dummy image
    actions.setField("images", [dummyImage("img-orphan", "asset-orphan") as RefImage]);

    // Remove the image
    actions.removeImage("img-orphan");
    expect(await getImageAsset("asset-orphan")).toBeDefined();
    projectStore.undo();
    expect(projectStore.get().images[0]?.assetId).toBe("asset-orphan");
    projectStore.redo();
    projectStore.clearHistory();

    // Wait a tick for async deletion
    await new Promise((r) => setTimeout(r, 50));

    const retrieved = await getImageAsset("asset-orphan");
    expect(retrieved).toBeUndefined();
  });

  it("preserves asset when another image in the project still references it", async () => {
    await putImageAsset(dummyAsset("asset-shared"));

    actions.setField("images", [
      dummyImage("img-1", "asset-shared") as RefImage,
      dummyImage("img-2", "asset-shared") as RefImage,
    ]);

    // Remove only one image
    actions.removeImage("img-1");

    await new Promise((r) => setTimeout(r, 50));

    const retrieved = await getImageAsset("asset-shared");
    expect(retrieved).toBeDefined();
  });

  it("preserves asset when referenced in history", async () => {
    await putImageAsset(dummyAsset("asset-hist"));

    const proj = emptyProject();
    saveVersion(
      {
        ...proj,
        images: [dummyImage("img-hist", "asset-hist") as RefImage],
      },
      "History prompt",
    );

    actions.setField("images", [dummyImage("img-active", "asset-hist") as RefImage]);

    actions.removeImage("img-active");

    await new Promise((r) => setTimeout(r, 50));

    const retrieved = await getImageAsset("asset-hist");
    expect(retrieved).toBeDefined();
  });
});
