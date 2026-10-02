import { ATTR_PHRASE, ATTR_SHORT, stepAttrs } from "../constants";
import { logger } from "../logger";
import type { Attribute, ProjectState, QwenPromptFormat } from "../types";
import { ATTRIBUTES } from "../types";
import { blockText, compileBlocks, finalPrompt } from "./blocks";
import { list, makeCtx, opVerb, PRESERVE_ORDER, sourceExclusions, stepSentence } from "./context";
/**
 * Compiles a direct, highly-optimized ready-to-copy prompt for Qwen 2.1 Image Edit.
 * Formats:
 * - 'natural': Direct, fluent imperative instructions tailored for Qwen 2.1 attention.
 * - 'structured': Bulleted, tagged clauses (Base, Edits, Preservations, Integration).
 * - 'comfyui': Node-mapped syntax with image roles and direct edit instructions.
 * - 'single_line': Single continuous line for CLI or single-input interfaces.
 * - 'technical': Canonical 10-block system output.
 */
export function compileQwen21Prompt(s: ProjectState, format: QwenPromptFormat = "natural"): string {
  const result = compileQwen21PromptInternal(s, format);
  logger.debug("compiler", `Compiled Qwen 2.1 prompt (${format})`, {
    format,
    length: result.length,
    images: s.images.length,
  });
  return result;
}

function compileQwen21PromptInternal(s: ProjectState, format: QwenPromptFormat): string {
  if (format === "technical") {
    const blocks = s.blocks.length ? s.blocks : compileBlocks(s);
    return finalPrompt(blocks);
  }

  const ctx = makeCtx(s);
  const { base, B } = ctx;
  const isMulti = s.images.length > 1;

  // Step descriptions
  const stepLines: string[] = s.editSteps.map((st) => stepSentence(ctx, st)).filter(Boolean);

  // If no edit steps are explicitly defined, generate from operation and matrix
  if (!stepLines.length && s.operation) {
    const verb = opVerb(s.operation, ctx.variant);
    const opReplaces = ATTRIBUTES.filter((a) => s.attributeMatrix[a].state === "REPLACE");
    if (opReplaces.length) {
      const byImg = new Map<string, Attribute[]>();
      for (const a of opReplaces) {
        const id = s.attributeMatrix[a].sourceImageId;
        if (id) byImg.set(id, [...(byImg.get(id) ?? []), a]);
      }
      for (const [srcId, attrs] of byImg.entries()) {
        stepLines.push(
          `${verb} ${list(attrs.map((a) => ATTR_PHRASE[a]))} using ${ctx.tag(srcId)}.`,
        );
      }
    } else {
      stepLines.push(`${verb} the subject according to the requested edit.`);
    }
  }

  // Matrix replacements not already covered in edit steps
  const covered = new Set(
    s.editSteps.flatMap((e) =>
      e.sourceImageId ? stepAttrs(e).map((a) => `${a}:${e.sourceImageId}`) : [],
    ),
  );
  const matrixTransfers: { src: string; attrs: Attribute[] }[] = [];
  const bySrc = new Map<string, Attribute[]>();
  for (const a of ATTRIBUTES) {
    const e = s.attributeMatrix[a];
    if (e.state !== "REPLACE" || !e.sourceImageId || covered.has(`${a}:${e.sourceImageId}`))
      continue;
    bySrc.set(e.sourceImageId, [...(bySrc.get(e.sourceImageId) ?? []), a]);
  }
  for (const [srcId, attrs] of bySrc.entries()) {
    matrixTransfers.push({ src: ctx.tag(srcId), attrs });
  }

  const stepSourceIds = new Set(s.editSteps.map((e) => e.sourceImageId).filter(Boolean));
  // Reference exclusions for sources not already detailed in edit steps
  const exclusions: { tag: string; attrs: Attribute[] }[] = [];
  for (const img of s.images) {
    if (img.id === base?.id || img.role === "Unused" || stepSourceIds.has(img.id)) continue;
    const ex = sourceExclusions(s, img.id);
    if (ex.length) exclusions.push({ tag: img.tag, attrs: ex });
  }

  // Exact reference fidelity locks
  const exactLocks: { tag: string; attrs: Attribute[] }[] = [];
  for (const img of s.images) {
    if (img.id === base?.id || img.role === "Unused") continue;
    const ex = sourceExclusions(s, img.id);
    const uses = ATTRIBUTES.filter(
      (a) =>
        s.attributeMatrix[a].state === "REPLACE" && s.attributeMatrix[a].sourceImageId === img.id,
    );
    const stepUse = s.editSteps.filter((e) => e.sourceImageId === img.id).flatMap(stepAttrs);
    const all = Array.from(new Set([...uses, ...stepUse, ...img.uses]));
    const active = new Set(all);
    const exact = img.locks.filter((a) => active.has(a) && !ex.includes(a));
    if (exact.length) exactLocks.push({ tag: img.tag, attrs: exact });
  }

  // Reference descriptors (description and non-medium importance)
  const refDescriptors: {
    tag: string;
    role: string;
    desc?: string | undefined;
    priority?: string | undefined;
  }[] = [];
  for (const img of s.images) {
    if (img.id === base?.id || img.role === "Unused") continue;
    const roleStr = img.role === "Custom" ? img.customRole || "custom" : img.role.toLowerCase();
    const desc = img.description?.trim() || undefined;
    const priority =
      img.importance && img.importance !== "Medium" ? img.importance.toLowerCase() : undefined;
    if (desc || priority) {
      refDescriptors.push({ tag: img.tag, role: roleStr, desc, priority });
    }
  }

  // Base canvas preservations
  const baseLocks = PRESERVE_ORDER.filter((a) => s.attributeMatrix[a].state === "LOCK");
  const baseExact =
    base?.locks.filter(
      (a) => s.attributeMatrix[a].state !== "REPLACE" && s.attributeMatrix[a].state !== "IGNORE",
    ) ?? [];

  // User goal
  const goal = s.userInstruction.trim();

  // Physical integration and reconstruction
  const integrationText = blockText(ctx, "integration");
  const reconstructionText = blockText(ctx, "reconstruction");

  if (format === "natural" || format === "single_line") {
    const sentences: string[] = [];

    // Context lead
    if (isMulti) {
      sentences.push(`In ${B}:`);
    } else {
      sentences.push("In the input image:");
    }

    if (goal) {
      sentences.push(`Goal: ${goal.replace(/([^.])$/, "$1.")}`);
    }

    // Step instructions
    for (const line of stepLines) {
      if (line) sentences.push(line.replace(/([^.])$/, "$1."));
    }

    // Additional matrix transfers
    for (const mt of matrixTransfers) {
      sentences.push(`Transfer ${list(mt.attrs.map((a) => ATTR_PHRASE[a]))} from ${mt.src}.`);
    }

    // Reference details & priority
    for (const rd of refDescriptors) {
      const parts: string[] = [];
      if (rd.desc) parts.push(`features ${rd.desc}`);
      if (rd.priority) parts.push(`has ${rd.priority} priority`);
      sentences.push(`Reference ${rd.tag} (${rd.role}) ${parts.join(" and ")}.`);
    }

    // Source exact locks
    for (const el of exactLocks) {
      sentences.push(
        `Preserve ${list(el.attrs.map((a) => ATTR_PHRASE[a]))} exactly from ${el.tag}.`,
      );
    }

    // Exclusions
    for (const ex of exclusions) {
      sentences.push(
        `Do not transfer ${list(
          ex.attrs.map((a) => ATTR_SHORT[a]),
          "or",
        )} from ${ex.tag}.`,
      );
    }

    // Base canvas preservations
    if (baseLocks.length) {
      sentences.push(`Preserve ${list(baseLocks.map((a) => ATTR_PHRASE[a]))} from ${B}.`);
    }
    if (baseExact.length) {
      sentences.push(
        `Keep ${list(baseExact.map((a) => ATTR_PHRASE[a]))} exactly as shown in ${B}.`,
      );
    }

    // Reconstruction
    if (reconstructionText) {
      sentences.push(reconstructionText.replace(/\n+/g, " "));
    }

    // Integration
    if (integrationText) {
      sentences.push(integrationText);
    }

    // Invariance
    sentences.push(`Keep all untargeted areas of ${B} unchanged.`);

    if (format === "single_line") {
      return sentences.join(" ").replace(/\s+/g, " ").trim();
    }
    return sentences.join("\n");
  }

  if (format === "structured") {
    const sections: string[] = [];

    // Canvas Section
    sections.push(`[Base Image]\nUse ${B} as the base canvas.`);

    if (goal) {
      sections.push(`[Goal]\n${goal.replace(/([^.])$/, "$1.")}`);
    }

    // Edits Section
    const mods: string[] = [];
    for (const line of stepLines) {
      if (line) mods.push(`• ${line}`);
    }
    for (const mt of matrixTransfers) {
      mods.push(`• Transfer ${list(mt.attrs.map((a) => ATTR_PHRASE[a]))} from ${mt.src}.`);
    }
    if (mods.length) {
      sections.push(`[Edits & Reference Transfers]\n${mods.join("\n")}`);
    }

    // Reference Rules & Exclusions
    const refRules: string[] = [];
    for (const el of exactLocks) {
      refRules.push(
        `• Fidelity Lock: preserve ${list(el.attrs.map((a) => ATTR_PHRASE[a]))} exactly from ${el.tag}.`,
      );
    }
    for (const ex of exclusions) {
      refRules.push(
        `• Exclusion: do not transfer ${list(
          ex.attrs.map((a) => ATTR_SHORT[a]),
          "or",
        )} from ${ex.tag}.`,
      );
    }
    for (const rd of refDescriptors) {
      const parts: string[] = [];
      if (rd.desc) parts.push(rd.desc);
      if (rd.priority) parts.push(`[${rd.priority} priority]`);
      refRules.push(`• Reference ${rd.tag} (${rd.role}): ${parts.join(" ")}.`);
    }
    if (refRules.length) {
      sections.push(`[Reference Constraints]\n${refRules.join("\n")}`);
    }

    // Preservation Section
    const preserves: string[] = [];
    if (baseLocks.length) {
      preserves.push(`• Preserve from ${B}: ${list(baseLocks.map((a) => ATTR_PHRASE[a]))}.`);
    }
    if (baseExact.length) {
      preserves.push(
        `• Strict base lock on ${B}: keep ${list(baseExact.map((a) => ATTR_PHRASE[a]))} unaltered.`,
      );
    }
    preserves.push(`• Keep all untargeted content from ${B} completely unchanged.`);
    sections.push(`[Preservation Constraints]\n${preserves.join("\n")}`);

    // Integration Section
    if (integrationText || reconstructionText) {
      const ints: string[] = [];
      if (reconstructionText) ints.push(`• ${reconstructionText.replace(/\n+/g, " ")}`);
      if (integrationText) ints.push(`• ${integrationText}`);
      sections.push(`[Physical Blending & Lighting]\n${ints.join("\n")}`);
    }

    return sections.join("\n\n");
  }

  if (format === "comfyui") {
    const lines: string[] = [];
    if (base) {
      lines.push(`${base.tag}: Target canvas (preserve camera, background, and lighting).`);
    }
    for (const img of s.images) {
      if (img.id === base?.id || img.role === "Unused") continue;
      const roleStr = img.role === "Custom" ? img.customRole || "Reference" : img.role;
      const d = img.description?.trim();
      const p =
        img.importance && img.importance !== "Medium" ? img.importance.toLowerCase() : undefined;
      const extraParts: string[] = [];
      if (d) extraParts.push(`Description: ${d}.`);
      if (p) extraParts.push(`Priority: ${p}.`);
      const extraText = extraParts.length ? ` ${extraParts.join(" ")}` : "";
      lines.push(`${img.tag}: ${roleStr} reference.${extraText}`);
    }

    const instrParts: string[] = [];
    if (goal) instrParts.push(goal.replace(/([^.])$/, "$1."));
    for (const st of stepLines) if (st) instrParts.push(st);
    if (baseLocks.length)
      instrParts.push(`Preserve ${list(baseLocks.map((a) => ATTR_PHRASE[a]))} from ${B}.`);
    instrParts.push(
      `Keep all other elements of ${B} unchanged. Realistic physical blending, no artifacts.`,
    );

    lines.push(`Instruction: In ${B}, ${instrParts.join(" ")}`);
    return lines.join("\n");
  }

  return "";
}
