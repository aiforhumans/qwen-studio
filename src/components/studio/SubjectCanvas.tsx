import { describePos } from "@/lib/compiler";
import { projectStore, useProject } from "@/lib/project-store";
import { cn } from "@/lib/utils";
import { Crosshair, MousePointer2, MoveRight, Sparkles, Square, Trash2 } from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import type { CanvasMode } from "./SubjectCanvasInner";
import { NSelect, SectionHeader, TInput } from "./ui-bits";

const Inner = lazy(() => import("./SubjectCanvasInner"));

const MODES: { id: CanvasMode; label: string; icon: typeof Crosshair; hint: string }[] = [
  {
    id: "select",
    label: "Select",
    icon: MousePointer2,
    hint: "Click a target to select it; drag to reposition.",
  },
  { id: "point", label: "Point", icon: Crosshair, hint: "Click to drop a point target." },
  { id: "box", label: "Box", icon: Square, hint: "Drag to draw a target region." },
  {
    id: "move",
    label: "Move",
    icon: MoveRight,
    hint: "Select a target, then drag from its source to the destination. With nothing selected, a new target is created at the drag start.",
  },
];

export function SubjectCanvas() {
  const p = useProject();
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<CanvasMode>("select");
  const [imageId, setImageId] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | undefined>();
  useEffect(() => setMounted(true), []);
  const shownId =
    imageId && p.images.some((i) => i.id === imageId)
      ? imageId
      : (p.selectedBaseImageId ?? p.images[0]?.id);
  const targets = p.targets.filter((t) => t.imageId === shownId);
  useEffect(() => {
    setSelected(undefined);
  }, [shownId]);

  const del = (id: string) =>
    projectStore.update((s) => ({
      ...s,
      targets: s.targets.filter((t) => t.id !== id),
      movements: s.movements.filter((m) => m.targetId !== id),
      editSteps: s.editSteps.map((e) => (e.targetId === id ? { ...e, targetId: undefined } : e)),
    }));
  const rename = (id: string, label: string) =>
    projectStore.update(
      (s) => ({ ...s, targets: s.targets.map((t) => (t.id === id ? { ...t, label } : t)) }),
      { history: false },
    );

  return (
    <section aria-label="Visual subject selector" className="rounded border bg-panel">
      <SectionHeader title="Visual Subject Selector">
        <NSelect
          aria-label="Image shown on canvas"
          value={shownId ?? ""}
          onChange={(e) => setImageId(e.target.value)}
          className="h-6 w-36"
        >
          {p.images.map((i) => (
            <option key={i.id} value={i.id}>
              {i.tag} {i.role}
            </option>
          ))}
        </NSelect>
      </SectionHeader>
      <div
        className="flex items-center gap-1 border-b px-2 py-1.5"
        role="toolbar"
        aria-label="Canvas modes"
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            title={m.hint}
            className={cn(
              "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px]",
              mode === m.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <m.icon className="h-3.5 w-3.5" />
            {m.label}
          </button>
        ))}
        <span className="ml-2 truncate text-[11px] text-muted-foreground">
          {MODES.find((m) => m.id === mode)?.hint}
        </span>
      </div>
      <div className="bg-background/60 p-2">
        {mounted ? (
          <Suspense fallback={<div className="h-64" />}>
            <Inner imageId={shownId} mode={mode} selected={selected} onSelect={setSelected} />
          </Suspense>
        ) : (
          <div className="h-64" />
        )}
      </div>
      {targets.length > 0 && (
        <ul className="divide-y border-t">
          {targets.map((t) => {
            const mv = p.movements.find((m) => m.targetId === t.id);
            const c =
              t.point ??
              (t.bbox ? { x: t.bbox.x + t.bbox.w / 2, y: t.bbox.y + t.bbox.h / 2 } : undefined);
            return (
              <li
                key={t.id}
                className={cn(
                  "flex items-center gap-2 px-2 py-1 text-[11px]",
                  selected === t.id && "bg-primary/5",
                )}
              >
                <button
                  onClick={() => setSelected(t.id)}
                  className={cn(
                    "w-12 shrink-0 text-left font-mono",
                    selected === t.id ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {t.type === "vision_proposal" ? (
                    <span className="inline-flex items-center gap-0.5">
                      <Sparkles className="h-3 w-3" />
                      AI
                    </span>
                  ) : (
                    t.type
                  )}
                </button>
                <TInput
                  aria-label="Target label"
                  value={t.label}
                  onChange={(e) => rename(t.id, e.target.value)}
                  className="h-6 w-40"
                />
                <span className="truncate text-muted-foreground">
                  {mv
                    ? `${describePos(mv.from.x, mv.from.y)} → ${describePos(mv.to.x, mv.to.y)}`
                    : c
                      ? describePos(c.x, c.y)
                      : "no geometry (proposal)"}
                </span>
                <button
                  aria-label={`Delete ${t.label}`}
                  onClick={() => del(t.id)}
                  className="ml-auto p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
