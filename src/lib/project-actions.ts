import { deleteImageAsset } from "./assets";
import { ROLE_POLICIES, TEMPLATES, defaultMatrix, roleTransferAttrs } from "./constants";
import { logger } from "./logger";
import { retag, uid } from "./project-factories";
import { projectStore } from "./project-store-core";
import { builtState } from "./project-transitions";
import { getAllReferencedAssetIds, getSettings } from "./storage";
import type { Attribute, EditStep, ProjectState, RefImage, Role } from "./types";
import { ATTRIBUTES } from "./types";
const up = projectStore.update;
export const actions = {
  build() {
    up((p) => builtState(p));
  },
  ensureBuilt() {
    const p = projectStore.get();
    if (p.isPromptDirty || !p.blocks.length) actions.build();
    return projectStore.get();
  },
  setField<K extends keyof ProjectState>(k: K, v: ProjectState[K]) {
    up((p) => {
      logger.debug("store", `Updated project field "${String(k)}"`);
      return { ...p, [k]: v };
    });
  },
  addImages(imgs: Omit<RefImage, "tag">[]) {
    up((p) => {
      const images = retag([...p.images, ...imgs.map((i) => ({ ...i, tag: "" }))]).slice(0, 10);
      logger.info("store", `Added ${imgs.length} image(s) to project (total: ${images.length})`);
      let next = { ...p, images };
      if (!next.selectedBaseImageId && images[0]) {
        images[0] = {
          ...images[0],
          role: "Base Canvas",
          uses: [],
          excludes: [...ROLE_POLICIES["Base Canvas"].defaultExclusions],
        };
        next = { ...next, images, selectedBaseImageId: images[0].id };
      }
      return next;
    });
  },
  updateImage(id: string, patch: Partial<RefImage>) {
    up((p) => ({ ...p, images: p.images.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  },
  setImageUses(id: string, uses: Attribute[]) {
    up((p) => {
      const image = p.images.find((i) => i.id === id);
      if (!image) return p;
      const m = { ...p.attributeMatrix };
      for (const a of image.uses) {
        if (!uses.includes(a) && m[a].state === "REPLACE" && m[a].sourceImageId === id)
          m[a] = { state: "FREE" };
      }
      for (const a of uses) m[a] = { state: "REPLACE", sourceImageId: id };
      return {
        ...p,
        attributeMatrix: m,
        images: p.images.map((i) => (i.id === id ? { ...i, uses } : i)),
      };
    });
  },
  setImageLocks(id: string, locks: Attribute[]) {
    // Per-image locks are source-fidelity constraints. They never mutate the
    // global matrix: matrix LOCK means "keep this attribute from the base",
    // while a reference lock means "if this source supplies the attribute,
    // preserve that source trait exactly during transfer".
    up((p) => ({
      ...p,
      images: p.images.map((i) => (i.id === id ? { ...i, locks } : i)),
    }));
  },
  setRole(id: string, role: Role) {
    up((p) => {
      const policy = ROLE_POLICIES[role];
      const next = {
        ...p,
        images: p.images.map((i) =>
          i.id === id
            ? {
                ...i,
                role,
                excludes: [...policy.defaultExclusions],
                uses: [...policy.defaultTransfers],
              }
            : i,
        ),
      };
      if (role === "Base Canvas") {
        next.selectedBaseImageId = id;
        next.images = next.images.map((i) =>
          i.id !== id && i.role === "Base Canvas"
            ? {
                ...i,
                role: "Unused" as Role,
                uses: [],
                excludes: [...ROLE_POLICIES.Unused.defaultExclusions],
              }
            : i,
        );
        if (getSettings().baseRules) {
          const m = { ...next.attributeMatrix };
          for (const a of ROLE_POLICIES["Base Canvas"].defaultLocks)
            if (m[a].state !== "REPLACE") m[a] = { state: "LOCK" };
          next.attributeMatrix = m;
        }
      } else {
        if (p.selectedBaseImageId === id) next.selectedBaseImageId = undefined;
        const m = { ...next.attributeMatrix };
        const attrs = roleTransferAttrs(role);
        for (const a of ATTRIBUTES)
          if (m[a].state === "REPLACE" && m[a].sourceImageId === id && !attrs.includes(a))
            m[a] = { state: "FREE" };
        for (const a of attrs)
          if (!(m[a].state === "REPLACE" && m[a].sourceImageId && m[a].sourceImageId !== id))
            m[a] = { state: "REPLACE", sourceImageId: id };
        next.attributeMatrix = m;
      }
      return next;
    });
  },
  removeImage(id: string) {
    const targetImage = projectStore.get().images.find((i) => i.id === id);
    const assetId = targetImage?.assetId;
    up((p) => {
      const removedTargetIds = new Set(p.targets.filter((t) => t.imageId === id).map((t) => t.id));
      const images = retag(p.images.filter((i) => i.id !== id));
      const m = { ...p.attributeMatrix };
      for (const a of ATTRIBUTES) if (m[a].sourceImageId === id) m[a] = { state: "FREE" };
      return {
        ...p,
        images,
        attributeMatrix: m,
        selectedBaseImageId: p.selectedBaseImageId === id ? undefined : p.selectedBaseImageId,
        targets: p.targets.filter((t) => !removedTargetIds.has(t.id)),
        movements: p.movements.filter((mv) => !removedTargetIds.has(mv.targetId)),
        editSteps: p.editSteps.map((e) => ({
          ...e,
          sourceImageId: e.sourceImageId === id ? undefined : e.sourceImageId,
          targetId: e.targetId && removedTargetIds.has(e.targetId) ? undefined : e.targetId,
        })),
      };
    });
    if (assetId) {
      const activeState = projectStore.get();
      const referenced = getAllReferencedAssetIds(activeState);
      if (!referenced.has(assetId) && !projectStore.retainedAssetIds().has(assetId)) {
        deleteImageAsset(assetId)
          .then(() => {
            logger.info("assets", `Cleaned up unreferenced image asset: ${assetId}`);
          })
          .catch((err) => {
            logger.warn(
              "assets",
              `Failed to clean up unreferenced image asset ${assetId}: ${(err as Error).message}`,
            );
          });
      }
    }
  },
  moveImage(id: string, dir: -1 | 1) {
    up((p) => {
      const i = p.images.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.images.length) return p;
      const arr = [...p.images];
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      return { ...p, images: retag(arr) };
    });
  },
  setAttr(a: Attribute, state: ProjectState["attributeMatrix"][Attribute]) {
    up((p) => ({ ...p, attributeMatrix: { ...p.attributeMatrix, [a]: state } }));
  },
  addStep(s?: Partial<EditStep>) {
    up((p) => ({ ...p, editSteps: [...p.editSteps, { id: uid(), operation: p.operation, ...s }] }));
  },
  updateStep(id: string, patch: Partial<EditStep>) {
    up((p) => ({
      ...p,
      editSteps: p.editSteps.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  },
  removeStep(id: string) {
    up((p) => ({ ...p, editSteps: p.editSteps.filter((e) => e.id !== id) }));
  },
  moveStep(id: string, dir: -1 | 1) {
    up((p) => {
      const i = p.editSteps.findIndex((x) => x.id === id),
        j = i + dir;
      if (j < 0 || j >= p.editSteps.length) return p;
      const arr = [...p.editSteps];
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      return { ...p, editSteps: arr };
    });
  },
  applyTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    up((p) => {
      const images = [...p.images];
      const slotImg: (string | undefined)[] = t.slots.map((_, i) => images[i]?.id);
      t.slots.forEach((role, i) => {
        const im = images[i];
        if (im)
          images[i] = {
            ...im,
            role,
            uses: [...ROLE_POLICIES[role].defaultTransfers],
            excludes: [...ROLE_POLICIES[role].defaultExclusions],
          };
      });
      const m = defaultMatrix(false);
      for (const [a, st] of Object.entries(t.matrix) as [
        Attribute,
        ProjectState["attributeMatrix"][Attribute]["state"],
      ][]) {
        const slot = t.replaceFromSlot?.[a];
        m[a] = {
          state: st,
          sourceImageId: st === "REPLACE" && slot !== undefined ? slotImg[slot] : undefined,
        };
      }
      const steps: EditStep[] = t.steps.map(({ sourceSlot, ...s }) => ({
        id: uid(),
        operation: t.operation,
        ...s,
        sourceImageId: sourceSlot !== undefined ? slotImg[sourceSlot] : undefined,
      }));
      const complex = t.slots.length > 2 || ["MOVE", "COMPOSITE", "ADD"].includes(t.operation);
      const next: ProjectState = {
        ...p,
        images,
        operation: t.operation,
        attributeMatrix: m,
        editSteps: steps,
        selectedBaseImageId: slotImg[0] ?? p.selectedBaseImageId,
        promptLevel: complex ? "expert" : p.promptLevel,
        metadata: { ...p.metadata, templateId: t.id },
      };
      return builtState(next);
    });
  },
  suggestMapping(p: ProjectState): { role: Role; id: string }[] | null {
    if (p.images.length !== 3) return null;
    const roles: Role[] = ["Base Canvas", "Wardrobe", "Face Identity"];
    if (p.images.every((im, i) => im.role === roles[i])) return null;
    return p.images.map((im, i) => ({ id: im.id, role: roles[i] ?? im.role }));
  },
  applyMapping(map: { role: Role; id: string }[]) {
    up((p) => {
      const images = p.images.map((im) => {
        const r = map.find((x) => x.id === im.id)?.role ?? im.role;
        return {
          ...im,
          role: r,
          uses: [...ROLE_POLICIES[r].defaultTransfers],
          excludes: [...ROLE_POLICIES[r].defaultExclusions],
        };
      });
      const m = { ...p.attributeMatrix };
      for (const { role, id } of map)
        for (const a of roleTransferAttrs(role)) m[a] = { state: "REPLACE", sourceImageId: id };
      const base = map.find((x) => x.role === "Base Canvas")?.id;
      return {
        ...p,
        images,
        attributeMatrix: m,
        selectedBaseImageId: base ?? p.selectedBaseImageId,
      };
    });
  },
};
