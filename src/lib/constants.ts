import type {
  Attribute,
  AttributeMatrix,
  AttrState,
  BlockId,
  EditStep,
  Operation,
  Role,
} from "./types";
import { ATTRIBUTES } from "./types";

export const ATTR_LABEL: Record<Attribute, string> = {
  face_identity: "Face Identity",
  expression: "Expression",
  hair: "Hair",
  body_shape: "Body Shape",
  body_proportions: "Body Proportions",
  body_position: "Body Position",
  pose: "Pose",
  hands: "Hands",
  clothing: "Clothing",
  shoes: "Shoes",
  accessories: "Accessories",
  background: "Background",
  lighting: "Lighting",
  camera: "Camera",
  composition: "Composition",
  texture: "Texture",
  style: "Style",
  text_logo: "Text/Logo",
  objects: "Objects",
};

export const ATTR_PHRASE: Record<Attribute, string> = {
  face_identity: "facial identity",
  expression: "facial expression",
  hair: "hairstyle and hair color",
  body_shape: "body shape",
  body_proportions: "body proportions",
  body_position: "body position and limb placement",
  pose: "pose",
  hands: "hands and hand placement",
  clothing: "clothing",
  shoes: "shoes",
  accessories: "accessories",
  background: "background",
  lighting: "lighting",
  camera: "camera angle and framing",
  composition: "composition",
  texture: "surface textures",
  style: "visual style",
  text_logo: "text and logos",
  objects: "objects",
};
export const ATTR_SHORT: Record<Attribute, string> = {
  ...ATTR_PHRASE,
  face_identity: "identity",
  body_shape: "body shape",
  body_proportions: "body proportions",
  body_position: "body position",
  pose: "pose",
  hair: "hair",
  camera: "camera",
  expression: "expression",
};

export const OP_LABEL: Record<Operation, string> = {
  REPLACE: "Replace",
  MOVE: "Move",
  ADD: "Add",
  REMOVE: "Remove",
  CHANGE: "Change",
  TRANSFER: "Transfer",
  SWAP: "Swap",
  RESIZE: "Resize",
  REPOSITION: "Reposition",
  RESTYLE: "Restyle",
  BACKGROUND: "Background",
  COMPOSITE: "Composite",
  IDENTITY: "Identity",
  EXPRESSION: "Expression",
  WARDROBE: "Wardrobe",
  POSE: "Pose",
  TEXT_LOGO: "Text / Logo",
  INPAINT: "Inpaint",
  CUSTOM: "Custom",
};

export interface OperationPolicy {
  needsBase: boolean;
  needsSource: boolean;
  needsTarget: boolean;
  needsDestination: boolean;
  integration: "none" | "appearance" | "spatial" | "surface";
  reconstruction: "none" | "vacated" | "inpaint" | "resize_if_smaller";
}

/** Single source of truth used by both compiler and validator. */
export const OPERATION_POLICY: Record<Operation, OperationPolicy> = {
  REPLACE: {
    needsBase: true,
    needsSource: true,
    needsTarget: true,
    needsDestination: false,
    integration: "appearance",
    reconstruction: "none",
  },
  MOVE: {
    needsBase: true,
    needsSource: false,
    needsTarget: true,
    needsDestination: true,
    integration: "spatial",
    reconstruction: "vacated",
  },
  ADD: {
    needsBase: true,
    needsSource: true,
    needsTarget: false,
    needsDestination: true,
    integration: "spatial",
    reconstruction: "none",
  },
  REMOVE: {
    needsBase: true,
    needsSource: false,
    needsTarget: true,
    needsDestination: false,
    integration: "none",
    reconstruction: "vacated",
  },
  CHANGE: {
    needsBase: true,
    needsSource: false,
    needsTarget: true,
    needsDestination: false,
    integration: "appearance",
    reconstruction: "none",
  },
  TRANSFER: {
    needsBase: true,
    needsSource: true,
    needsTarget: false,
    needsDestination: false,
    integration: "appearance",
    reconstruction: "none",
  },
  SWAP: {
    needsBase: true,
    needsSource: true,
    needsTarget: true,
    needsDestination: false,
    integration: "appearance",
    reconstruction: "none",
  },
  RESIZE: {
    needsBase: true,
    needsSource: false,
    needsTarget: true,
    needsDestination: false,
    integration: "spatial",
    reconstruction: "resize_if_smaller",
  },
  REPOSITION: {
    needsBase: true,
    needsSource: false,
    needsTarget: true,
    needsDestination: true,
    integration: "spatial",
    reconstruction: "vacated",
  },
  RESTYLE: {
    needsBase: true,
    needsSource: true,
    needsTarget: false,
    needsDestination: false,
    integration: "surface",
    reconstruction: "none",
  },
  BACKGROUND: {
    needsBase: true,
    needsSource: true,
    needsTarget: false,
    needsDestination: false,
    integration: "appearance",
    reconstruction: "none",
  },
  COMPOSITE: {
    needsBase: true,
    needsSource: true,
    needsTarget: false,
    needsDestination: true,
    integration: "spatial",
    reconstruction: "none",
  },
  IDENTITY: {
    needsBase: true,
    needsSource: true,
    needsTarget: false,
    needsDestination: false,
    integration: "appearance",
    reconstruction: "none",
  },
  EXPRESSION: {
    needsBase: true,
    needsSource: true,
    needsTarget: false,
    needsDestination: false,
    integration: "appearance",
    reconstruction: "none",
  },
  WARDROBE: {
    needsBase: true,
    needsSource: true,
    needsTarget: false,
    needsDestination: false,
    integration: "appearance",
    reconstruction: "none",
  },
  POSE: {
    needsBase: true,
    needsSource: true,
    needsTarget: false,
    needsDestination: false,
    integration: "appearance",
    reconstruction: "none",
  },
  TEXT_LOGO: {
    needsBase: true,
    needsSource: false,
    needsTarget: true,
    needsDestination: false,
    integration: "surface",
    reconstruction: "none",
  },
  INPAINT: {
    needsBase: true,
    needsSource: false,
    needsTarget: true,
    needsDestination: false,
    integration: "surface",
    reconstruction: "inpaint",
  },
  CUSTOM: {
    needsBase: false,
    needsSource: false,
    needsTarget: false,
    needsDestination: false,
    integration: "appearance",
    reconstruction: "none",
  },
};

export const OP_FIELDS: Record<
  Operation,
  { source?: boolean; attr?: boolean; dest?: boolean; scale?: boolean; text?: boolean }
> = {
  REPLACE: { source: true, attr: true },
  MOVE: { dest: true, scale: true },
  ADD: { source: true, dest: true, scale: true },
  REMOVE: {},
  CHANGE: { source: true, attr: true },
  TRANSFER: { source: true, attr: true },
  SWAP: { source: true, attr: true },
  RESIZE: { scale: true },
  REPOSITION: { dest: true, scale: true },
  RESTYLE: { source: true },
  BACKGROUND: { source: true },
  COMPOSITE: { source: true, dest: true, scale: true },
  IDENTITY: { source: true },
  EXPRESSION: { source: true },
  WARDROBE: { source: true },
  POSE: { source: true },
  TEXT_LOGO: { dest: true, text: true },
  INPAINT: { source: true },
  CUSTOM: { source: true, attr: true, dest: true, scale: true },
};

export function stepAttrs(s: EditStep): Attribute[] {
  switch (s.operation) {
    case "WARDROBE":
      return ["clothing", "shoes", "accessories"];
    case "IDENTITY":
      return ["face_identity"];
    case "EXPRESSION":
      return ["expression"];
    case "POSE":
      return ["pose", "body_position"];
    case "BACKGROUND":
      return ["background"];
    case "RESTYLE":
      return ["style", "texture"];
    case "TEXT_LOGO":
      return ["text_logo"];
    default:
      return s.sourceAttribute ? [s.sourceAttribute] : [];
  }
}

export interface RolePolicy {
  allowedAttributes: Attribute[];
  defaultTransfers: Attribute[];
  defaultExclusions: Attribute[];
  defaultLocks: Attribute[];
}

const rp = (
  defaultTransfers: Attribute[],
  defaultExclusions: Attribute[] = [],
  defaultLocks: Attribute[] = [],
  allowedAttributes: Attribute[] = defaultTransfers,
): RolePolicy => ({ defaultTransfers, defaultExclusions, defaultLocks, allowedAttributes });

/** Canonical role policy. UI presets, compiler role descriptions and automatic matrix mapping derive from this. */
export const ROLE_POLICIES: Record<Role, RolePolicy> = {
  "Base Canvas": rp(
    [],
    [],
    [
      "pose",
      "body_position",
      "body_shape",
      "body_proportions",
      "hands",
      "camera",
      "background",
      "lighting",
      "composition",
    ],
  ),
  Identity: rp(["face_identity", "hair"], ["clothing", "pose", "body_position", "background"]),
  "Face Identity": rp(
    ["face_identity"],
    ["clothing", "body_shape", "body_proportions", "body_position", "pose", "background"],
  ),
  Expression: rp(["expression"], ["face_identity", "clothing", "background"]),
  Wardrobe: rp(
    ["clothing", "shoes", "accessories"],
    [
      "face_identity",
      "body_shape",
      "body_proportions",
      "body_position",
      "pose",
      "background",
      "hair",
    ],
  ),
  Pose: rp(
    ["pose", "body_position"],
    ["face_identity", "body_shape", "body_proportions", "clothing", "background"],
  ),
  Body: rp(
    ["body_shape", "body_proportions"],
    ["face_identity", "clothing", "background", "pose", "body_position"],
  ),
  Hairstyle: rp(["hair"], ["face_identity", "clothing", "background"]),
  Background: rp(
    ["background"],
    ["face_identity", "body_shape", "body_proportions", "body_position", "clothing", "pose"],
  ),
  Object: rp(["objects"], ["background", "lighting"]),
  Product: rp(["objects"], ["background", "lighting", "face_identity"]),
  Style: rp(["style", "texture"], ["face_identity", "composition", "objects"]),
  Lighting: rp(["lighting"], ["face_identity", "clothing", "background", "objects"]),
  Composition: rp(["composition", "camera"], ["face_identity", "clothing"]),
  Texture: rp(["texture"], ["face_identity", "composition"]),
  "Logo/Text": rp(["text_logo"], ["background", "objects"]),
  Mask: rp([], [], [], []),
  "Spatial Guide": rp([], [], [], []),
  Unused: rp([], [...ATTRIBUTES], [], []),
  Custom: rp([], [], [], [...ATTRIBUTES]),
};

/** Backwards-compatible derived view; never edit this separately. */
export const ROLE_PRESETS: Record<Role, { uses: Attribute[]; excludes: Attribute[] }> =
  Object.fromEntries(
    Object.entries(ROLE_POLICIES).map(([role, p]) => [
      role,
      { uses: p.defaultTransfers, excludes: p.defaultExclusions },
    ]),
  ) as Record<Role, { uses: Attribute[]; excludes: Attribute[] }>;

export const roleTransferAttrs = (role: Role): Attribute[] => ROLE_POLICIES[role].defaultTransfers;

export function defaultMatrix(baseRules = true): AttributeMatrix {
  const m = {} as AttributeMatrix;
  for (const a of ATTRIBUTES) m[a] = { state: "FREE" };
  if (baseRules) {
    for (const a of ROLE_POLICIES["Base Canvas"].defaultLocks) m[a] = { state: "LOCK" };
  }
  return m;
}

export const STATE_COLS: AttrState[] = ["LOCK", "REPLACE", "FREE", "IGNORE"];

export const BLOCK_META: Record<BlockId, { title: string; color: string }> = {
  operation: { title: "Operation", color: "oklch(0.76 0.13 220)" },
  canvas: { title: "Canvas", color: "oklch(0.72 0.12 250)" },
  roles: { title: "Reference Roles", color: "oklch(0.74 0.12 290)" },
  targets: { title: "Target Changes", color: "oklch(0.78 0.14 75)" },
  spatial: { title: "Spatial / Geometric Rules", color: "oklch(0.75 0.13 40)" },
  transfer: { title: "Attribute Transfer Rules", color: "oklch(0.78 0.13 100)" },
  preservation: { title: "Preservation Constraints", color: "oklch(0.72 0.12 210)" },
  integration: { title: "Physical Integration", color: "oklch(0.74 0.13 155)" },
  reconstruction: { title: "Exposed-Region Reconstruction", color: "oklch(0.72 0.12 180)" },
  consistency: { title: "Final Consistency Check", color: "oklch(0.7 0.02 250)" },
};
export const DEFAULT_ORDER: BlockId[] = [
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
];

export const WORDING_VARIANTS = ["Replace", "Transfer", "Dress", "Apply", "Swap"] as const;
export type WordingVariant = (typeof WORDING_VARIANTS)[number];

export interface Template {
  id: string;
  name: string;
  description: string;
  operation: Operation;
  slots: Role[];
  matrix: Partial<Record<Attribute, AttrState>>;
  replaceFromSlot?: Partial<Record<Attribute, number>>;
  steps: Partial<EditStep & { sourceSlot?: number }>[];
}

const L = "LOCK" as const,
  R = "REPLACE" as const,
  F = "FREE" as const;
export const TEMPLATES: Template[] = [
  {
    id: "outfit",
    name: "Outfit Transfer",
    description: "Dress the base subject in the outfit from a wardrobe reference.",
    operation: "WARDROBE",
    slots: ["Base Canvas", "Wardrobe"],
    matrix: {
      clothing: R,
      shoes: R,
      accessories: R,
      face_identity: L,
      pose: L,
      body_position: L,
      body_shape: L,
      body_proportions: L,
      hands: L,
      background: L,
      lighting: L,
      camera: L,
    },
    replaceFromSlot: { clothing: 1, shoes: 1, accessories: 1 },
    steps: [{ operation: "WARDROBE", sourceSlot: 1 }],
  },
  {
    id: "face",
    name: "Face Replacement",
    description: "Replace facial identity from one identity reference.",
    operation: "IDENTITY",
    slots: ["Base Canvas", "Face Identity"],
    matrix: {
      face_identity: R,
      expression: L,
      hair: L,
      pose: L,
      body_position: L,
      body_shape: L,
      body_proportions: L,
      clothing: L,
      background: L,
      lighting: L,
      camera: L,
    },
    replaceFromSlot: { face_identity: 1 },
    steps: [{ operation: "IDENTITY", sourceSlot: 1 }],
  },
  {
    id: "id-expr",
    name: "Identity + Expression Split",
    description: "Identity from one image, expression from another.",
    operation: "IDENTITY",
    slots: ["Base Canvas", "Face Identity", "Expression"],
    matrix: {
      face_identity: R,
      expression: R,
      pose: L,
      body_position: L,
      body_shape: L,
      body_proportions: L,
      clothing: L,
      background: L,
      lighting: L,
      camera: L,
    },
    replaceFromSlot: { face_identity: 1, expression: 2 },
    steps: [
      { operation: "IDENTITY", sourceSlot: 1 },
      { operation: "EXPRESSION", sourceSlot: 2 },
    ],
  },
  {
    id: "pose",
    name: "Pose Transfer",
    description: "Transfer pose and body position without changing body shape or proportions.",
    operation: "POSE",
    slots: ["Base Canvas", "Pose"],
    matrix: {
      pose: R,
      body_position: R,
      body_shape: L,
      body_proportions: L,
      hands: F,
      face_identity: L,
      clothing: L,
      background: L,
      lighting: L,
    },
    replaceFromSlot: { pose: 1, body_position: 1 },
    steps: [{ operation: "POSE", sourceSlot: 1 }],
  },
  {
    id: "bg",
    name: "Background Replacement",
    description: "Swap the environment, keep the subject.",
    operation: "BACKGROUND",
    slots: ["Base Canvas", "Background"],
    matrix: {
      background: R,
      lighting: F,
      face_identity: L,
      pose: L,
      body_position: L,
      body_shape: L,
      body_proportions: L,
      clothing: L,
      camera: L,
    },
    replaceFromSlot: { background: 1 },
    steps: [{ operation: "BACKGROUND", sourceSlot: 1 }],
  },
  {
    id: "product",
    name: "Product Replacement",
    description: "Replace a product with a reference product.",
    operation: "REPLACE",
    slots: ["Base Canvas", "Product"],
    matrix: { objects: R, background: L, lighting: L, camera: L, composition: L },
    replaceFromSlot: { objects: 1 },
    steps: [
      {
        operation: "REPLACE",
        sourceSlot: 1,
        sourceAttribute: "objects",
        targetText: "the product",
      },
    ],
  },
  {
    id: "remove",
    name: "Object Removal",
    description: "Remove a target and reconstruct the area.",
    operation: "REMOVE",
    slots: ["Base Canvas"],
    matrix: { background: L, lighting: L, camera: L, composition: F, objects: F },
    steps: [{ operation: "REMOVE" }],
  },
  {
    id: "move",
    name: "Object Movement",
    description: "Move a target to a new location in the scene.",
    operation: "MOVE",
    slots: ["Base Canvas"],
    matrix: { background: L, lighting: L, camera: L, objects: F },
    steps: [{ operation: "MOVE" }],
  },
  {
    id: "resize",
    name: "Object Resize",
    description: "Scale a target while keeping its design.",
    operation: "RESIZE",
    slots: ["Base Canvas"],
    matrix: { background: L, lighting: L, camera: L },
    steps: [{ operation: "RESIZE", scale: "1.5x larger" }],
  },
  {
    id: "add",
    name: "Object Addition",
    description: "Insert an object from a reference image.",
    operation: "ADD",
    slots: ["Base Canvas", "Object"],
    matrix: { objects: R, background: L, lighting: L, camera: L },
    replaceFromSlot: { objects: 1 },
    steps: [{ operation: "ADD", sourceSlot: 1 }],
  },
  {
    id: "logo",
    name: "Logo/Text Replacement",
    description: "Replace text or a logo with exact spelling.",
    operation: "TEXT_LOGO",
    slots: ["Base Canvas", "Logo/Text"],
    matrix: { text_logo: R, background: L, lighting: L, objects: L },
    replaceFromSlot: { text_logo: 1 },
    steps: [{ operation: "TEXT_LOGO", exactSpelling: true }],
  },
  {
    id: "multi",
    name: "Multi-Person Composition",
    description: "Compose people from several references into one scene.",
    operation: "COMPOSITE",
    slots: ["Base Canvas", "Identity", "Identity"],
    matrix: { background: L, lighting: L, camera: L, face_identity: F },
    steps: [
      { operation: "COMPOSITE", sourceSlot: 1 },
      { operation: "COMPOSITE", sourceSlot: 2 },
    ],
  },
  {
    id: "interior",
    name: "Reference-Based Interior Design",
    description: "Restyle a room using a design reference.",
    operation: "RESTYLE",
    slots: ["Base Canvas", "Style"],
    matrix: { style: R, texture: R, camera: L, composition: L, lighting: F },
    replaceFromSlot: { style: 1, texture: 1 },
    steps: [{ operation: "RESTYLE", sourceSlot: 1 }],
  },
  {
    id: "restyle",
    name: "Character Restyle",
    description: "Apply a visual style while keeping identity.",
    operation: "RESTYLE",
    slots: ["Base Canvas", "Style"],
    matrix: { style: R, texture: R, face_identity: L, pose: L, body_position: L, composition: L },
    replaceFromSlot: { style: 1, texture: 1 },
    steps: [{ operation: "RESTYLE", sourceSlot: 1 }],
  },
  {
    id: "hair",
    name: "Hair Replacement",
    description: "Replace hairstyle only.",
    operation: "REPLACE",
    slots: ["Base Canvas", "Hairstyle"],
    matrix: { hair: R, face_identity: L, clothing: L, background: L, lighting: L },
    replaceFromSlot: { hair: 1 },
    steps: [
      {
        operation: "REPLACE",
        sourceSlot: 1,
        sourceAttribute: "hair",
        targetText: "the subject's hair",
      },
    ],
  },
  {
    id: "light",
    name: "Lighting Transfer",
    description: "Match lighting from a reference.",
    operation: "TRANSFER",
    slots: ["Base Canvas", "Lighting"],
    matrix: { lighting: R, face_identity: L, background: L, composition: L },
    replaceFromSlot: { lighting: 1 },
    steps: [{ operation: "TRANSFER", sourceSlot: 1, sourceAttribute: "lighting" }],
  },
  {
    id: "full",
    name: "Full Multi-Image Composite",
    description: "Base + wardrobe + face + background.",
    operation: "COMPOSITE",
    slots: ["Base Canvas", "Wardrobe", "Face Identity", "Background"],
    matrix: {
      clothing: R,
      shoes: R,
      accessories: R,
      face_identity: R,
      background: R,
      pose: L,
      body_position: L,
      body_shape: L,
      body_proportions: L,
      hands: L,
      camera: L,
      lighting: F,
    },
    replaceFromSlot: { clothing: 1, shoes: 1, accessories: 1, face_identity: 2, background: 3 },
    steps: [
      { operation: "WARDROBE", sourceSlot: 1 },
      { operation: "IDENTITY", sourceSlot: 2 },
      { operation: "BACKGROUND", sourceSlot: 3 },
    ],
  },
];
