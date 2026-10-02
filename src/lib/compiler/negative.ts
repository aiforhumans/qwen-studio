import type { ProjectState } from "../types";
/**
 * Generates an edit-specific negative prompt for Qwen 2.1 Image Edit.
 * Filters out common diffusion artifacts, identity bleeding, garment clipping, seam boundaries, and distortion.
 */
export function compileQwen21NegativePrompt(s: ProjectState): string {
  const parts = [
    "deformed",
    "bad anatomy",
    "distorted",
    "blurry",
    "low quality",
    "artifacts",
    "extra limbs",
    "missing fingers",
    "bad hands",
    "watermark",
  ];
  const ops = new Set([s.operation, ...s.editSteps.map((e) => e.operation)]);
  const m = s.attributeMatrix;

  if (ops.has("IDENTITY") || m.face_identity?.state === "REPLACE" || ops.has("EXPRESSION")) {
    parts.push(
      "distorted face",
      "double face",
      "plastic skin",
      "mismatched skin tone",
      "unnatural eyes",
      "disfigured facial features",
    );
  }
  if (
    ops.has("WARDROBE") ||
    m.clothing?.state === "REPLACE" ||
    m.shoes?.state === "REPLACE" ||
    m.accessories?.state === "REPLACE"
  ) {
    parts.push(
      "garment clipping",
      "distorted clothing",
      "floating fabric",
      "altered body shape",
      "mismatched fabric",
    );
  }
  if (ops.has("MOVE") || ops.has("REMOVE") || ops.has("REPOSITION") || ops.has("RESIZE")) {
    parts.push(
      "ghosting",
      "duplicate objects",
      "floating artifacts",
      "boundary seams",
      "incomplete removal",
      "blur in vacated area",
    );
  }
  if (ops.has("BACKGROUND") || m.background?.state === "REPLACE") {
    parts.push(
      "halo effect",
      "cut-out edges",
      "mismatched shadows",
      "inconsistent lighting",
      "flat background",
    );
  }
  if (ops.has("POSE") || m.pose?.state === "REPLACE" || m.body_position?.state === "REPLACE") {
    parts.push("unnatural limb bend", "broken joints", "distorted proportions", "awkward posture");
  }
  if (ops.has("TEXT_LOGO") || m.text_logo?.state === "REPLACE") {
    parts.push(
      "misspelled text",
      "warped font",
      "illegible letters",
      "fuzzy typography",
      "gibberish",
    );
  }
  if (ops.has("RESTYLE") || m.style?.state === "REPLACE" || m.texture?.state === "REPLACE") {
    parts.push("noisy texture", "color banding", "overexposed", "muddy colors");
  }

  return parts.join(", ");
}
