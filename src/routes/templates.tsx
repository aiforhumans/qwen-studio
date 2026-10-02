import { PageFrame } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ATTR_SHORT, OP_LABEL, TEMPLATES } from "@/lib/constants";
import { actions, useProject } from "@/lib/project-store";
import type { Attribute } from "@/lib/types";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Prompt Library — Qwen Image 2.1 Prompt Studio" },
      {
        name: "description",
        content:
          "One-click Qwen-Image-2.1 edit templates: outfit transfer, face replacement, object movement and more.",
      },
      { property: "og:title", content: "Prompt Library — Qwen Image 2.1" },
      {
        property: "og:description",
        content: "Edit templates that configure roles, operations and attribute locks.",
      },
    ],
  }),
  component: Templates,
});

function Templates() {
  const p = useProject();
  const nav = useNavigate();
  return (
    <PageFrame
      title="Prompt Library"
      desc="Applying a template sets the operation, role slots (in upload order) and matrix defaults. Uploaded images are kept."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((t) => {
          const locks = (Object.entries(t.matrix) as [Attribute, string][])
            .filter(([, s]) => s === "LOCK")
            .map(([a]) => ATTR_SHORT[a]);
          const reps = (Object.entries(t.matrix) as [Attribute, string][])
            .filter(([, s]) => s === "REPLACE")
            .map(([a]) => ATTR_SHORT[a]);
          const active = p.metadata.templateId === t.id;
          return (
            <article
              key={t.id}
              className={`flex flex-col rounded border bg-card p-3 ${active ? "border-primary/60" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{t.name}</h2>
                <span className="rounded border px-1.5 text-[10px] text-muted-foreground">
                  {OP_LABEL[t.operation]}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">{t.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {t.slots.map((r, i) => (
                  <span key={i} className="tag-chip">
                    {`<image${i + 1}>`} {r}
                  </span>
                ))}
              </div>
              <div className="mt-2 space-y-0.5 text-[11px]">
                {reps.length > 0 && (
                  <div>
                    <span className="text-replace">REPLACE</span> {reps.join(", ")}
                  </div>
                )}
                {locks.length > 0 && (
                  <div>
                    <span className="text-lock">LOCK</span> {locks.join(", ")}
                  </div>
                )}
              </div>
              <div className="mt-auto pt-3">
                <Button
                  size="sm"
                  className="h-7 w-full text-[11px]"
                  onClick={() => {
                    actions.applyTemplate(t.id);
                    const missing = t.slots.length - p.images.length;
                    toast.success(
                      `Applied ${t.name}${missing > 0 ? ` — upload ${missing} more image(s) to fill the role slots` : ""}`,
                    );
                    nav({ to: "/" });
                  }}
                >
                  Apply
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </PageFrame>
  );
}
