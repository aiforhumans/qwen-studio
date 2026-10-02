import {
  ATTR_PHRASE,
  ATTR_SHORT,
  BLOCK_META,
  DEFAULT_ORDER,
  OPERATION_POLICY,
  stepAttrs,
} from "../constants";
import type { Attribute, BlockId, ProjectState, PromptBlock } from "../types";
import { ATTRIBUTES } from "../types";
import {
  type Ctx,
  describeDelta,
  describePos,
  excl,
  list,
  makeCtx,
  needsResizeReconstruction,
  PRESERVE_ORDER,
  sourceExclusions,
  stepSentence,
  targetName,
} from "./context";
export function blockText(c: Ctx, id: BlockId): string {
  const { s, level, B, base } = c;
  const m = s.attributeMatrix;
  const ops = s.editSteps.map((e) => e.operation);
  const expert = level === "expert";
  switch (id) {
    case "operation": {
      const n = s.images.length;
      const opNames = Array.from(new Set(ops.length ? ops : [s.operation])).map((o) =>
        o.toLowerCase().replace("_", "/"),
      );
      const u = s.userInstruction.trim();
      return `Operation: ${list(opNames)} edit${n > 1 ? ` using ${n} reference images` : ""}.${u ? ` Goal: ${u.replace(/([^.])$/, "$1.")}` : ""}`;
    }
    case "canvas":
      if (!base) return "Edit the input image.";
      return expert
        ? `Use ${B} as the base canvas. Keep its resolution, aspect ratio, camera position, lens perspective and depth of field.`
        : `Use ${B} as the base canvas.`;
    case "roles": {
      if (level === "simple") return "";
      return s.images
        .filter((i) => i.id !== base?.id)
        .map((i) => {
          const role = i.role === "Custom" ? i.customRole || "custom" : i.role;
          if (i.role === "Unused") return `${i.tag} is not used; ignore it entirely.`;
          const uses = ATTRIBUTES.filter(
            (a) => m[a].state === "REPLACE" && m[a].sourceImageId === i.id,
          );
          const stepUse = s.editSteps.filter((e) => e.sourceImageId === i.id).flatMap(stepAttrs);
          const all = Array.from(new Set([...uses, ...stepUse, ...i.uses]));
          const d = i.description?.trim() ? ` (${i.description.trim()})` : "";
          const priority =
            i.importance === "Medium" ? "" : ` Reference priority: ${i.importance.toLowerCase()}.`;
          const ex = sourceExclusions(s, i.id);
          const active = new Set(all);
          const exact = i.locks.filter((a) => active.has(a) && !ex.includes(a));
          const lockText = exact.length
            ? ` Source-fidelity lock: when transferred, preserve ${list(exact.map((a) => ATTR_PHRASE[a]))} exactly from ${i.tag}.`
            : "";
          return `${i.tag} is the ${role.toLowerCase()} reference${d}${all.length ? `: use it only for ${list(all.map((a) => ATTR_PHRASE[a]))}` : ""}.${priority}${
            ex.length
              ? ` Exclude ${list(
                  ex.map((a) => ATTR_SHORT[a]),
                  "or",
                )} from this source.`
              : ""
          }${lockText}`;
        })
        .join("\n");
    }
    case "targets":
      return s.editSteps.map((st) => stepSentence(c, st)).join("\n");
    case "spatial": {
      const lines: string[] = [];
      for (const mv of s.movements) {
        const t = s.targets.find((x) => x.id === mv.targetId);
        if (!t) continue;
        lines.push(
          `${t.label} currently sits ${describePos(mv.from.x, mv.from.y)}; its destination is ${describePos(mv.to.x, mv.to.y)} (shifted ${describeDelta(mv.to.x - mv.from.x, mv.to.y - mv.from.y)}).`,
        );
      }
      for (const t of s.targets) {
        if (s.movements.some((mv) => mv.targetId === t.id)) continue;
        if (!s.editSteps.some((e) => e.targetId === t.id)) continue;
        const p =
          t.point ??
          (t.bbox ? { x: t.bbox.x + t.bbox.w / 2, y: t.bbox.y + t.bbox.h / 2 } : undefined);
        if (p)
          lines.push(
            `${t.label} is located ${describePos(p.x, p.y)}${t.bbox ? `, occupying about ${Math.round(t.bbox.w * t.bbox.h * 100)}% of the frame` : ""}.`,
          );
      }
      for (const st of s.editSteps)
        if (st.orientation && st.operation !== "REPOSITION")
          lines.push(`Orient ${targetName(c, st)} ${st.orientation}.`);
      if (expert && lines.length)
        lines.push(
          "Scale moved or inserted content according to its new depth so apparent size follows the scene's perspective and vanishing lines.",
        );
      return lines.join("\n");
    }
    case "transfer": {
      const covered = new Set(
        s.editSteps.flatMap((e) =>
          e.sourceImageId ? stepAttrs(e).map((a) => `${a}:${e.sourceImageId}`) : [],
        ),
      );
      const bySrc = new Map<string, Attribute[]>();
      for (const a of ATTRIBUTES) {
        const e = m[a];
        if (e.state !== "REPLACE" || !e.sourceImageId || covered.has(`${a}:${e.sourceImageId}`))
          continue;
        bySrc.set(e.sourceImageId, [...(bySrc.get(e.sourceImageId) ?? []), a]);
      }
      return Array.from(bySrc.entries())
        .map(([src, attrs]) => {
          const t = c.tag(src);
          return `Take ${list(attrs.map((a) => ATTR_PHRASE[a]))} from ${t}.${excl(s, src, t, level)}`;
        })
        .join("\n");
    }
    case "preservation": {
      const locks = PRESERVE_ORDER.filter((a) => m[a].state === "LOCK");
      const ign = ATTRIBUTES.filter((a) => m[a].state === "IGNORE");
      const out: string[] = [];
      if (locks.length) out.push(`Preserve ${list(locks.map((a) => ATTR_PHRASE[a]))} from ${B}.`);
      const baseExact =
        base?.locks.filter((a) => m[a].state !== "REPLACE" && m[a].state !== "IGNORE") ?? [];
      if (baseExact.length)
        out.push(
          `Strict base lock: keep ${list(baseExact.map((a) => ATTR_PHRASE[a]))} exactly as shown in ${B}.`,
        );
      if (ign.length && level !== "simple")
        out.push(
          `Do not reference ${list(ign.map((a) => ATTR_PHRASE[a]))} from any reference image.`,
        );
      return out.join(" ");
    }
    case "integration": {
      const policies = s.editSteps.map((e) => OPERATION_POLICY[e.operation].integration);
      const reps = ATTRIBUTES.filter((a) => m[a].state === "REPLACE");
      const hasSpatial = policies.includes("spatial");
      const hasAppearance = policies.includes("appearance") || reps.length > 0;
      const hasSurface = policies.includes("surface");
      if (!hasSpatial && !hasAppearance && !hasSurface) return "";
      const lines: string[] = [];
      if (hasAppearance) {
        const bits: string[] = [];
        if (reps.includes("face_identity") || reps.includes("expression"))
          bits.push("coherent skin tone and facial lighting");
        if (reps.some((a) => ["clothing", "shoes", "accessories"].includes(a)))
          bits.push("natural garment fit and material behavior");
        bits.push("perspective", "lighting consistency");
        lines.push(`Integrate transferred appearance attributes with ${list(bits)}.`);
      }
      if (hasSpatial)
        lines.push(
          "Integrate moved or inserted content at the destination with correct scale, depth, perspective and occlusion order.",
        );
      if (hasSurface)
        lines.push(
          "Blend edited surface boundaries with surrounding texture, perspective and illumination without seams.",
        );
      if (expert) {
        lines.push(
          "Match the scene's light direction, color temperature, contrast, depth of field and noise/grain.",
        );
        if (hasSpatial)
          lines.push(
            "Ground placed objects with correct contact points and contact shadows; add reflections only where the destination material requires them.",
          );
        if (reps.some((a) => ["clothing", "shoes"].includes(a)))
          lines.push(
            "Fabric must drape and fold according to the preserved pose and body position without importing the reference person's body shape.",
          );
      }
      return lines.join(" ");
    }
    case "reconstruction": {
      const lines: string[] = [];
      for (const e of s.editSteps) {
        const policy = OPERATION_POLICY[e.operation].reconstruction;
        const T = targetName(c, e);
        if (policy === "none") continue;
        if (policy === "inpaint") {
          lines.push(
            `Blend the inpainted region for ${T} seamlessly with its surroundings; do not alter pixels outside the target.`,
          );
          continue;
        }
        if (policy === "resize_if_smaller" && !needsResizeReconstruction(e.scale)) continue;
        const mv = s.movements.find((x) => x.targetId === e.targetId);
        const where = mv ? ` ${describePos(mv.from.x, mv.from.y)}` : "";
        lines.push(
          `Reconstruct only the area newly exposed by ${e.operation.toLowerCase()} of ${T}${where}, continuing surrounding geometry, edges, textures and lighting so no trace, ghosting or duplicate remains.`,
        );
      }
      return lines.join("\n");
    }
    case "consistency":
      return expert
        ? `Keep all untargeted content from ${B} unchanged. Before finishing, verify that each attribute comes only from its assigned image and nothing from a reference image leaks into locked regions.`
        : `Keep all untargeted content from ${B} unchanged.`;
  }
}

export function compileBlock(s: ProjectState, id: BlockId): string {
  return blockText(makeCtx(s), id);
}

/** Rebuild blocks; locked/manual blocks keep their text while generated baselines update. */
export function compileBlocks(s: ProjectState): PromptBlock[] {
  const ctx = makeCtx(s);
  const prev = new Map(s.blocks.map((b) => [b.id, b]));
  const order = s.blockOrder?.length ? s.blockOrder : DEFAULT_ORDER;
  return order.map((id) => {
    const generated = blockText(ctx, id);
    const p = prev.get(id);
    if (p && p.locked) return { ...p, generated };
    return {
      id,
      title: BLOCK_META[id].title,
      text: generated,
      generated,
      enabled: p ? p.enabled : true,
      locked: false,
      edited: false,
    };
  });
}

export function finalPrompt(blocks: PromptBlock[]): string {
  return blocks
    .filter((b) => b.enabled && b.text.trim())
    .map((b) => b.text.trim())
    .join("\n");
}
