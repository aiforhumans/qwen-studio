import { z } from "zod";
import { BLOCK_META, DEFAULT_ORDER, defaultMatrix } from "./constants";
import {
  ATTRIBUTES,
  OPERATIONS,
  PROJECT_SCHEMA_VERSION,
  ROLES,
  type Attribute,
  type AttributeMatrix,
  type BlockId,
  type EditStep,
  type Movement,
  type ProjectState,
  type RefImage,
  type Target,
} from "./types";

const projectEnvelope = z
  .object({
    projectId: z.string().min(1),
    name: z.string().optional(),
    images: z.array(z.unknown()),
    attributeMatrix: z.record(z.unknown()),
  })
  .passthrough();

const attrSet = new Set<string>(ATTRIBUTES);
const blockSet = new Set<string>(DEFAULT_ORDER);
const stateSet = new Set(["LOCK", "REPLACE", "FREE", "IGNORE"]);
const uid = () => globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12);
const finite = (v: unknown, fallback = 0) => (Number.isFinite(v) ? Number(v) : fallback);
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const bool = (v: unknown, fallback = false) => (typeof v === "boolean" ? v : fallback);

function migrateAttrName(a: unknown, role?: string, operation?: string): Attribute[] {
  if (typeof a !== "string") return [];
  if (attrSet.has(a)) return [a as Attribute];
  if (a === "body") {
    if (role === "Pose" || operation === "POSE") return ["body_position"];
    return ["body_shape", "body_proportions"];
  }
  return [];
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function migrateImage(raw: unknown, i: number): RefImage {
  const x = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const role = ROLES.includes(x["role"] as never) ? (x["role"] as RefImage["role"]) : "Custom";
  const arr = (key: string) => {
    const val = x[key];
    return uniq((Array.isArray(val) ? val : []).flatMap((a) => migrateAttrName(a, role)));
  };
  const importance = ["Low", "Medium", "High", "Critical"].includes(String(x["importance"]))
    ? (x["importance"] as RefImage["importance"])
    : "Medium";
  return {
    id: str(x["id"]) || uid(),
    tag: `<image${i + 1}>`,
    filename: str(x["filename"]) || `image-${i + 1}`,
    width: Math.max(0, finite(x["width"])),
    height: Math.max(0, finite(x["height"])),
    assetId: str(x["assetId"]),
    dataUrl: str(x["dataUrl"]),
    mimeType: str(x["mimeType"]),
    role,
    customRole: str(x["customRole"]),
    importance,
    description: str(x["description"]),
    analysis:
      x["analysis"] && typeof x["analysis"] === "object"
        ? (x["analysis"] as RefImage["analysis"])
        : undefined,
    uses: arr("uses"),
    excludes: arr("excludes"),
    locks: arr("locks"),
  };
}

function migrateMatrix(raw: Record<string, unknown>, baseRules: boolean): AttributeMatrix {
  const m = defaultMatrix(baseRules);
  for (const a of ATTRIBUTES) {
    const v = raw[a];
    if (!v || typeof v !== "object") continue;
    const e = v as Record<string, unknown>;
    if (stateSet.has(String(e["state"]))) {
      m[a] = {
        state: e["state"] as AttributeMatrix[Attribute]["state"],
        sourceImageId: str(e["sourceImageId"]),
      };
    }
  }

  // Schema v1 had one ambiguous `body` attribute. Preserve appearance by
  // migrating a REPLACE body to placement, while locking shape/proportions.
  const body = raw["body"];
  if (body && typeof body === "object") {
    const e = body as Record<string, unknown>;
    const state = stateSet.has(String(e["state"]))
      ? (e["state"] as AttributeMatrix[Attribute]["state"])
      : undefined;
    const sourceImageId = str(e["sourceImageId"]);
    if (state === "LOCK" || state === "FREE" || state === "IGNORE") {
      m.body_shape = { state };
      m.body_proportions = { state };
    } else if (state === "REPLACE") {
      m.body_position = { state: "REPLACE", sourceImageId };
      if (!raw["body_shape"]) m.body_shape = { state: "LOCK" };
      if (!raw["body_proportions"]) m.body_proportions = { state: "LOCK" };
    }
  }
  return m;
}

function migrateTarget(raw: unknown): Target | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const x = raw as Record<string, unknown>;
  const imageId = str(x["imageId"]);
  if (!imageId) return undefined;
  const type = ["point", "box", "vision_proposal"].includes(String(x["type"]))
    ? (x["type"] as Target["type"])
    : "point";
  const pointRaw =
    x["point"] && typeof x["point"] === "object"
      ? (x["point"] as Record<string, unknown>)
      : undefined;
  const boxRaw =
    x["bbox"] && typeof x["bbox"] === "object" ? (x["bbox"] as Record<string, unknown>) : undefined;
  const point = pointRaw
    ? { x: clamp01(finite(pointRaw["x"])), y: clamp01(finite(pointRaw["y"])) }
    : undefined;
  const bbox = boxRaw
    ? {
        x: clamp01(finite(boxRaw["x"])),
        y: clamp01(finite(boxRaw["y"])),
        w: clamp01(finite(boxRaw["w"])),
        h: clamp01(finite(boxRaw["h"])),
      }
    : undefined;
  return {
    id: str(x["id"]) || uid(),
    label: str(x["label"]) || "target",
    type,
    imageId,
    point,
    bbox,
    confidence: Number.isFinite(x["confidence"]) ? Number(x["confidence"]) : undefined,
  };
}

function migrateMovement(raw: unknown): Movement | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const x = raw as Record<string, unknown>;
  const targetId = str(x["targetId"]);
  const from =
    x["from"] && typeof x["from"] === "object" ? (x["from"] as Record<string, unknown>) : undefined;
  const to =
    x["to"] && typeof x["to"] === "object" ? (x["to"] as Record<string, unknown>) : undefined;
  if (!targetId || !from || !to) return undefined;
  return {
    id: str(x["id"]) || uid(),
    targetId,
    from: { x: clamp01(finite(from["x"])), y: clamp01(finite(from["y"])) },
    to: { x: clamp01(finite(to["x"])), y: clamp01(finite(to["y"])) },
  };
}

function migrateStep(raw: unknown): EditStep | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const x = raw as Record<string, unknown>;
  const operation = OPERATIONS.includes(x["operation"] as never)
    ? (x["operation"] as EditStep["operation"])
    : undefined;
  if (!operation) return undefined;
  const migratedAttr = migrateAttrName(x["sourceAttribute"], undefined, operation)[0];
  return {
    id: str(x["id"]) || uid(),
    operation,
    targetScope: x["targetScope"] === "canvas" ? "canvas" : undefined,
    targetId: str(x["targetId"]),
    targetText: str(x["targetText"]),
    sourceImageId: str(x["sourceImageId"]),
    sourceAttribute: migratedAttr,
    destination: str(x["destination"]),
    scale: str(x["scale"]),
    orientation: str(x["orientation"]),
    textContent: str(x["textContent"]),
    exactSpelling: typeof x["exactSpelling"] === "boolean" ? x["exactSpelling"] : undefined,
    instructions: str(x["instructions"]),
  };
}

function migrateBlocks(raw: unknown): ProjectState["blocks"] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<BlockId>();
  const out: ProjectState["blocks"] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const x = v as Record<string, unknown>;
    if (!blockSet.has(String(x["id"]))) continue;
    const id = x["id"] as BlockId;
    if (seen.has(id)) continue;
    seen.add(id);
    const generated = str(x["generated"]) ?? str(x["text"]) ?? "";
    out.push({
      id,
      title: BLOCK_META[id].title,
      text: str(x["text"]) ?? generated,
      generated,
      enabled: bool(x["enabled"], true),
      locked: bool(x["locked"]),
      edited: bool(x["edited"]),
    });
  }
  return out;
}

function migrateBlockOrder(raw: unknown): BlockId[] {
  const valid = Array.isArray(raw)
    ? uniq(raw.filter((x): x is BlockId => typeof x === "string" && blockSet.has(x)))
    : [];
  return [...valid, ...DEFAULT_ORDER.filter((x) => !valid.includes(x))];
}

export function parseProjectImport(
  input: unknown,
  defaults: ProjectState,
  baseRules = true,
): ProjectState {
  const parsed = projectEnvelope.safeParse(input);
  if (!parsed.success) throw new Error("Not a valid Qwen Prompt Studio project file.");
  const raw = parsed.data as Record<string, unknown>;
  const rawImages = Array.isArray(raw["images"]) ? raw["images"] : [];
  const images = rawImages.slice(0, 10).map(migrateImage);
  const attributeMatrix = migrateMatrix(
    (raw["attributeMatrix"] && typeof raw["attributeMatrix"] === "object"
      ? raw["attributeMatrix"]
      : {}) as Record<string, unknown>,
    baseRules,
  );
  const operation = OPERATIONS.includes(raw["operation"] as never)
    ? (raw["operation"] as ProjectState["operation"])
    : defaults.operation;
  const promptLevel = ["simple", "advanced", "expert"].includes(String(raw["promptLevel"]))
    ? (raw["promptLevel"] as ProjectState["promptLevel"])
    : defaults.promptLevel;
  const metadataRaw =
    raw["metadata"] && typeof raw["metadata"] === "object"
      ? (raw["metadata"] as Record<string, unknown>)
      : {};

  const project: ProjectState = {
    ...defaults,
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: parsed.data.projectId,
    name: str(raw["name"]) || defaults.name,
    createdAt: finite(raw["createdAt"], defaults.createdAt),
    updatedAt: finite(raw["updatedAt"], Date.now()),
    operation,
    promptLevel,
    userInstruction: str(raw["userInstruction"]) ?? "",
    images,
    selectedBaseImageId: str(raw["selectedBaseImageId"]),
    targets: (Array.isArray(raw["targets"]) ? raw["targets"] : [])
      .map(migrateTarget)
      .filter(Boolean) as Target[],
    movements: (Array.isArray(raw["movements"]) ? raw["movements"] : [])
      .map(migrateMovement)
      .filter(Boolean) as Movement[],
    editSteps: (Array.isArray(raw["editSteps"]) ? raw["editSteps"] : [])
      .map(migrateStep)
      .filter(Boolean) as EditStep[],
    attributeMatrix,
    identityOverride: bool(raw["identityOverride"]),
    blocks: migrateBlocks(raw["blocks"]),
    blockOrder: migrateBlockOrder(raw["blockOrder"]),
    refinedPrompt: str(raw["refinedPrompt"]),
    lastCompiledHash: str(raw["lastCompiledHash"]),
    isPromptDirty: true,
    issues: [],
    scores: [],
    metadata: {
      model: str(metadataRaw["model"]) || defaults.metadata.model,
      // Preserve an old compiler version. The store will force a rebuild rather
      // than pretending imported blocks were produced by the current compiler.
      compilerVersion: str(metadataRaw["compilerVersion"]) || "legacy",
      promptFormat: ["natural", "structured", "comfyui", "single_line", "technical"].includes(
        String(metadataRaw["promptFormat"]),
      )
        ? (metadataRaw["promptFormat"] as ProjectState["metadata"]["promptFormat"])
        : undefined,
      templateId: str(metadataRaw["templateId"]),
      wordingVariant: str(metadataRaw["wordingVariant"]) || defaults.metadata.wordingVariant,
    },
  };

  const imageIds = new Set(project.images.map((i) => i.id));
  if (project.selectedBaseImageId && !imageIds.has(project.selectedBaseImageId))
    project.selectedBaseImageId = undefined;
  for (const a of ATTRIBUTES) {
    const src = project.attributeMatrix[a].sourceImageId;
    if (src && !imageIds.has(src)) project.attributeMatrix[a] = { state: "FREE" };
  }

  // Migration drops broken graph edges instead of allowing malformed imports to
  // crash the UI. The validator then handles semantic conflicts that remain.
  const targetIds = new Set(
    project.targets.filter((t) => imageIds.has(t.imageId)).map((t) => t.id),
  );
  project.targets = project.targets.filter((t) => imageIds.has(t.imageId));
  project.movements = project.movements.filter((m) => targetIds.has(m.targetId));
  project.editSteps = project.editSteps.map((e) => ({
    ...e,
    sourceImageId: e.sourceImageId && imageIds.has(e.sourceImageId) ? e.sourceImageId : undefined,
    targetId: e.targetId && targetIds.has(e.targetId) ? e.targetId : undefined,
  }));
  return project;
}

export const SettingsImportSchema = z
  .object({
    theme: z.enum(["dark", "light"]).optional(),
    density: z.enum(["compact", "comfortable"]).optional(),
    autosave: z.boolean().optional(),
    defaultLevel: z.enum(["simple", "advanced", "expert"]).optional(),
    baseRules: z.boolean().optional(),
  })
  .passthrough();

export const BackupEnvelopeSchema = z.record(z.unknown());

export function validateProjectImportEnvelope(input: unknown): void {
  if (!projectEnvelope.safeParse(input).success)
    throw new Error("Backup contains an invalid project payload.");
}

export const ModelsImportSchema = z
  .object({
    active: z.enum(["manual", "lmstudio", "openai", "qwen_pe", "custom_vision"]).optional(),
    providers: z.record(z.unknown()).optional(),
  })
  .passthrough();
