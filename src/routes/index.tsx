import { AppShell } from "@/components/AppShell";
import { AttributeMatrix, RelationshipGraph } from "@/components/studio/AttributeMatrix";
import { EditSteps, OperationBar } from "@/components/studio/EditBuilder";
import { ImagesPanel } from "@/components/studio/ImagesPanel";
import { PromptInspector } from "@/components/studio/PromptInspector";
import { SubjectCanvas } from "@/components/studio/SubjectCanvas";
import { Button } from "@/components/ui/button";
import { useCopyFeedback } from "@/hooks/use-copy-feedback";
import { useStudioShortcuts } from "@/hooks/use-studio-shortcuts";
import { projectStore, useProject } from "@/lib/project-store";
import { copyReadyPrompt } from "@/lib/studio-workflows";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Redo2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Qwen Image 2.1 — Ready-to-Copy Prompt Studio" },
      {
        name: "description",
        content:
          "Generate instant, ready-to-copy text prompts for Qwen 2.1 image editing with visual role mapping, exact locks and tailored negative prompts.",
      },
      { property: "og:title", content: "Qwen Image 2.1 — Prompt Studio" },
      {
        property: "og:description",
        content: "One-click ready-to-copy prompts for Qwen 2.1 image edit.",
      },
    ],
  }),
  component: Studio,
});

function Studio() {
  const p = useProject();
  const [tab, setTab] = useState<"images" | "build" | "prompt">("build");
  const [hydrated, setHydrated] = useState(false);
  const [copiedQuick, flashCopiedQuick] = useCopyFeedback();
  useEffect(() => setHydrated(true), []);

  const copyQuickPrompt = useCallback(async () => {
    if (await copyReadyPrompt()) flashCopiedQuick();
  }, [flashCopiedQuick]);
  useStudioShortcuts(copyQuickPrompt);

  const right = (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        className={cn(
          "h-7 gap-1 px-2.5 text-[11px] font-medium shadow-sm transition-all copy-btn-active",
          copiedQuick
            ? "bg-ok text-ok-foreground"
            : "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
        onClick={() => void copyQuickPrompt()}
        title="Copy Ready Qwen 2.1 Prompt (Ctrl+Shift+C)"
      >
        {copiedQuick ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        <span className="hidden sm:inline">{copiedQuick ? "Copied!" : "Copy Qwen Prompt"}</span>
      </Button>

      <div className="flex items-center gap-0.5 border-l pl-1.5">
        <button
          aria-label="Undo"
          title="Undo (Ctrl/Cmd+Z)"
          disabled={!projectStore.canUndo()}
          onClick={projectStore.undo}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          aria-label="Redo"
          title="Redo (Ctrl/Cmd+Shift+Z)"
          disabled={!projectStore.canRedo()}
          onClick={projectStore.redo}
          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-30"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  if (!hydrated)
    return (
      <AppShell right={right}>
        <div />
      </AppShell>
    );

  return (
    <AppShell right={right}>
      <div className="flex h-full flex-col">
        <div className="flex border-b lg:hidden" role="tablist">
          {(["images", "build", "prompt"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 py-2 text-[12px] capitalize",
                tab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground",
              )}
            >
              {t === "images"
                ? `Images (${p.images.length})`
                : t === "build"
                  ? "Edit Builder"
                  : "Ready Prompt"}
            </button>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_400px]">
          <aside className={cn("min-h-0 border-r bg-panel", tab !== "images" && "hidden lg:block")}>
            <ImagesPanel />
          </aside>
          <div className={cn("min-h-0 overflow-y-auto", tab !== "build" && "hidden lg:block")}>
            <div className="space-y-3 p-3 pb-16">
              <OperationBar />
              <EditSteps />
              <AttributeMatrix />
              <div className="grid gap-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <RelationshipGraph />
                <SubjectCanvas />
              </div>
            </div>
          </div>
          <aside className={cn("min-h-0 border-l bg-panel", tab !== "prompt" && "hidden lg:block")}>
            <PromptInspector />
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
