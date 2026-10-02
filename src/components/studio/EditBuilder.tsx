import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ATTR_LABEL, OP_FIELDS, OP_LABEL, stepAttrs } from "@/lib/constants";
import { actions, useProject } from "@/lib/project-store";
import {
  ATTRIBUTES,
  OPERATIONS,
  type Attribute,
  type EditStep,
  type Operation,
  type PromptLevel,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Field, NSelect, SectionHeader, TInput } from "./ui-bits";

export function OperationBar() {
  const p = useProject();
  return (
    <div className="space-y-2 rounded border bg-panel p-2.5">
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Operation">
        {OPERATIONS.map((o) => (
          <button
            key={o}
            role="radio"
            aria-checked={p.operation === o}
            onClick={() => actions.setField("operation", o)}
            className={cn(
              "rounded border px-2 py-0.5 text-[11px] font-medium transition-colors",
              p.operation === o
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {OP_LABEL[o]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Field label="Goal / user instruction (optional)" className="col-span-2 sm:col-span-1">
          <TInput
            value={p.userInstruction}
            onChange={(e) => actions.setField("userInstruction", e.target.value)}
            placeholder="e.g. editorial look for a fashion lookbook"
          />
        </Field>
        <Field label="Prompt level">
          <NSelect
            value={p.promptLevel}
            onChange={(e) => actions.setField("promptLevel", e.target.value as PromptLevel)}
          >
            <option value="simple">Simple</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </NSelect>
        </Field>
        <Field label="Project">
          <TInput
            className="w-40"
            value={p.name}
            onChange={(e) => actions.setField("name", e.target.value)}
            aria-label="Project name"
          />
        </Field>
      </div>
      <label
        id="identity-override"
        className="flex items-center gap-2 text-[11px] text-muted-foreground"
      >
        <Switch
          checked={p.identityOverride}
          onCheckedChange={(v) => actions.setField("identityOverride", v)}
          aria-label="Allow multiple identity references"
        />
        Allow multiple identity references intentionally (advanced override)
      </label>
    </div>
  );
}

export function EditSteps() {
  const p = useProject();
  return (
    <section aria-label="Edit steps" className="rounded border bg-panel">
      <SectionHeader title={`Edit Steps · ${p.editSteps.length}`}>
        <Button
          id="add-edit"
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[11px]"
          onClick={() => actions.addStep()}
        >
          <Plus className="h-3 w-3" /> Add edit ({OP_LABEL[p.operation]})
        </Button>
      </SectionHeader>
      <div className="space-y-2 p-2">
        {!p.editSteps.length && (
          <p className="p-2 text-[12px] text-muted-foreground">
            No edits yet. Pick an operation above and add an edit, or apply a template.
          </p>
        )}
        {p.editSteps.map((s, i) => (
          <StepCard key={s.id} step={s} index={i} total={p.editSteps.length} />
        ))}
      </div>
    </section>
  );
}

function StepCard({ step, index, total }: { step: EditStep; index: number; total: number }) {
  const p = useProject();
  const f = OP_FIELDS[step.operation];
  const u = (patch: Partial<EditStep>) => actions.updateStep(step.id, patch);
  const sources = p.images.filter((i) => i.id !== p.selectedBaseImageId);
  const src = p.images.find((i) => i.id === step.sourceImageId);
  const covered = stepAttrs(step);
  const hasErr = p.issues.some((i) => i.focus === `step-${step.id}` && i.severity === "error");
  return (
    <div
      id={`step-${step.id}`}
      className={cn("rounded border bg-card p-2", hasErr && "border-destructive/60")}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">#{index + 1}</span>
        <NSelect
          aria-label="Step operation"
          value={step.operation}
          onChange={(e) => u({ operation: e.target.value as Operation })}
          className="w-32 font-medium"
        >
          {OPERATIONS.map((o) => (
            <option key={o} value={o}>
              {OP_LABEL[o]}
            </option>
          ))}
        </NSelect>
        {/* Visual relationship */}
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-[11px]">
          {src ? (
            <span className="tag-chip">{src.tag}</span>
          ) : f.source ? (
            <span className="text-destructive">no source</span>
          ) : null}
          {covered.length > 0 && (
            <span className="truncate text-replace">
              {covered.map((a) => ATTR_LABEL[a]).join(", ")}
            </span>
          )}
          <span className="text-muted-foreground">→</span>
          <span className="truncate">
            {step.targetText ||
              (step.targetScope === "canvas"
                ? "Canvas"
                : p.targets.find((t) => t.id === step.targetId)?.label) ||
              "target"}
          </span>
        </div>
        <button
          aria-label="Move step up"
          disabled={index === 0}
          onClick={() => actions.moveStep(step.id, -1)}
          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ArrowUp className="h-3 w-3" />
        </button>
        <button
          aria-label="Move step down"
          disabled={index === total - 1}
          onClick={() => actions.moveStep(step.id, 1)}
          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
        >
          <ArrowDown className="h-3 w-3" />
        </button>
        <button
          aria-label="Delete step"
          onClick={() => actions.removeStep(step.id)}
          className="p-0.5 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Field label="Canvas target">
          <NSelect
            value={step.targetScope === "canvas" ? "__canvas__" : (step.targetId ?? "")}
            onChange={(e) =>
              u({
                targetScope: e.target.value === "__canvas__" ? "canvas" : undefined,
                targetId: e.target.value === "__canvas__" ? undefined : e.target.value || undefined,
              })
            }
          >
            <option value="">— none —</option>
            <option value="__canvas__">Canvas</option>
            {p.targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
                {t.type === "vision_proposal" ? " (AI)" : ""}
              </option>
            ))}
          </NSelect>
        </Field>
        <Field label="Target description">
          <TInput
            value={step.targetText ?? ""}
            onChange={(e) => u({ targetText: e.target.value })}
            placeholder="the red mug"
          />
        </Field>
        {f.source && (
          <Field label="Source image">
            <NSelect
              value={step.sourceImageId ?? ""}
              onChange={(e) => u({ sourceImageId: e.target.value || undefined })}
              className={cn(!step.sourceImageId && "border-destructive/60")}
            >
              <option value="">— choose —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tag} · {s.role}
                </option>
              ))}
            </NSelect>
          </Field>
        )}
        {f.attr && (
          <Field label="Source attribute">
            <NSelect
              value={step.sourceAttribute ?? ""}
              onChange={(e) =>
                u({ sourceAttribute: (e.target.value || undefined) as Attribute | undefined })
              }
            >
              <option value="">— whole subject —</option>
              {ATTRIBUTES.map((a) => (
                <option key={a} value={a}>
                  {ATTR_LABEL[a]}
                </option>
              ))}
            </NSelect>
          </Field>
        )}
        {f.dest && (
          <Field label="Destination / placement">
            <TInput
              value={step.destination ?? ""}
              onChange={(e) => u({ destination: e.target.value })}
              placeholder="on the table, left of the vase"
            />
          </Field>
        )}
        {f.scale && (
          <>
            <Field label="Scale">
              <TInput
                value={step.scale ?? ""}
                onChange={(e) => u({ scale: e.target.value })}
                placeholder="same / 1.5x / 50%"
              />
            </Field>
            <Field label="Orientation">
              <TInput
                value={step.orientation ?? ""}
                onChange={(e) => u({ orientation: e.target.value })}
                placeholder="facing camera"
              />
            </Field>
          </>
        )}
        {f.text && (
          <>
            <Field label="Exact text">
              <TInput
                value={step.textContent ?? ""}
                onChange={(e) => u({ textContent: e.target.value })}
                placeholder="OPEN 24H"
              />
            </Field>
            <label className="flex items-center gap-1.5 self-end pb-1 text-[11px]">
              <input
                type="checkbox"
                checked={!!step.exactSpelling}
                onChange={(e) => u({ exactSpelling: e.target.checked })}
              />{" "}
              Preserve exact spelling
            </label>
          </>
        )}
        <Field label="Specific instruction" className="col-span-2 lg:col-span-4">
          <TInput
            value={step.instructions ?? ""}
            onChange={(e) => u({ instructions: e.target.value })}
            placeholder="Free-form details for this edit only"
          />
        </Field>
      </div>
    </div>
  );
}
