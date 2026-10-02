import type { ProjectState } from "../types";
import { ATTRIBUTES } from "../types";
/** Deterministic hash of compiler inputs. Deliberately excludes blocks, diagnostics and timestamps. */
export function compilerInputHash(s: ProjectState): string {
  const snapshot = {
    operation: s.operation,
    promptLevel: s.promptLevel,
    userInstruction: s.userInstruction,
    images: s.images.map((i) => ({
      id: i.id,
      tag: i.tag,
      role: i.role,
      customRole: i.customRole,
      importance: i.importance,
      description: i.description,
      uses: i.uses,
      excludes: i.excludes,
      locks: i.locks,
    })),
    selectedBaseImageId: s.selectedBaseImageId,
    targets: s.targets,
    movements: s.movements,
    editSteps: s.editSteps,
    matrix: ATTRIBUTES.map((a) => [a, s.attributeMatrix[a]]),
    identityOverride: s.identityOverride,
    blockOrder: s.blockOrder,
    wordingVariant: s.metadata.wordingVariant,
  };
  const text = JSON.stringify(snapshot);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
