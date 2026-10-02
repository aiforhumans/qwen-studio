import { COMPILER_VERSION, compileBlocks, compilerInputHash } from "./compiler";
import { DEFAULT_ORDER, ROLE_POLICIES, defaultMatrix } from "./constants";
import { analyze } from "./project-transitions";
import { getSettings } from "./storage";
import type { EditStep, ProjectState, RefImage, Role } from "./types";
import { PROJECT_SCHEMA_VERSION } from "./types";
export const uid = () => Math.random().toString(36).slice(2, 10);

export function retag(images: RefImage[]): RefImage[] {
  return images.map((im, i) => ({ ...im, tag: `<image${i + 1}>` }));
}

export function emptyProject(): ProjectState {
  const settings = getSettings();
  const p: ProjectState = {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    projectId: uid(),
    name: "Untitled project",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    operation: "REPLACE",
    promptLevel: settings.defaultLevel,
    userInstruction: "",
    images: [],
    targets: [],
    movements: [],
    editSteps: [],
    attributeMatrix: defaultMatrix(settings.baseRules),
    identityOverride: false,
    blocks: [],
    blockOrder: DEFAULT_ORDER,
    issues: [],
    scores: [],
    isPromptDirty: true,
    metadata: { model: "Manual", compilerVersion: COMPILER_VERSION, wordingVariant: "Replace" },
  };
  return analyze(p);
}

export function demoProject(): ProjectState {
  const img = (n: number, role: Role, filename: string, description: string): RefImage => ({
    id: `demo${n}`,
    tag: `<image${n}>`,
    filename,
    width: 1024,
    height: 1536,
    role,
    importance: n === 1 ? "Critical" : "High",
    description,
    uses: [...ROLE_POLICIES[role].defaultTransfers],
    excludes: [...ROLE_POLICIES[role].defaultExclusions],
    locks: [],
  });
  const images = [
    img(1, "Base Canvas", "base_portrait.jpg", "Standing subject, full body, studio"),
    img(2, "Wardrobe", "outfit_ref.jpg", "Navy wool coat, white shirt, loafers"),
    img(3, "Face Identity", "face_ref.jpg", "Frontal face, neutral light"),
  ];
  const m = defaultMatrix(true);
  m.clothing = { state: "REPLACE", sourceImageId: "demo2" };
  m.shoes = { state: "REPLACE", sourceImageId: "demo2" };
  m.accessories = { state: "REPLACE", sourceImageId: "demo2" };
  m.face_identity = { state: "REPLACE", sourceImageId: "demo3" };
  m.expression = { state: "LOCK" };
  const steps: EditStep[] = [
    {
      id: uid(),
      operation: "WARDROBE",
      sourceImageId: "demo2",
      targetText: "the subject's complete wardrobe",
    },
    { id: uid(), operation: "IDENTITY", sourceImageId: "demo3", targetText: "the subject's face" },
  ];
  let p: ProjectState = {
    ...emptyProject(),
    name: "Demo: Outfit + Face",
    operation: "WARDROBE",
    promptLevel: "advanced",
    images,
    selectedBaseImageId: "demo1",
    attributeMatrix: m,
    editSteps: steps,
    userInstruction: "",
  };
  p = { ...p, blocks: compileBlocks(p) };
  p.lastCompiledHash = compilerInputHash(p);
  return analyze(p);
}
