import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  copyReadyPrompt,
  copyText,
  doBuild,
  doSave,
  refineProjectPrompt,
  runQwenEdit,
} from "@/lib/studio-workflows";
import { demoProject, projectStore, actions } from "@/lib/project-store";
import { getHistory } from "@/lib/storage";
import { compileQwen21Prompt } from "@/lib/compiler";
import * as providers from "@/lib/providers";

beforeEach(() => {
  localStorage.clear();
  projectStore.replace(demoProject());
  projectStore.clearHistory();
});
afterEach(() => vi.restoreAllMocks());

describe("shared Studio workflows", () => {
  it("builds and saves a version from current state", () => {
    actions.setField("userInstruction", "Warm light");
    doBuild();
    expect(projectStore.get().isPromptDirty).toBe(false);
    doSave();
    expect(getHistory()[0]?.state.userInstruction).toBe("Warm light");
  });
  it("copies the selected format through the shared clipboard service", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    actions.setField("metadata", { ...projectStore.get().metadata, promptFormat: "structured" });
    expect(await copyReadyPrompt()).toBe(true);
    expect(writeText).toHaveBeenCalledWith(compileQwen21Prompt(projectStore.get(), "structured"));
  });
  it("reports blocked clipboard writes without throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    expect(await copyText("prompt", "Copied")).toBe(false);
  });
  it("stores refinement when the project remains unchanged", async () => {
    vi.spyOn(providers, "refineWording").mockImplementation(async (text) => text);
    await refineProjectPrompt();
    expect(projectStore.get().refinedPrompt).toBeTruthy();
  });
  it("rejects stale refinement when the project changes during the request", async () => {
    vi.spyOn(providers, "refineWording").mockImplementation(async (text) => {
      actions.setField("userInstruction", "Changed during request");
      return text;
    });
    await expect(refineProjectPrompt()).rejects.toThrow("changed during refinement");
    expect(projectStore.get().refinedPrompt).toBeUndefined();
  });
  it("keeps direct generation optional in manual mode", async () => {
    await expect(runQwenEdit("prompt")).rejects.toThrow("Models page");
  });
});
