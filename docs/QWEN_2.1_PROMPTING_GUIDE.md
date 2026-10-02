# Qwen 2.1 prompt workbench guide

This page describes the studio's compiler conventions. Generated parameters and token statistics are application presets and estimates; they are not validated model quality guarantees.

## Build a reproducible edit

1. Upload reference images in the order you will supply them to the inference tool. Slots receive ordered tags such as <image1> and <image2>. The selected base canvas can be any slot; it is not necessarily <image1>.
2. Assign roles to distinguish the base from wardrobe, face, pose, background, object, style, and other sources. Role presets initialize transfers and exclusions; your subsequent edits remain authoritative.
3. Configure edit steps and their source/target relationships. Choose **Canvas** under **Canvas target** to target the entire selected base image without drawing a region. An optional target description can specify the subject within that canvas. Use points, boxes, and movement vectors for specific regions. Preserve input ordering when copying prompts to another tool.
4. Configure the attribute matrix. LOCK preserves that attribute from the base canvas; REPLACE transfers it from the selected source; FREE and IGNORE follow the compiler's existing behavior. Per-image Exact Locks preserve source fidelity and never alter global LOCK entries.
5. Copy an output format, negative prompt, or bundle. Save Version records structured state and prompt text for later restore.

## Output formats

| Format      | Output                                                            |
| ----------- | ----------------------------------------------------------------- |
| natural     | Fluent edit instructions                                          |
| structured  | Grouped sections for canvas, edits, preservation, and integration |
| comfyui     | Tagged references and concise instructions for external workflows |
| single_line | One-line prompt                                                   |
| technical   | Enabled modular blocks in their configured order                  |

The negative prompt includes common artifact terms and additional terms selected by operations and matrix replacements. The bundle contains positive and negative prompts and existing recommended presets: 40 steps, CFG 4.0, DPM++ 2M or Euler, and base-matching resolution. Choose actual supported settings in your inference environment.

## Editing and refinement

Technical block editing locks the edited block so rebuilds preserve its text while updating the generated baseline. The ready-to-copy card also supports a transient text draft; that draft is for copying and does not become canonical ProjectState. Format changes clear the positive draft. Full bundles are compiled from structured state rather than custom copy drafts.

Optional AI refinement preserves relationship-bearing blocks and ordered image tags. Reset returns to deterministic output. Changing structured inputs invalidates old refinement; delayed results are rejected when inputs changed during the request.

## Practical checks

Confirm the base slot, source roles, exclusions, and validator issues before copying. Reordering images changes their tags. Supply images in the matching order. Direct generation through the existing Qwen adapter accepts only 1–3 images, while the Studio can hold up to 10 references for external workflows.

Token counts are estimates based on word counts, not a loaded tokenizer. Canvas coordinates affect prompt wording; they are not exported inference masks. Prompt compilation does not require a local model or prove that a particular model will follow every preservation clause.
