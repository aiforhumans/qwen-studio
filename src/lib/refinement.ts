import type { BlockId, PromptBlock } from "./types";

/** Relationship-bearing blocks are immutable during AI wording refinement. */
export const PROTECTED_REFINEMENT_BLOCKS = new Set<BlockId>([
  "roles",
  "targets",
  "spatial",
  "transfer",
  "preservation",
]);

const tags = (s: string) => s.match(/<image\d+>/g) ?? [];
const sameTags = (a: string, b: string) => {
  const x = tags(a),
    y = tags(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

export async function refineBlocksSafely(
  blocks: PromptBlock[],
  refine: (text: string) => Promise<string>,
): Promise<string> {
  const out: string[] = [];
  for (const block of blocks) {
    if (!block.enabled || !block.text.trim()) continue;
    if (PROTECTED_REFINEMENT_BLOCKS.has(block.id)) {
      out.push(block.text.trim());
      continue;
    }
    const refined = (await refine(block.text.trim())).trim();
    if (!refined) throw new Error(`Refinement returned an empty ${block.title} block.`);
    if (!sameTags(block.text, refined))
      throw new Error(
        `Refinement changed image references in ${block.title}; the output was rejected.`,
      );
    out.push(refined);
  }
  return out.join("\n");
}
