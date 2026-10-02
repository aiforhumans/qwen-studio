import { stepAttrs } from "./constants";
import type { Attribute, AttrState, ProjectState } from "./types";
import { ATTRIBUTES } from "./types";
export function relationshipEdges(p: ProjectState) {
  const edges: {
    imgId: string;
    tag: string;
    role: string;
    kind: AttrState | "EXCLUDE";
    attrs: Attribute[];
  }[] = [];
  const base = p.images.find((i) => i.id === p.selectedBaseImageId);
  const locks = ATTRIBUTES.filter((a) => p.attributeMatrix[a].state === "LOCK");
  if (base && locks.length)
    edges.push({ imgId: base.id, tag: base.tag, role: base.role, kind: "LOCK", attrs: locks });
  for (const img of p.images) {
    if (img.id === base?.id) continue;
    const reps = ATTRIBUTES.filter(
      (a) =>
        p.attributeMatrix[a].state === "REPLACE" && p.attributeMatrix[a].sourceImageId === img.id,
    );
    const stepReps = p.editSteps.filter((e) => e.sourceImageId === img.id).flatMap(stepAttrs);
    const all = Array.from(new Set([...reps, ...stepReps]));
    if (all.length)
      edges.push({ imgId: img.id, tag: img.tag, role: img.role, kind: "REPLACE", attrs: all });
    if (img.excludes.length)
      edges.push({
        imgId: img.id,
        tag: img.tag,
        role: img.role,
        kind: "EXCLUDE",
        attrs: img.excludes,
      });
  }
  return edges;
}
