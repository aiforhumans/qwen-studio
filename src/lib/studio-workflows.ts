import { assetDataUrl, exportEmbeddedAssets, importEmbeddedAssets } from "@/lib/assets";
import { compileQwen21Prompt, finalPrompt, qwenTokenStats } from "@/lib/compiler";
import { logger } from "@/lib/logger";
import { actions } from "./project-actions";
import { projectStore } from "./project-store-core";
import {
  activeLabel,
  generateQwenImageEdit,
  getModelSettings,
  refineWording,
} from "@/lib/providers";
import { refineBlocksSafely } from "@/lib/refinement";
import { validateProjectImportEnvelope } from "@/lib/schema";
import { downloadJson, pickJson, saveVersion } from "@/lib/storage";
import type { QwenPromptFormat } from "@/lib/types";
import { toast } from "sonner";

import { compilerInputHash } from "./compiler";
import { emptyProject } from "./project-factories";
import { migrateLegacyProject } from "./project-persistence";
import { parseProjectImport } from "./schema";
import { getSettings } from "./storage";
export function doSave() {
  const cur = actions.ensureBuilt();
  const prompt = cur.refinedPrompt ?? compileQwen21Prompt(cur, "natural");
  try {
    const v = saveVersion({ ...cur, metadata: { ...cur.metadata, model: activeLabel() } }, prompt);
    logger.info("store", `Saved version V${v.version} for "${cur.name}"`);
    toast.success(`Saved ${cur.name} — Prompt V${v.version}`);
  } catch (e) {
    logger.error("store", `Failed to save version: ${(e as Error).message}`);
    toast.error((e as Error).message);
  }
}

export function doBuild() {
  actions.build();
  const p = projectStore.get();
  const locked = p.blocks.filter((b) => b.locked).length;
  logger.info("compiler", `Synchronized prompt blocks (${locked} locked blocks kept)`);
  toast.success(`Prompt synchronized${locked ? ` · ${locked} locked block(s) kept` : ""}`);
}

export async function exportProject() {
  try {
    const fresh = actions.ensureBuilt();
    const assetIds = fresh.images.flatMap((i) => (i.assetId ? [i.assetId] : []));
    const assets = await exportEmbeddedAssets(assetIds);
    downloadJson(`${fresh.name.replace(/\W+/g, "_")}.qwen-project.json`, {
      format: "qps-project",
      version: 1,
      project: fresh,
      assets,
    });
    toast.success(`Exported project with ${Object.keys(assets).length} embedded image asset(s).`);
    logger.info(
      "assets",
      `Exported project "${fresh.name}" with ${Object.keys(assets).length} embedded image asset(s)`,
    );
  } catch (e) {
    logger.error("assets", `Failed to export project: ${(e as Error).message}`);
    toast.error((e as Error).message);
  }
}

export async function importProject() {
  try {
    const d = await pickJson();
    let raw = d;
    let importedAssets = 0;
    if (d && typeof d === "object" && "project" in d) {
      const bundle = d as { project?: unknown; assets?: unknown };
      validateProjectImportEnvelope(bundle.project);
      importedAssets = await importEmbeddedAssets(bundle.assets);
      raw = bundle.project;
    } else {
      validateProjectImportEnvelope(raw);
    }
    const migrated = await migrateLegacyProject(
      parseProjectImport(raw, emptyProject(), getSettings().baseRules),
    );
    projectStore.replace(migrated);
    logger.info(
      "assets",
      `Imported project "${projectStore.get().name}" with ${importedAssets} image asset(s)`,
    );
    toast.success(
      `Imported ${projectStore.get().name}${importedAssets ? ` · ${importedAssets} image asset(s)` : ""}`,
    );
  } catch (e) {
    logger.error("assets", `Failed to import project: ${(e as Error).message}`);
    toast.error((e as Error).message);
  }
}

export async function copyText(
  text: string,
  message: string,
  details?: { format: QwenPromptFormat; words: number; estimatedTokens: number },
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    logger.info("clipboard", message, details);
    toast.success(
      message,
      details
        ? {
            description: `${details.words} words · ~${details.estimatedTokens} tokens (${details.format} format)`,
          }
        : undefined,
    );
    return true;
  } catch {
    logger.error("clipboard", "Clipboard write failed");
    toast.error("Clipboard blocked by browser permissions.");
    return false;
  }
}
export function copyReadyPrompt() {
  const current = projectStore.get();
  const format = current.metadata.promptFormat || "natural";
  const text = current.refinedPrompt ?? compileQwen21Prompt(current, format);
  return copyText(text, "Ready-to-copy Qwen 2.1 prompt copied!", {
    format,
    ...qwenTokenStats(text),
  });
}
export async function refineProjectPrompt(): Promise<void> {
  const fresh = actions.ensureBuilt();
  if (!finalPrompt(fresh.blocks)) throw new Error("Build the prompt first.");
  const signature = JSON.stringify(fresh.blocks);
  const hash = compilerInputHash(fresh);
  const out = await refineBlocksSafely(fresh.blocks, refineWording);
  const current = projectStore.get();
  if (
    current.projectId !== fresh.projectId ||
    compilerInputHash(current) !== hash ||
    JSON.stringify(current.blocks) !== signature
  )
    throw new Error("Project changed during refinement. Refine the current prompt again.");
  projectStore.update((s) => ({ ...s, refinedPrompt: out }), { history: false });
}
export async function runQwenEdit(displayedPrompt: string): Promise<string[]> {
  const models = getModelSettings();
  if (models.active !== "qwen_pe")
    throw new Error("Select Official Qwen Image Edit on the Models page first.");
  const fresh = actions.ensureBuilt();
  const blocking = fresh.issues.filter((i) => i.severity === "error");
  if (blocking.length)
    throw new Error(`Fix ${blocking.length} validator error(s) before generating.`);
  if (fresh.images.length < 1 || fresh.images.length > 3)
    throw new Error(
      "Official Qwen Image Edit accepts 1–3 ordered input images. Remove extras before direct generation.",
    );
  const inputs: string[] = [];
  for (const image of fresh.images) {
    const data = image.assetId
      ? (await assetDataUrl(image.assetId, "preview")) ||
        (await assetDataUrl(image.assetId, "original"))
      : image.dataUrl;
    if (!data) throw new Error(`${image.tag} has no local image pixels.`);
    inputs.push(data);
  }
  return generateQwenImageEdit(
    models.providers.qwen_pe,
    inputs,
    fresh.refinedPrompt ?? displayedPrompt,
  );
}
