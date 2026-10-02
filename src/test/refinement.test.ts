import { PROTECTED_REFINEMENT_BLOCKS, refineBlocksSafely } from "@/lib/refinement";
import type { PromptBlock } from "@/lib/types";
import { describe, expect, it, vi } from "vitest";

const block = (id: PromptBlock["id"], text: string): PromptBlock => ({
  id,
  title: id,
  text,
  generated: text,
  enabled: true,
  locked: false,
  edited: false,
});

describe("refinement compatibility", () => {
  it("keeps every relationship-bearing block verbatim", async () => {
    const blocks = [...PROTECTED_REFINEMENT_BLOCKS].map((id) =>
      block(id, `${id}: <image2> to <image1>`),
    );
    const refine = vi.fn();
    expect(await refineBlocksSafely(blocks, refine)).toBe(blocks.map((b) => b.text).join("\n"));
    expect(refine).not.toHaveBeenCalled();
  });
  it("rejects reordered image references", async () => {
    await expect(
      refineBlocksSafely(
        [block("integration", "<image1> then <image2>")],
        async () => "<image2> then <image1>",
      ),
    ).rejects.toThrow("changed image references");
  });
  it("rejects empty output and skips disabled blocks", async () => {
    await expect(
      refineBlocksSafely([block("integration", "Blend naturally")], async () => " "),
    ).rejects.toThrow("empty");
    expect(
      await refineBlocksSafely([{ ...block("integration", "Disabled"), enabled: false }], vi.fn()),
    ).toBe("");
  });
});
