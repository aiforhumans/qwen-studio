import type { ProjectState, QwenPromptFormat } from "../types";
import { compileQwen21Prompt } from "./formats";
import { compileQwen21NegativePrompt } from "./negative";
/**
 * Compiles a comprehensive bundle containing positive prompt, negative prompt, and recommended Qwen 2.1 inference settings.
 */
export function compileQwen21Bundle(s: ProjectState, format: QwenPromptFormat = "natural"): string {
  const pos = compileQwen21Prompt(s, format);
  const neg = compileQwen21NegativePrompt(s);
  const base = s.images.find((i) => i.id === s.selectedBaseImageId);
  const refs = s.images.filter((i) => i.id !== base?.id && i.role !== "Unused");
  const refList = refs.length ? refs.map((r) => `${r.tag} (${r.role})`).join(", ") : "None";

  return `=== QWEN 2.1 IMAGE EDIT PROMPT BUNDLE ===

--- POSITIVE PROMPT (${format.toUpperCase()}) ---
${pos}

--- NEGATIVE PROMPT ---
${neg}

--- RECOMMENDED QWEN 2.1 INFERENCE PARAMETERS ---
• Model: Qwen-Image-2.1 (7B Unified)
• Inference Steps: 40
• CFG Scale: 4.0
• Sampler: DPM++ 2M or Euler
• Base Canvas Input: ${base ? `${base.tag} (${base.filename || "Base Image"})` : "Input Image"}
• Reference Inputs: ${refList}
• Aspect Ratio / Resolution: Match ${base?.tag ?? "<image1>"}
`;
}
