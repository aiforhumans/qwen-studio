import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import {
  closeDb,
  clearAllAssets,
  getImageAsset,
  putImageAsset,
  exportEmbeddedAssets,
  importEmbeddedAssets,
} from "@/lib/assets";
import { emptyProject, demoProject, projectStore, actions } from "@/lib/project-store";
import {
  loadInitial,
  migrateLegacyProject,
  migrateLegacyStorage,
  persistProject,
} from "@/lib/project-persistence";
import {
  db,
  KEYS,
  defaultSettings,
  saveSettings,
  exportAll,
  importAll,
  saveVersion,
  getHistory,
} from "@/lib/storage";
import type { ProjectState } from "@/lib/types";

const legacy = (): ProjectState => {
  const project = demoProject();
  project.images = [{ ...project.images[0]!, dataUrl: "data:image/png;base64,aW1hZ2U=" }];
  return project;
};

beforeEach(async () => {
  closeDb();
  vi.stubGlobal("indexedDB", new IDBFactory());
  await clearAllAssets();
  localStorage.clear();
  projectStore.replace(emptyProject());
  projectStore.clearHistory();
});
afterEach(() => {
  closeDb();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("saved data compatibility", () => {
  it("reloads saved projects and retains the selected prompt format", () => {
    actions.setField("metadata", { ...projectStore.get().metadata, promptFormat: "comfyui" });
    actions.setField("name", "Reload fixture");
    expect(loadInitial().name).toBe("Reload fixture");
    expect(loadInitial().metadata.promptFormat).toBe("comfyui");
  });
  it("respects autosave and supports explicit saves", () => {
    saveSettings({ ...defaultSettings, autosave: false });
    const saved = db.get<ProjectState>(KEYS.project, emptyProject());
    actions.setField("name", "Unsaved");
    expect(db.get<ProjectState>(KEYS.project, emptyProject()).name).toBe(saved.name);
    projectStore.saveNow();
    expect(loadInitial().name).toBe("Unsaved");
  });
  it("moves legacy pixels into committed assets before saving metadata", async () => {
    const migrated = await migrateLegacyProject(legacy());
    const image = migrated.images[0]!;
    expect(image.dataUrl).toBeUndefined();
    expect(image.assetId).toBeTruthy();
    expect((await getImageAsset(image.assetId))?.original.size).toBe(5);
    persistProject(migrated, true);
    expect(JSON.stringify(db.get(KEYS.project, null))).not.toContain("data:image");
  });
  it("migrates active projects and historical states at bootstrap", async () => {
    const project = legacy();
    db.set(KEYS.project, project);
    db.set(KEYS.history, [{ state: project, images: project.images }]);
    await migrateLegacyStorage();
    const migrated = db.get<ProjectState>(KEYS.project, emptyProject());
    expect(migrated.images[0]?.assetId).toBeTruthy();
    const history = getHistory()[0]!;
    expect(history.images[0]).not.toHaveProperty("dataUrl");
    expect(history.state.images[0]?.assetId).toBeTruthy();
    expect(history.state.images[0]?.assetId).toBe(history.images[0]?.assetId);
    expect(history.images[0]?.assetId).toBe(migrated.images[0]?.assetId);
  });
  it("keeps original metadata if image migration fails", async () => {
    db.set(KEYS.project, legacy());
    const original = localStorage.getItem(KEYS.project);
    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new Error("write failed");
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await migrateLegacyStorage();
    expect(localStorage.getItem(KEYS.project)).toBe(original);
  });
  it("retains legacy pixels when IndexedDB is unavailable", async () => {
    db.set(KEYS.project, legacy());
    const original = localStorage.getItem(KEYS.project);
    vi.stubGlobal("indexedDB", undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await migrateLegacyStorage();
    expect(localStorage.getItem(KEYS.project)).toBe(original);
  });
  it("does not cache failed image writes as successful assets", async () => {
    const record = {
      id: "failed",
      filename: "image.png",
      mimeType: "image/png",
      width: 1,
      height: 1,
      original: new Blob(["pixels"]),
      preview: new Blob(["pixels"]),
      createdAt: 0,
    };
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new Error("write failed");
    });
    await expect(putImageAsset(record)).rejects.toThrow("write failed");
    spy.mockRestore();
    expect(await getImageAsset("failed")).toBeUndefined();
  });
  it("rejects an aborted transaction even after its put request succeeded", async () => {
    const originalPut = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<typeof originalPut>
    ) {
      const request = originalPut.apply(this, args);
      request.addEventListener("success", () => this.transaction.abort());
      return request;
    });
    await expect(
      putImageAsset({
        id: "aborted",
        filename: "image.png",
        mimeType: "image/png",
        width: 1,
        height: 1,
        original: new Blob(["pixels"]),
        preview: new Blob(["pixels"]),
        createdAt: 0,
      }),
    ).rejects.toThrow("aborted");
    spy.mockRestore();
    expect(await getImageAsset("aborted")).toBeUndefined();
  });
  it("round trips metadata backups, secrets policy, versions and image assets", async () => {
    const project = await migrateLegacyProject(legacy());
    projectStore.replace(project);
    saveVersion(project, "saved prompt");
    db.set(KEYS.models, { active: "openai", providers: { openai: { apiKey: "test-secret" } } });
    const backup = exportAll();
    expect(JSON.stringify(backup[KEYS.models])).not.toContain("test-secret");
    expect(JSON.stringify(exportAll(true)[KEYS.models])).toContain("test-secret");
    const assets = await exportEmbeddedAssets(project.images.map((image) => image.assetId!));
    await clearAllAssets();
    localStorage.clear();
    expect(await importEmbeddedAssets(assets)).toBe(1);
    importAll(backup);
    expect(loadInitial().projectId).toBe(project.projectId);
    expect(getHistory()[0]?.prompt).toBe("saved prompt");
    expect(await getImageAsset(project.images[0]?.assetId)).toBeDefined();
  });
  it("validates the entire backup before changing saved data", () => {
    const before = localStorage.getItem(KEYS.project);
    expect(() =>
      importAll({ [KEYS.project]: demoProject(), [KEYS.settings]: { theme: "invalid" } }),
    ).toThrow("invalid settings");
    expect(localStorage.getItem(KEYS.project)).toBe(before);
  });
  it("continues editing when storage reads and writes fail", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(loadInitial().images.length).toBe(3);
    actions.setField("name", "Still editable");
    expect(projectStore.get().name).toBe("Still editable");
    expect(() => projectStore.saveNow()).toThrow("storage");
  });
  it("preserves malformed stored projects for manual recovery", () => {
    db.set(KEYS.project, { invalid: true });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(loadInitial().images).toHaveLength(0);
    expect(db.get(KEYS.project, null)).toEqual({ invalid: true });
  });
});
