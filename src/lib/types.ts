export type PromptLevel = "simple" | "advanced" | "expert";
export type Importance = "Low" | "Medium" | "High" | "Critical";
export type AttrState = "LOCK" | "REPLACE" | "FREE" | "IGNORE";

export const PROJECT_SCHEMA_VERSION = 2 as const;

export const OPERATIONS = [
  "REPLACE",
  "MOVE",
  "ADD",
  "REMOVE",
  "CHANGE",
  "TRANSFER",
  "SWAP",
  "RESIZE",
  "REPOSITION",
  "RESTYLE",
  "BACKGROUND",
  "COMPOSITE",
  "IDENTITY",
  "EXPRESSION",
  "WARDROBE",
  "POSE",
  "TEXT_LOGO",
  "INPAINT",
  "CUSTOM",
] as const;
export type Operation = (typeof OPERATIONS)[number];

export const ROLES = [
  "Base Canvas",
  "Identity",
  "Face Identity",
  "Expression",
  "Wardrobe",
  "Pose",
  "Body",
  "Hairstyle",
  "Background",
  "Object",
  "Product",
  "Style",
  "Lighting",
  "Composition",
  "Texture",
  "Logo/Text",
  "Mask",
  "Spatial Guide",
  "Unused",
  "Custom",
] as const;
export type Role = (typeof ROLES)[number];

/**
 * Attribute ontology deliberately separates body appearance from body placement.
 * Pose references may transfer pose/body_position without changing body shape/proportions.
 */
export const ATTRIBUTES = [
  "face_identity",
  "expression",
  "hair",
  "body_shape",
  "body_proportions",
  "body_position",
  "pose",
  "hands",
  "clothing",
  "shoes",
  "accessories",
  "background",
  "lighting",
  "camera",
  "composition",
  "texture",
  "style",
  "text_logo",
  "objects",
] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export interface ImageAnalysis {
  subjects: {
    id: string;
    type: string;
    position?: string | undefined;
    pose?: string | undefined;
    clothing?: string[] | undefined;
  }[];
  camera?: { shot?: string | undefined; angle?: string | undefined } | undefined;
  environment?: string | undefined;
  lighting?: string | undefined;
  objects?: string[] | undefined;
  suggestedTargets?: string[] | undefined;
}

export interface RefImage {
  id: string;
  tag: string;
  filename: string;
  width: number;
  height: number;
  /** Original + preview live in IndexedDB. ProjectState stores only this asset id. */
  assetId?: string | undefined;
  /** Legacy migration fallback. New uploads never store image bytes in ProjectState. */
  dataUrl?: string | undefined;
  mimeType?: string | undefined;
  role: Role;
  customRole?: string | undefined;
  importance: Importance;
  description?: string | undefined;
  analysis?: ImageAnalysis | undefined;
  uses: Attribute[];
  excludes: Attribute[];
  locks: Attribute[];
}

export type TargetType = "point" | "box" | "vision_proposal";
export interface Target {
  id: string;
  label: string;
  type: TargetType;
  imageId: string;
  point?: { x: number; y: number } | undefined;
  bbox?: { x: number; y: number; w: number; h: number } | undefined;
  confidence?: number | undefined;
}

export interface Movement {
  id: string;
  targetId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

export interface EditStep {
  id: string;
  operation: Operation;
  /** Targets the whole selected base canvas without requiring a drawn region. */
  targetScope?: "canvas" | undefined;
  targetId?: string | undefined;
  targetText?: string | undefined;
  sourceImageId?: string | undefined;
  sourceAttribute?: Attribute | undefined;
  destination?: string | undefined;
  scale?: string | undefined;
  orientation?: string | undefined;
  textContent?: string | undefined;
  exactSpelling?: boolean | undefined;
  instructions?: string | undefined;
}

export interface AttrEntry {
  state: AttrState;
  sourceImageId?: string | undefined;
}
export type AttributeMatrix = Record<Attribute, AttrEntry>;

export type BlockId =
  | "operation"
  | "canvas"
  | "roles"
  | "targets"
  | "spatial"
  | "transfer"
  | "preservation"
  | "integration"
  | "reconstruction"
  | "consistency";

export interface PromptBlock {
  id: BlockId;
  title: string;
  text: string;
  generated: string;
  enabled: boolean;
  locked: boolean;
  edited: boolean;
}

export type Severity = "error" | "warning" | "info";
export interface ValidationIssue {
  id: string;
  severity: Severity;
  message: string;
  focus?: string | undefined;
}

export interface DiagnosticScore {
  key: string;
  label: string;
  value: number;
  deductions: { reason: string; points: number }[];
}

export type QwenPromptFormat = "natural" | "structured" | "comfyui" | "single_line" | "technical";

export interface ProjectState {
  schemaVersion: typeof PROJECT_SCHEMA_VERSION;
  projectId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  operation: Operation;
  promptLevel: PromptLevel;
  userInstruction: string;
  images: RefImage[];
  selectedBaseImageId?: string | undefined;
  targets: Target[];
  movements: Movement[];
  editSteps: EditStep[];
  attributeMatrix: AttributeMatrix;
  identityOverride: boolean;
  blocks: PromptBlock[];
  blockOrder: BlockId[];
  refinedPrompt?: string | undefined;
  /** Hash of the compiler-relevant structured state used for the last build. */
  lastCompiledHash?: string | undefined;
  isPromptDirty: boolean;
  issues: ValidationIssue[];
  scores: DiagnosticScore[];
  metadata: {
    model: string;
    compilerVersion: string;
    templateId?: string | undefined;
    wordingVariant?: string | undefined;
    promptFormat?: QwenPromptFormat | undefined;
  };
}
