import { ATTR_PHRASE, ATTR_SHORT, stepAttrs, type WordingVariant } from "../constants";
import type { Attribute, EditStep, Operation, ProjectState, PromptLevel, RefImage } from "../types";
import { ATTRIBUTES } from "../types";

export const PRESERVE_ORDER: Attribute[] = [
  "pose",
  "body_position",
  "body_shape",
  "body_proportions",
  "hands",
  "camera",
  "composition",
  "background",
  "lighting",
  "face_identity",
  "expression",
  "hair",
  "clothing",
  "shoes",
  "accessories",
  "texture",
  "style",
  "text_logo",
  "objects",
];

export const COMPILER_VERSION = "qwen-pc-2.1";

export const list = (xs: string[], conj = "and") =>
  xs.length <= 1
    ? xs.join("")
    : xs.length === 2
      ? `${xs[0]} ${conj} ${xs[1]}`
      : `${xs.slice(0, -1).join(", ")} ${conj} ${xs[xs.length - 1]}`;

export function describePos(x: number, y: number): string {
  const h = x < 0.36 ? "left" : x > 0.64 ? "right" : "center";
  const v = y < 0.36 ? "upper" : y > 0.64 ? "lower" : "middle";
  if (h === "center" && v === "middle") return "near the center of the frame";
  if (v === "middle") return `on the ${h} side of the frame`;
  if (h === "center") return `in the ${v} center of the frame`;
  return `in the ${v}-${h} area of the frame`;
}
export function describeDelta(dx: number, dy: number) {
  const parts: string[] = [];
  if (Math.abs(dx) > 0.05) parts.push(dx > 0 ? "to the right" : "to the left");
  if (Math.abs(dy) > 0.05) parts.push(dy > 0 ? "downward" : "upward");
  return parts.length ? parts.join(" and ") : "slightly";
}

export interface Ctx {
  s: ProjectState;
  level: PromptLevel;
  base: RefImage | undefined;
  B: string;
  tag: (id?: string) => string;
  variant: WordingVariant;
}

export function makeCtx(s: ProjectState): Ctx {
  const base = s.images.find((i) => i.id === s.selectedBaseImageId);
  const tag = (id?: string) =>
    s.images.find((i) => i.id === id)?.tag ?? "the assigned reference image";
  const variant = (s.metadata.wordingVariant as WordingVariant) || "Replace";
  return { s, level: s.promptLevel, base, B: base?.tag ?? "the input image", tag, variant };
}

export function targetName(c: Ctx, step: EditStep): string {
  const t = c.s.targets.find((x) => x.id === step.targetId);
  return (
    step.targetText?.trim() ||
    (step.targetScope === "canvas" ? `the entire canvas of ${c.B}` : t?.label) ||
    "the selected target"
  );
}

/** User-edited image exclusions are authoritative. Presets only initialize these arrays. */
export function sourceExclusions(s: ProjectState, imgId: string): Attribute[] {
  const img = s.images.find((i) => i.id === imgId);
  if (!img) return [];
  const transferredHere = new Set([
    ...ATTRIBUTES.filter(
      (a) =>
        s.attributeMatrix[a].state === "REPLACE" && s.attributeMatrix[a].sourceImageId === imgId,
    ),
    ...s.editSteps.filter((e) => e.sourceImageId === imgId).flatMap(stepAttrs),
  ]);
  return Array.from(new Set(img.excludes)).filter((a) => !transferredHere.has(a));
}

export const excl = (s: ProjectState, imgId: string, tag: string, level: PromptLevel) => {
  if (level === "simple") return "";
  const ex = sourceExclusions(s, imgId);
  return ex.length
    ? ` Do not transfer ${list(
        ex.map((a) => ATTR_SHORT[a]),
        "or",
      )} from ${tag}.`
    : "";
};

const WORDING: Record<WordingVariant, Partial<Record<Operation, string>>> = {
  Replace: {
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
    BACKGROUND: "Replace",
    COMPOSITE: "Composite",
    IDENTITY: "Replace",
    EXPRESSION: "Change",
    WARDROBE: "Replace",
    POSE: "Re-pose",
    TEXT_LOGO: "Replace",
    INPAINT: "Inpaint",
    CUSTOM: "Edit",
  },
  Transfer: {
    REPLACE: "Transfer into",
    MOVE: "Relocate",
    ADD: "Transfer and place",
    REMOVE: "Remove",
    CHANGE: "Transform",
    TRANSFER: "Transfer",
    SWAP: "Exchange",
    RESIZE: "Rescale",
    REPOSITION: "Relocate",
    RESTYLE: "Transfer the style to",
    BACKGROUND: "Transfer the environment from",
    COMPOSITE: "Transfer and composite",
    IDENTITY: "Transfer",
    EXPRESSION: "Transfer",
    WARDROBE: "Transfer",
    POSE: "Transfer",
    TEXT_LOGO: "Transfer/replace",
    INPAINT: "Reconstruct",
    CUSTOM: "Transfer/edit",
  },
  Dress: {
    REPLACE: "Substitute",
    MOVE: "Place",
    ADD: "Place",
    REMOVE: "Clear",
    CHANGE: "Adjust",
    TRANSFER: "Apply",
    SWAP: "Swap",
    RESIZE: "Scale",
    REPOSITION: "Place",
    RESTYLE: "Style",
    BACKGROUND: "Set the background from",
    COMPOSITE: "Place and blend",
    IDENTITY: "Apply",
    EXPRESSION: "Apply",
    WARDROBE: "Dress",
    POSE: "Pose",
    TEXT_LOGO: "Set",
    INPAINT: "Fill",
    CUSTOM: "Apply",
  },
  Apply: {
    REPLACE: "Apply the replacement to",
    MOVE: "Apply a move to",
    ADD: "Apply/add",
    REMOVE: "Apply removal to",
    CHANGE: "Apply the requested change to",
    TRANSFER: "Apply",
    SWAP: "Apply a swap to",
    RESIZE: "Apply a resize to",
    REPOSITION: "Apply a reposition to",
    RESTYLE: "Apply the style to",
    BACKGROUND: "Apply the background from",
    COMPOSITE: "Apply and composite",
    IDENTITY: "Apply",
    EXPRESSION: "Apply",
    WARDROBE: "Apply",
    POSE: "Apply",
    TEXT_LOGO: "Apply/replace",
    INPAINT: "Apply inpainting to",
    CUSTOM: "Apply the edit to",
  },
  Swap: {
    REPLACE: "Swap in",
    MOVE: "Shift",
    ADD: "Insert",
    REMOVE: "Erase",
    CHANGE: "Modify",
    TRANSFER: "Bring over",
    SWAP: "Swap",
    RESIZE: "Resize",
    REPOSITION: "Shift",
    RESTYLE: "Swap the style of",
    BACKGROUND: "Swap the background with",
    COMPOSITE: "Insert and blend",
    IDENTITY: "Swap in",
    EXPRESSION: "Swap in",
    WARDROBE: "Swap in",
    POSE: "Swap in",
    TEXT_LOGO: "Swap in",
    INPAINT: "Repair",
    CUSTOM: "Modify",
  },
};

export function opVerb(op: Operation, variant: WordingVariant): string {
  return WORDING[variant][op] ?? WORDING.Replace[op] ?? op.toLowerCase();
}

export function stepSentence(c: Ctx, st: EditStep): string {
  const { s, level, B } = c;
  const src = st.sourceImageId ? c.tag(st.sourceImageId) : undefined;
  const S = src ?? "the assigned reference image";
  const T = targetName(c, st);
  const extra = st.instructions?.trim()
    ? ` ${st.instructions.trim().replace(/([^.])$/, "$1.")}`
    : "";
  const ex = st.sourceImageId ? excl(s, st.sourceImageId, S, level) : "";
  const verb = opVerb(st.operation, c.variant);

  switch (st.operation) {
    case "WARDROBE": {
      const lead =
        c.variant === "Dress"
          ? `Dress the subject in only the complete outfit shown in ${S}`
          : `${verb} only the complete wardrobe from ${S}`;
      return level === "simple"
        ? `${lead}.${extra}`
        : `${lead}, including garment design, colors, materials, fit, shoes and accessories.${ex}${extra}`;
    }
    case "IDENTITY":
      return level === "simple"
        ? `${verb} the face using ${S}.${extra}`
        : `${verb} facial identity from ${S}. Preserve recognizable facial features while adapting them naturally to the base head angle, expression constraints and scene lighting.${ex}${extra}`;
    case "EXPRESSION": {
      const idSrc =
        s.attributeMatrix.face_identity.state === "REPLACE"
          ? c.tag(s.attributeMatrix.face_identity.sourceImageId)
          : B;
      return level === "simple"
        ? `${verb} the facial expression to match ${S}.${extra}`
        : `${verb} the facial expression from ${S} — mouth shape, eye openness, brow position and cheek tension — while preserving facial identity from ${idSrc}.${ex}${extra}`;
    }
    case "POSE":
      return `${verb} the subject to match the pose and body position shown in ${S}, while preserving body shape and body proportions unless separately assigned.${ex}${extra}`;
    case "BACKGROUND":
      return `${verb} ${S} while keeping the base subject and foreground relationships intact.${ex}${extra}`;
    case "RESTYLE":
      return `${verb} ${st.targetScope === "canvas" ? T : st.targetText || "the image"}${src ? ` using ${S}` : ""}.${src ? ex : ""}${extra}`;
    case "MOVE": {
      const mv = s.movements.find((m) => m.targetId === st.targetId);
      const from = mv ? describePos(mv.from.x, mv.from.y) : "its current position";
      const to =
        st.destination?.trim() ||
        (mv ? describePos(mv.to.x, mv.to.y) : "the specified destination");
      const sc = st.scale ? ` at ${st.scale} scale` : "";
      return level === "simple"
        ? `${verb} ${T} from ${from} to ${to}.${extra}`
        : `${verb} ${T} from ${from} to ${to}${sc}. Preserve the exact identity, design, color and material of ${T}.${extra}`;
    }
    case "REMOVE":
      return `${verb} ${T} completely from ${B}.${extra}`;
    case "RESIZE":
      return `${verb} ${T} to ${st.scale || "the requested size"}, keeping its design, internal proportions and intended anchor point.${extra}`;
    case "REPOSITION":
      return `${verb} ${T} to ${st.destination || "the specified position"}${st.orientation ? `, oriented ${st.orientation}` : ""}.${extra}`;
    case "ADD":
    case "COMPOSITE": {
      const what = src
        ? `the ${st.sourceAttribute ? ATTR_PHRASE[st.sourceAttribute] : "subject/object"} from ${S}`
        : T;
      const where = st.destination ? ` ${st.destination}` : " at the specified destination";
      const sc = st.scale ? ` at ${st.scale} relative scale` : "";
      return `${verb} ${what} into ${B}${where}${sc}.${ex}${extra}`;
    }
    case "TEXT_LOGO": {
      const txt = st.textContent?.trim();
      const sp = txt
        ? ` with the text "${txt}"${st.exactSpelling ? ", preserving this exact spelling, capitalization and punctuation" : ""}`
        : "";
      return `${verb} ${T}${sp}${st.destination ? ` at ${st.destination}` : ""}, matching perspective and surface integration.${extra}`;
    }
    case "INPAINT":
      return `${verb} only inside ${T}${src ? ` using ${S} as reference` : ""}; leave everything outside this region pixel-consistent.${ex}${extra}`;
    case "REPLACE":
    case "TRANSFER":
    case "SWAP":
    case "CHANGE":
    case "CUSTOM": {
      const attr = st.sourceAttribute ? ATTR_PHRASE[st.sourceAttribute] : undefined;
      if (!src) return `${verb} ${T}${attr ? ` (${attr})` : ""}.${extra}`;
      return `${verb} ${T} using ${attr ? `only the ${attr} from ` : ""}${S}.${ex}${extra}`;
    }
  }
}

export function needsResizeReconstruction(scale?: string): boolean {
  if (!scale) return false;
  const t = scale.toLowerCase();
  if (/smaller|shrink|reduce|0\.[0-9]|[1-9][0-9]?%/.test(t)) return true;
  const m = t.match(/([0-9.]+)x/);
  return !!m && Number(m[1]) < 1;
}
