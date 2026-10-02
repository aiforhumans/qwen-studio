import { demoProject, emptyProject } from "@/lib/project-store";
import type { EditStep, ProjectState, RefImage } from "@/lib/types";
import { diagnose, validate } from "@/lib/validator";
import { describe, expect, it } from "vitest";

describe("Diagnostic Validator & Scoring Engine", () => {
  it("emits informational and error issues for an empty project", () => {
    const p = emptyProject();
    const issues = validate(p);

    expect(issues.some((i) => i.id === "no-images" && i.severity === "info")).toBe(true);
    expect(issues.some((i) => i.id === "no-op" && i.severity === "error")).toBe(true);
  });

  it("validates demo project without blocking error issues", () => {
    const demo = demoProject();
    const issues = validate(demo);
    const errors = issues.filter((i) => i.severity === "error");

    expect(errors).toHaveLength(0);
  });

  it("detects identity collision (id-multi) when multiple images provide face identity without override", () => {
    const demo = demoProject();
    const secondFaceImage: RefImage = {
      id: "demo4",
      tag: "<image4>",
      filename: "face_alt.jpg",
      width: 1024,
      height: 1024,
      role: "Face Identity",
      importance: "High",
      uses: ["face_identity"],
      excludes: [],
      locks: [],
    };

    const conflictingState: ProjectState = {
      ...demo,
      images: [...demo.images, secondFaceImage],
      identityOverride: false,
    };

    const issues = validate(conflictingState);
    expect(issues.some((i) => i.id === "id-multi" && i.severity === "error")).toBe(true);

    // Permitting identity override should clear the error
    const overriddenState: ProjectState = {
      ...conflictingState,
      identityOverride: true,
    };
    const overriddenIssues = validate(overriddenState);
    expect(overriddenIssues.some((i) => i.id === "id-multi")).toBe(false);
  });

  it("detects missing targets for spatial operations", () => {
    const demo = demoProject();
    const moveStepWithoutTarget: EditStep = {
      id: "step-missing-target",
      operation: "MOVE",
      sourceImageId: "demo2",
      targetId: "nonexistent-target-id",
    };

    const stateWithBadStep: ProjectState = {
      ...demo,
      editSteps: [moveStepWithoutTarget],
    };

    const issues = validate(stateWithBadStep);
    expect(
      issues.some((i) => i.id === "target-gone-step-missing-target" && i.severity === "error"),
    ).toBe(true);
  });

  it("warns when an image exact-locks attributes it is not actively supplying", () => {
    const demo = demoProject();
    // Image 2 is Wardrobe, but we tell it to exact-lock texture which it doesn't transfer
    const updatedImages = demo.images.map((img) =>
      img.id === "demo2" ? { ...img, locks: ["texture" as const] } : img,
    );

    const stateWithUnusedLock: ProjectState = {
      ...demo,
      images: updatedImages,
    };

    const issues = validate(stateWithUnusedLock);
    expect(
      issues.some((i) => i.id === "imglock-unused-demo2-texture" && i.severity === "warning"),
    ).toBe(true);
  });

  it("calculates diagnostic readiness scores across all 6 diagnostic dimensions", () => {
    const demo = demoProject();
    const issues = validate(demo);
    const scores = diagnose(demo, issues);

    expect(scores).toHaveLength(6);
    const labels = scores.map((s) => s.label);
    expect(labels).toContain("Reference clarity");
    expect(labels).toContain("Target clarity");
    expect(labels).toContain("Attribute separation");
    expect(labels).toContain("Preservation coverage");
    expect(labels).toContain("Spatial clarity");
    expect(labels).toContain("Physical integration");

    for (const score of scores) {
      expect(score.value).toBeGreaterThanOrEqual(0);
      expect(score.value).toBeLessThanOrEqual(100);
      expect(Array.isArray(score.deductions)).toBe(true);
    }
  });
});
