/** Local metadata persistence. Image bytes live in IndexedDB via assets.ts. */
import {
  BackupEnvelopeSchema,
  ModelsImportSchema,
  SettingsImportSchema,
  validateProjectImportEnvelope,
} from "./schema";
import type { ProjectState, PromptBlock, PromptLevel, RefImage } from "./types";

export interface StorageBackend {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

export const localBackend: StorageBackend = {
  get(key, fallback) {
    if (typeof window === "undefined") return fallback;
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("Storage full", e);
      throw new Error(
        "Local metadata storage is full. Delete old history/learning records or export and reset the app.",
      );
    }
  },
  remove(key) {
    if (typeof window !== "undefined") localStorage.removeItem(key);
  },
};

export const db = localBackend;
export const KEYS = {
  project: "qps.project",
  history: "qps.history",
  learning: "qps.learning",
  prefs: "qps.prefs",
  settings: "qps.settings",
  models: "qps.models",
  seeded: "qps.seeded",
} as const;

export interface Settings {
  theme: "dark" | "light";
  density: "compact" | "comfortable";
  autosave: boolean;
  defaultLevel: PromptLevel;
  baseRules: boolean;
}
export const defaultSettings: Settings = {
  theme: "dark",
  density: "compact",
  autosave: true,
  defaultLevel: "expert",
  baseRules: true,
};
export const getSettings = (): Settings => {
  const raw = db.get(KEYS.settings, {});
  const parsed = SettingsImportSchema.safeParse(raw);
  if (!parsed.success) return { ...defaultSettings };
  const d = parsed.data;
  return {
    theme: d.theme ?? defaultSettings.theme,
    density: d.density ?? defaultSettings.density,
    autosave: d.autosave ?? defaultSettings.autosave,
    defaultLevel: d.defaultLevel ?? defaultSettings.defaultLevel,
    baseRules: d.baseRules ?? defaultSettings.baseRules,
  };
};
export const saveSettings = (s: Settings) => {
  db.set(KEYS.settings, s);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("qps-settings"));
};

type StoredRefImage = Omit<RefImage, "dataUrl">;
export interface HistoryVersion {
  id: string;
  projectId: string;
  projectName: string;
  version: number;
  timestamp: number;
  model: string;
  prompt: string;
  compilerInputHash?: string | undefined;
  blocks: PromptBlock[];
  images: StoredRefImage[];
  state: Omit<ProjectState, "images"> & { images: StoredRefImage[] };
}
export const getHistory = (): HistoryVersion[] => {
  const x = db.get<unknown>(KEYS.history, []);
  return Array.isArray(x) ? (x as HistoryVersion[]) : [];
};
export function saveVersion(p: ProjectState, prompt: string): HistoryVersion {
  if (p.images.some((image) => image.dataUrl && !image.assetId))
    throw new Error("Legacy image migration must finish before saving a version.");
  const all = getHistory();
  const existing = all
    .filter((h) => h.projectId === p.projectId)
    .map((h) => Number(h.version) || 0);
  const version = Math.max(0, ...existing) + 1;
  const images = p.images.map(({ dataUrl: _legacy, ...r }) => r);
  const state = { ...p, images } as HistoryVersion["state"];
  const v: HistoryVersion = {
    id: crypto.randomUUID(),
    projectId: p.projectId,
    projectName: p.name,
    version,
    timestamp: Date.now(),
    model: p.metadata.model,
    prompt,
    compilerInputHash: p.lastCompiledHash,
    blocks: p.blocks,
    images,
    state,
  };
  db.set(KEYS.history, [...all, v]);
  return v;
}
export const deleteVersion = (id: string) =>
  db.set(
    KEYS.history,
    getHistory().filter((h) => h.id !== id),
  );

export interface GenerationMetadata {
  model?: string | undefined;
  seed?: string | undefined;
  steps?: number | undefined;
  cfg?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  sampler?: string | undefined;
}

export interface LearningRecord {
  id: string;
  timestamp: number;
  verdict: "good" | "bad";
  ratings: Record<
    "identity" | "clothing" | "pose" | "background" | "spatial" | "coherence",
    number
  >;
  prompt: string;
  projectId: string;
  projectStateHash: string;
  compilerVersion: string;
  editOperations: string[];
  roles: string[];
  /** Exact source-image identity for reproducible preference learning. */
  references: { imageId: string; tag: string; role: string; assetId?: string | undefined }[];
  model: string;
  templateId: string;
  wordingVariant: string;
  settings: { level: PromptLevel };
  generation?: GenerationMetadata | undefined;
  resultAssetId?: string | undefined;
}

/**
 * Collects all asset IDs currently referenced across version history,
 * preference learning records, and optionally an active project state.
 */
export function getAllReferencedAssetIds(extraProject?: ProjectState): Set<string> {
  const set = new Set<string>();
  if (extraProject) {
    for (const img of extraProject.images) {
      if (img.assetId) set.add(img.assetId);
    }
  }
  for (const v of getHistory()) {
    for (const img of [...(v.images ?? []), ...(v.state?.images ?? [])]) {
      if (img.assetId) set.add(img.assetId);
    }
  }
  for (const l of getLearning()) {
    for (const ref of l.references) {
      if (ref.assetId) set.add(ref.assetId);
    }
    if (l.resultAssetId) set.add(l.resultAssetId);
  }
  return set;
}
export const getLearning = (): LearningRecord[] => {
  const x = db.get<unknown>(KEYS.learning, []);
  if (!Array.isArray(x)) return [];
  return x.flatMap((raw, i) => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Partial<LearningRecord> & { operation?: string };
    const ratings = r.ratings && typeof r.ratings === "object" ? r.ratings : undefined;
    if (!ratings) return [];
    return [
      {
        id: typeof r.id === "string" ? r.id : `legacy-${i}`,
        timestamp: Number.isFinite(r.timestamp) ? Number(r.timestamp) : Date.now(),
        verdict: r.verdict === "bad" ? "bad" : "good",
        ratings: {
          identity: Number(ratings.identity) || 1,
          clothing: Number(ratings.clothing) || 1,
          pose: Number(ratings.pose) || 1,
          background: Number(ratings.background) || 1,
          spatial: Number(ratings.spatial) || 1,
          coherence: Number(ratings.coherence) || 1,
        },
        prompt: typeof r.prompt === "string" ? r.prompt : "",
        projectId: typeof r.projectId === "string" ? r.projectId : "legacy",
        projectStateHash: typeof r.projectStateHash === "string" ? r.projectStateHash : "legacy",
        compilerVersion: typeof r.compilerVersion === "string" ? r.compilerVersion : "legacy",
        editOperations: Array.isArray(r.editOperations)
          ? r.editOperations.filter((v): v is string => typeof v === "string")
          : r.operation
            ? [r.operation]
            : [],
        roles: Array.isArray(r.roles)
          ? r.roles.filter((v): v is string => typeof v === "string")
          : [],
        references: Array.isArray(r.references)
          ? r.references.flatMap((v) => {
              if (!v || typeof v !== "object") return [];
              const ref = v as {
                imageId?: unknown;
                tag?: unknown;
                role?: unknown;
                assetId?: unknown;
              };
              if (
                typeof ref.imageId !== "string" ||
                typeof ref.tag !== "string" ||
                typeof ref.role !== "string"
              )
                return [];
              return [
                {
                  imageId: ref.imageId,
                  tag: ref.tag,
                  role: ref.role,
                  assetId: typeof ref.assetId === "string" ? ref.assetId : undefined,
                },
              ];
            })
          : [],
        model: typeof r.model === "string" ? r.model : "legacy",
        templateId: typeof r.templateId === "string" ? r.templateId : "custom",
        wordingVariant: typeof r.wordingVariant === "string" ? r.wordingVariant : "legacy",
        settings:
          r.settings &&
          typeof r.settings === "object" &&
          ["simple", "advanced", "expert"].includes(String(r.settings.level))
            ? { level: r.settings.level }
            : { level: "advanced" },
        generation: r.generation,
        resultAssetId: typeof r.resultAssetId === "string" ? r.resultAssetId : undefined,
      } satisfies LearningRecord,
    ];
  });
};
export const addLearning = (r: LearningRecord) => db.set(KEYS.learning, [...getLearning(), r]);

export interface PrefEvent {
  id: string;
  timestamp: number;
  operation: string;
  blockType: string;
  context: string;
  chosen: string;
  rejected: string;
  chosenText: string;
  rejectedText: string;
  chosenTemplateId: string;
  rejectedTemplateId: string;
}
export const getPrefs = (): PrefEvent[] => {
  const x = db.get<unknown>(KEYS.prefs, []);
  if (!Array.isArray(x)) return [];
  return x.flatMap((raw, i) => {
    if (!raw || typeof raw !== "object") return [];
    const e = raw as Partial<PrefEvent>;
    const chosen = typeof e.chosen === "string" ? e.chosen : "legacy";
    const rejected = typeof e.rejected === "string" ? e.rejected : "legacy";
    return [
      {
        id: typeof e.id === "string" ? e.id : `legacy-pref-${i}`,
        timestamp: Number.isFinite(e.timestamp) ? Number(e.timestamp) : Date.now(),
        operation: typeof e.operation === "string" ? e.operation : "CUSTOM",
        blockType: typeof e.blockType === "string" ? e.blockType : "targets",
        context: typeof e.context === "string" ? e.context : "legacy",
        chosen,
        rejected,
        chosenText: typeof e.chosenText === "string" ? e.chosenText : "",
        rejectedText: typeof e.rejectedText === "string" ? e.rejectedText : "",
        chosenTemplateId: typeof e.chosenTemplateId === "string" ? e.chosenTemplateId : chosen,
        rejectedTemplateId:
          typeof e.rejectedTemplateId === "string" ? e.rejectedTemplateId : rejected,
      } satisfies PrefEvent,
    ];
  });
};
export const addPref = (e: PrefEvent) => db.set(KEYS.prefs, [...getPrefs(), e]);

export function exportAll(includeSecrets = false) {
  const out: Record<string, unknown> = {};
  for (const k of Object.values(KEYS)) out[k] = db.get(k, null);
  if (!includeSecrets && out[KEYS.models] && typeof out[KEYS.models] === "object") {
    const models = structuredClone(out[KEYS.models]) as {
      providers?: Record<string, { apiKey?: string }>;
    };
    if (models.providers) for (const p of Object.values(models.providers)) delete p.apiKey;
    out[KEYS.models] = models;
  }
  return out;
}

export function validateBackupData(data: Record<string, unknown>) {
  const parsed = BackupEnvelopeSchema.safeParse(data);
  if (!parsed.success) throw new Error("Invalid backup file.");
  for (const k of Object.values(KEYS)) {
    if (!(k in parsed.data) || parsed.data[k] == null) continue;
    const v = parsed.data[k];
    if ([KEYS.history, KEYS.learning, KEYS.prefs].includes(k as never) && !Array.isArray(v))
      throw new Error(`Backup field ${k} must be an array.`);
    if (
      [KEYS.settings, KEYS.models, KEYS.project].includes(k as never) &&
      (typeof v !== "object" || Array.isArray(v))
    )
      throw new Error(`Backup field ${k} must be an object.`);
    if (k === KEYS.settings && !SettingsImportSchema.safeParse(v).success)
      throw new Error("Backup contains invalid settings.");
    if (k === KEYS.models && !ModelsImportSchema.safeParse(v).success)
      throw new Error("Backup contains invalid model settings.");
    if (k === KEYS.project) validateProjectImportEnvelope(v);
  }
  return parsed.data;
}

export function importAll(data: Record<string, unknown>) {
  const validated = validateBackupData(data);
  // Validate the complete envelope first, then mutate storage. This avoids
  // partially imported backups when a later field is malformed.
  for (const k of Object.values(KEYS)) {
    if (!(k in validated) || validated[k] == null) continue;
    db.set(k, validated[k]);
  }
}
export function resetAll() {
  for (const k of Object.values(KEYS)) db.remove(k);
}

export function downloadJson(name: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export function pickJson(): Promise<unknown> {
  return new Promise((res, rej) => {
    const i = document.createElement("input");
    i.type = "file";
    i.accept = "application/json,.json";
    i.onchange = async () => {
      const f = i.files?.[0];
      if (!f) return rej(new Error("No file"));
      try {
        res(JSON.parse(await f.text()));
      } catch {
        rej(new Error("Invalid JSON file"));
      }
    };
    i.click();
  });
}
