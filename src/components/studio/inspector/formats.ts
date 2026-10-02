import type { QwenPromptFormat } from "@/lib/types";
export const FORMAT_OPTIONS: {
  id: QwenPromptFormat;
  label: string;
  badge?: string;
  desc: string;
}[] = [
  {
    id: "natural",
    label: "Natural",
    badge: "Recommended",
    desc: "Fluent, cohesive direct instructions for Qwen 2.1",
  },
  {
    id: "structured",
    label: "Structured",
    desc: "Bulleted sections: Base, Edits, Preservations, Blending",
  },
  {
    id: "comfyui",
    label: "ComfyUI",
    desc: "Tagged image references (<image1>, <image2>) and concise instruction",
  },
  {
    id: "single_line",
    label: "Single Line",
    desc: "One continuous line for CLI or single-input fields",
  },
  { id: "technical", label: "10-Blocks", desc: "Canonical 10-block compiler output" },
];
