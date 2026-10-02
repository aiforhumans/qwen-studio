import { toast } from "sonner";
import { dataUrlToBlob, getImageAsset, putImageAsset } from "./assets";
import { logger } from "./logger";
import { demoProject, emptyProject } from "./project-factories";
import { analyze } from "./project-transitions";
import { parseProjectImport } from "./schema";
import { db, getSettings, KEYS } from "./storage";
import type { ProjectState, RefImage } from "./types";

let warnedFull = false;

export function loadInitial(): ProjectState {
  const saved = db.get<unknown>(KEYS.project, null);
  if (saved && typeof saved === "object") {
    try {
      return analyze(parseProjectImport(saved, emptyProject(), getSettings().baseRules));
    } catch (error) {
      // Preserve invalid input for recovery rather than deleting user data.
      logger.warn("store", "Saved project could not be loaded", String(error));
      return emptyProject();
    }
  }
  if (!db.get(KEYS.seeded, false)) {
    try {
      db.set(KEYS.seeded, true);
    } catch {
      toast.error("Browser storage is unavailable. Changes may not survive a reload.");
    }
    return demoProject();
  }
  return emptyProject();
}

export function projectMetadata(project: ProjectState): ProjectState {
  return {
    ...project,
    images: project.images.map(({ dataUrl, ...image }) => {
      if (dataUrl && !image.assetId)
        throw new Error("Legacy image migration must finish before saving this project.");
      return image;
    }),
  };
}

export function persistProject(project: ProjectState, force = false) {
  if (!force && !getSettings().autosave) return;
  try {
    db.set(KEYS.project, projectMetadata(project));
    warnedFull = false;
  } catch (error) {
    if (force) throw error;
    if (!warnedFull) toast.error((error as Error).message);
    warnedFull = true;
  }
}

/** Store legacy pixels before removing their metadata representation. */
export async function migrateLegacyProject(
  project: ProjectState,
  migratedAssets = new Map<string, string>(),
): Promise<ProjectState> {
  const images: RefImage[] = [];
  for (const image of project.images) {
    if (!image.dataUrl) {
      images.push(image);
      continue;
    }
    const { dataUrl, ...metadata } = image;
    if (typeof indexedDB === "undefined")
      throw new Error(
        "IndexedDB is unavailable; legacy image pixels must remain in saved metadata.",
      );
    let assetId = image.assetId ?? migratedAssets.get(dataUrl);
    if (!assetId || !(await getImageAsset(assetId))) {
      const original = await dataUrlToBlob(dataUrl);
      assetId ||= crypto.randomUUID();
      await putImageAsset({
        id: assetId,
        filename: image.filename,
        mimeType: image.mimeType || original.type,
        width: image.width,
        height: image.height,
        original,
        preview: original,
        createdAt: Date.now(),
      });
    }
    migratedAssets.set(dataUrl, assetId);
    images.push({ ...metadata, assetId });
  }
  return { ...project, images };
}

/** Called once before mounting, also reusable after a legacy backup import. */
export async function migrateLegacyStorage(): Promise<void> {
  const migratedAssets = new Map<string, string>();
  for (const key of [KEYS.project, KEYS.history]) {
    try {
      const raw = db.get<unknown>(key, null);
      if (!raw) continue;
      if (key === KEYS.project) {
        if (!(raw as ProjectState).images?.some((image) => image.dataUrl)) continue;
        const project = parseProjectImport(raw, emptyProject(), getSettings().baseRules);
        db.set(key, await migrateLegacyProject(project, migratedAssets));
      } else if (Array.isArray(raw)) {
        let changed = false;
        const versions = [];
        for (const version of raw) {
          if (!version || typeof version !== "object") {
            versions.push(version);
            continue;
          }
          const state = version.state as ProjectState | undefined;
          const images = version.images as RefImage[] | undefined;
          const migrateState = state?.images?.some((image) => image.dataUrl);
          const migrateImages = images?.some((image) => image.dataUrl);
          if (!migrateState && !migrateImages) {
            versions.push(version);
            continue;
          }
          const next = { ...version };
          if (migrateState && state) next.state = await migrateLegacyProject(state, migratedAssets);
          if (migrateImages && images) {
            const migrated = await migrateLegacyProject(
              { ...emptyProject(), images },
              migratedAssets,
            );
            next.images = migrated.images;
          }
          versions.push(next);
          changed = true;
        }
        if (changed) db.set(key, versions);
      }
    } catch (error) {
      logger.warn(
        "assets",
        `Legacy migration failed for ${key}; original metadata retained`,
        String(error),
      );
      toast.error("Some legacy images could not be migrated. Original saved data was retained.");
    }
  }
}
