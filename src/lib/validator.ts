import { ATTR_LABEL, OPERATION_POLICY, ROLE_POLICIES, stepAttrs } from "./constants";
import type { DiagnosticScore, ProjectState, ValidationIssue } from "./types";
import { ATTRIBUTES } from "./types";

export function validate(s: ProjectState): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  const add = (
    severity: ValidationIssue["severity"],
    id: string,
    message: string,
    focus?: string,
  ) => out.push({ id, severity, message, focus });
  const m = s.attributeMatrix;
  const imageIds = new Set(s.images.map((i) => i.id));
  const targetIds = new Set(s.targets.map((t) => t.id));

  if (!s.images.length)
    add("info", "no-images", "Upload at least one image to begin.", "upload-zone");
  const bases = s.images.filter((i) => i.role === "Base Canvas");
  const ops = s.editSteps.map((e) => e.operation);
  if (!s.editSteps.length)
    add(
      "error",
      "no-op",
      "No edit step defined — the requested operation is not explicit.",
      "add-edit",
    );
  if (
    s.images.length &&
    ops.some((o) => OPERATION_POLICY[o].needsBase) &&
    (!s.selectedBaseImageId || !imageIds.has(s.selectedBaseImageId))
  )
    add("error", "no-base", "No valid base canvas selected.", "images-panel");
  if (bases.length > 1)
    add(
      "warning",
      "multi-base",
      `${bases.length} images are tagged Base Canvas; only one can be the canvas.`,
      `img-${bases[1]?.id}`,
    );

  for (const img of s.images) {
    if (img.role === "Custom" && !img.customRole?.trim())
      add(
        "warning",
        `role-${img.id}`,
        `${img.tag} has a Custom role with no name.`,
        `img-${img.id}`,
      );
    for (const a of img.locks) {
      if (img.excludes.includes(a))
        add(
          "error",
          `lock-exclude-${img.id}-${a}`,
          `${img.tag} both excludes and exact-locks ${ATTR_LABEL[a]}. Choose one.`,
          `img-${img.id}`,
        );
    }
    if (img.id === s.selectedBaseImageId || img.role === "Unused") continue;
    const referenced =
      s.editSteps.some((e) => e.sourceImageId === img.id) ||
      ATTRIBUTES.some((a) => m[a].sourceImageId === img.id && m[a].state === "REPLACE") ||
      img.uses.length > 0 ||
      ["Mask", "Spatial Guide"].includes(img.role);
    if (!referenced)
      add(
        "warning",
        `unref-${img.id}`,
        `${img.tag} is not referenced. Assign it a source or mark it Unused.`,
        `img-${img.id}`,
      );
    if (
      img.role === "Wardrobe" &&
      !img.excludes.includes("body_shape") &&
      !img.excludes.includes("body_proportions") &&
      (m.body_shape.state !== "LOCK" || m.body_proportions.state !== "LOCK")
    )
      add(
        "warning",
        `wbody-${img.id}`,
        `Clothing reference ${img.tag} may transfer body appearance. Lock Body Shape/Proportions or exclude them.`,
        "attr-body_shape",
      );
    if (img.role !== "Custom") {
      const allowed = new Set(ROLE_POLICIES[img.role].allowedAttributes);
      for (const a of img.uses) {
        if (!allowed.has(a))
          add(
            "warning",
            `role-use-${img.id}-${a}`,
            `${img.tag} is assigned ${ATTR_LABEL[a]} even though the ${img.role} role does not normally supply it.`,
            `img-${img.id}`,
          );
      }
    }
    for (const a of img.uses) {
      if (img.excludes.includes(a))
        add(
          "error",
          `use-exclude-${img.id}-${a}`,
          `${img.tag} is set to both supply and exclude ${ATTR_LABEL[a]}.`,
          `img-${img.id}`,
        );
    }
    const activeSourceAttrs = new Set([
      ...img.uses,
      ...ATTRIBUTES.filter((a) => m[a].state === "REPLACE" && m[a].sourceImageId === img.id),
      ...s.editSteps.filter((e) => e.sourceImageId === img.id).flatMap(stepAttrs),
    ]);
    for (const a of img.locks) {
      if (!activeSourceAttrs.has(a))
        add(
          "warning",
          `imglock-unused-${img.id}-${a}`,
          `${img.tag} exact-locks ${ATTR_LABEL[a]}, but that image is not currently supplying the attribute.`,
          `img-${img.id}`,
        );
    }
  }

  for (const a of ATTRIBUTES) {
    const e = m[a];
    if (e.state === "REPLACE" && !e.sourceImageId)
      add("error", `src-${a}`, `${ATTR_LABEL[a]} is REPLACE but has no source image.`, `attr-${a}`);
    if (e.state === "REPLACE" && e.sourceImageId && !imageIds.has(e.sourceImageId))
      add("error", `src-gone-${a}`, `${ATTR_LABEL[a]} references a deleted image.`, `attr-${a}`);
    if (e.state === "REPLACE" && e.sourceImageId && e.sourceImageId === s.selectedBaseImageId)
      add(
        "warning",
        `self-${a}`,
        `${ATTR_LABEL[a]} replaces from the base canvas itself — use LOCK instead.`,
        `attr-${a}`,
      );
    if (e.state === "LOCK") {
      const stepRep = s.editSteps.find(
        (st) =>
          st.sourceImageId &&
          st.sourceImageId !== s.selectedBaseImageId &&
          stepAttrs(st).includes(a),
      );
      if (stepRep)
        add(
          "error",
          `lockrep-${a}`,
          `${ATTR_LABEL[a]} is marked both LOCK and REPLACE (by an edit step).`,
          `attr-${a}`,
        );
    }
    if (e.state === "REPLACE" && e.sourceImageId) {
      const other = s.editSteps.find(
        (st) =>
          st.sourceImageId && st.sourceImageId !== e.sourceImageId && stepAttrs(st).includes(a),
      );
      if (other)
        add("error", `conf-${a}`, `${ATTR_LABEL[a]} has two competing references.`, `attr-${a}`);
      const src = s.images.find((i) => i.id === e.sourceImageId);
      if (src?.excludes.includes(a))
        add(
          "error",
          `exc-${a}`,
          `${src.tag} excludes ${ATTR_LABEL[a]} but is its REPLACE source.`,
          `img-${src.id}`,
        );
    }
  }

  for (const a of ATTRIBUTES) {
    const sources = new Set<string>();
    if (m[a].state === "REPLACE" && m[a].sourceImageId) sources.add(m[a].sourceImageId);
    s.images.filter((i) => i.uses.includes(a)).forEach((i) => sources.add(i.id));
    s.editSteps
      .filter((e) => e.sourceImageId && stepAttrs(e).includes(a))
      .forEach((e) => sources.add(e.sourceImageId!));
    const permittedIdentitySplit =
      a === "face_identity" && (s.identityOverride || ops.includes("COMPOSITE"));
    if (sources.size > 1 && !permittedIdentitySplit)
      add(
        "error",
        `multi-source-${a}`,
        `${ATTR_LABEL[a]} has multiple active source images. Choose one source or remove the competing Use for/edit assignment.`,
        `attr-${a}`,
      );
  }

  const idSources = new Set<string>();
  if (m.face_identity.state === "REPLACE" && m.face_identity.sourceImageId)
    idSources.add(m.face_identity.sourceImageId);
  s.editSteps
    .filter((e) => e.operation === "IDENTITY" && e.sourceImageId)
    .forEach((e) => idSources.add(e.sourceImageId!));
  s.images
    .filter((i) => ["Face Identity", "Identity"].includes(i.role))
    .forEach((i) => idSources.add(i.id));
  if (idSources.size > 1 && !s.identityOverride && !ops.includes("COMPOSITE"))
    add(
      "error",
      "id-multi",
      "Face identity has two competing references. Enable identity override only if this is intentional.",
      "identity-override",
    );

  for (const role of Object.keys(ROLE_POLICIES) as (keyof typeof ROLE_POLICIES)[]) {
    const imgs = s.images.filter((i) => i.role === role);
    if (imgs.length > 1 && role !== "Identity" && role !== "Object" && role !== "Unused")
      add(
        "warning",
        `dup-${role}`,
        `${imgs.length} images share the ${role} role — clarify which supplies it.`,
        `img-${imgs[1]?.id}`,
      );
  }

  s.targets.forEach((t) => {
    if (!imageIds.has(t.imageId))
      add(
        "error",
        `target-image-${t.id}`,
        `${t.label} belongs to a deleted image.`,
        "canvas-targets",
      );
  });
  s.movements.forEach((mv) => {
    if (!targetIds.has(mv.targetId))
      add(
        "error",
        `movement-target-${mv.id}`,
        "A movement references a deleted target.",
        "canvas-targets",
      );
  });

  s.editSteps.forEach((st, i) => {
    const n = `Edit ${i + 1}`;
    const fid = `step-${st.id}`;
    const policy = OPERATION_POLICY[st.operation];
    if (policy.needsSource && !st.sourceImageId)
      add("error", `ss-${st.id}`, `${n} (${st.operation}) has no source image identified.`, fid);
    if (st.sourceImageId && !imageIds.has(st.sourceImageId))
      add("error", `gone-${st.id}`, `${n} references a deleted image.`, fid);
    if (st.targetId && !targetIds.has(st.targetId))
      add("error", `target-gone-${st.id}`, `${n} references a deleted target.`, fid);
    if (
      policy.needsTarget &&
      st.targetScope !== "canvas" &&
      !st.targetId &&
      !st.targetText?.trim() &&
      !(st.sourceAttribute && st.sourceImageId)
    )
      add("error", `st-${st.id}`, `${n} (${st.operation}) is missing a target.`, fid);

    const movement = st.targetId ? s.movements.find((x) => x.targetId === st.targetId) : undefined;
    if (policy.needsDestination && !st.destination?.trim() && !movement)
      add(
        st.operation === "MOVE" ? "error" : "warning",
        `dest-${st.id}`,
        `${n} (${st.operation}) has no destination.`,
        fid,
      );
    if (st.operation === "MOVE" && !st.targetId && st.targetScope !== "canvas")
      add(
        "warning",
        `mvs-${st.id}`,
        `${n}: Move has no canvas target; source region cannot be reconstructed precisely.`,
        fid,
      );
    if ((st.operation === "COMPOSITE" || st.operation === "ADD") && !st.scale)
      add("info", `cs-${st.id}`, `${n}: no relative scale set.`, fid);
    if (st.operation === "TEXT_LOGO" && !st.textContent?.trim())
      add("warning", `tx-${st.id}`, `${n}: text content is empty.`, fid);
    if (st.operation === "POSE" && st.sourceImageId) {
      if (m.body_shape.state === "REPLACE" && m.body_shape.sourceImageId === st.sourceImageId)
        add(
          "warning",
          `pose-shape-${st.id}`,
          `${n}: Pose source also supplies Body Shape. Remove that assignment if only pose/body position should transfer.`,
          "attr-body_shape",
        );
      if (
        m.body_proportions.state === "REPLACE" &&
        m.body_proportions.sourceImageId === st.sourceImageId
      )
        add(
          "warning",
          `pose-prop-${st.id}`,
          `${n}: Pose source also supplies Body Proportions. Remove that assignment if proportions should stay from the base.`,
          "attr-body_proportions",
        );
    }
  });

  const locks = ATTRIBUTES.filter((a) => m[a].state === "LOCK").length;
  if (s.images.length && locks < 3)
    add(
      "warning",
      "pres",
      "Preservation coverage is low — lock more attributes from the base canvas.",
      "attr-matrix",
    );
  if (s.isPromptDirty && s.blocks.length)
    add(
      "info",
      "prompt-dirty",
      "Structured relationships changed since the last build. Copy/Save/Refine will rebuild first.",
    );
  return out;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function diagnose(s: ProjectState, issues: ValidationIssue[]): DiagnosticScore[] {
  const m = s.attributeMatrix;
  const mk = (
    key: string,
    label: string,
    ded: { reason: string; points: number }[],
  ): DiagnosticScore => ({
    key,
    label,
    deductions: ded.filter((d) => d.points > 0),
    value: clamp(100 - ded.reduce((a, d) => a + d.points, 0)),
  });

  const ref: { reason: string; points: number }[] = [];
  if (!s.images.length) ref.push({ reason: "No images uploaded", points: 100 });
  if (!s.selectedBaseImageId) ref.push({ reason: "No base canvas", points: 35 });
  s.images.forEach((i) => {
    if (i.role === "Custom" && !i.customRole)
      ref.push({ reason: `${i.tag} custom role unnamed`, points: 10 });
  });
  issues
    .filter((i) => i.id.startsWith("unref-"))
    .forEach((i) => ref.push({ reason: i.message, points: 12 }));
  issues
    .filter((i) => i.id.startsWith("dup-") || i.id === "multi-base")
    .forEach((i) => ref.push({ reason: i.message, points: 10 }));
  s.images.forEach((i) => {
    if (i.id !== s.selectedBaseImageId && !i.description && i.role !== "Unused")
      ref.push({ reason: `${i.tag} has no description`, points: 3 });
  });

  const tgt: { reason: string; points: number }[] = [];
  if (!s.editSteps.length) tgt.push({ reason: "No edit steps", points: 60 });
  issues
    .filter(
      (i) => i.id.startsWith("st-") || i.id.startsWith("ss-") || i.id.startsWith("target-gone-"),
    )
    .forEach((i) => tgt.push({ reason: i.message, points: 20 }));
  s.editSteps.forEach((e, i) => {
    if (!e.targetId && e.targetScope !== "canvas" && !e.targetText && !e.sourceImageId)
      tgt.push({ reason: `Edit ${i + 1} has neither target nor source`, points: 10 });
  });

  const sep: { reason: string; points: number }[] = [];
  issues
    .filter((i) => /^(conf|lockrep|exc|id-multi|src)-?/.test(i.id))
    .forEach((i) => sep.push({ reason: i.message, points: 25 }));
  issues
    .filter((i) => i.id.startsWith("wbody") || i.id.startsWith("pose-"))
    .forEach((i) => sep.push({ reason: i.message, points: 10 }));
  s.images
    .filter((i) => i.id !== s.selectedBaseImageId && i.role !== "Unused")
    .forEach((i) => {
      if (i.role === "Custom" && !i.excludes.length)
        sep.push({ reason: `${i.tag} has no exclusions`, points: 8 });
    });

  const pres: { reason: string; points: number }[] = [];
  const locked = ATTRIBUTES.filter((a) => m[a].state === "LOCK");
  const free = ATTRIBUTES.filter((a) => m[a].state === "FREE");
  for (const a of [
    "face_identity",
    "pose",
    "body_shape",
    "body_proportions",
    "camera",
    "background",
    "lighting",
  ] as const)
    if (m[a].state === "FREE")
      pres.push({ reason: `${ATTR_LABEL[a]} is FREE (unconstrained)`, points: 8 });
  if (locked.length < 4)
    pres.push({ reason: `Only ${locked.length} attributes locked`, points: 20 });
  if (free.length > 10) pres.push({ reason: `${free.length} attributes left FREE`, points: 10 });

  const spatialOps = s.editSteps.filter(
    (e) => OPERATION_POLICY[e.operation].integration === "spatial",
  );
  const sp: { reason: string; points: number }[] = [];
  spatialOps.forEach((e, i) => {
    if (e.operation === "MOVE" && !s.movements.some((x) => x.targetId === e.targetId))
      sp.push({ reason: `Move step ${i + 1} has no canvas arrow`, points: 25 });
    if (
      OPERATION_POLICY[e.operation].needsDestination &&
      !e.destination &&
      !s.movements.some((x) => x.targetId === e.targetId)
    )
      sp.push({ reason: `${e.operation} has no destination`, points: 25 });
    if (["ADD", "COMPOSITE", "RESIZE"].includes(e.operation) && !e.scale)
      sp.push({ reason: `${e.operation} has no scale`, points: 10 });
  });
  if (
    !spatialOps.length &&
    s.targets.length === 0 &&
    s.editSteps.some((e) => ["REMOVE", "INPAINT"].includes(e.operation))
  )
    sp.push({ reason: "Removal/inpaint without a canvas target", points: 20 });

  const phys: { reason: string; points: number }[] = [];
  if (s.promptLevel === "simple")
    phys.push({ reason: "Simple level omits physical integration detail", points: 35 });
  if (s.promptLevel === "advanced" && spatialOps.length)
    phys.push({ reason: "Advanced level has less detailed shadow/occlusion guidance", points: 15 });
  const ib = s.blocks.find((b) => b.id === "integration");
  if (ib && !ib.enabled) phys.push({ reason: "Physical Integration block disabled", points: 30 });
  const rb = s.blocks.find((b) => b.id === "reconstruction");
  if (
    rb &&
    !rb.enabled &&
    s.editSteps.some((e) => OPERATION_POLICY[e.operation].reconstruction !== "none")
  )
    phys.push({
      reason: "Reconstruction block disabled for an operation that may expose source regions",
      points: 30,
    });

  return [
    mk("ref", "Reference clarity", ref),
    mk("tgt", "Target clarity", tgt),
    mk("sep", "Attribute separation", sep),
    mk("pres", "Preservation coverage", pres),
    mk("spatial", "Spatial clarity", sp),
    mk("phys", "Physical integration", phys),
  ];
}
