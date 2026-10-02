import { Switch } from "@/components/ui/switch";
import { compileBlock } from "@/lib/compiler";
import { BLOCK_META } from "@/lib/constants";
import { projectStore } from "@/lib/project-store";
import { cn } from "@/lib/utils";
import { GripVertical, Lock, LockOpen, RotateCcw } from "lucide-react";

import type { PromptInspectorModel } from "./use-prompt-inspector";
export function BlocksPanel({ model }: { model: PromptInspectorModel }) {
  const { p, dragId, setDragId, patchBlock, reorder } = model;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Drag to reorder blocks · Lock to prevent overwrites</span>
      </div>

      <div className="space-y-1.5">
        {p.blocks.map((b, idx) => {
          const meta = BLOCK_META[b.id];
          return (
            <div
              key={b.id}
              draggable
              onDragStart={() => setDragId(b.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragId) reorder(dragId, b.id);
                setDragId(null);
              }}
              className={cn("rounded border bg-card", !b.enabled && "opacity-50")}
              style={{ borderLeft: `3px solid ${meta.color}` }}
            >
              <div className="flex items-center gap-1 px-1.5 py-1">
                <GripVertical className="h-3 w-3 cursor-grab text-muted-foreground" aria-hidden />
                <span className="text-[11px] font-semibold" style={{ color: meta.color }}>
                  {idx + 1}. {meta.title}
                </span>
                {b.edited && <span className="text-[9.5px] text-muted-foreground">edited</span>}
                <div className="ml-auto flex items-center gap-0.5">
                  <button
                    aria-label={b.locked ? "Unlock block" : "Lock block from regeneration"}
                    title={b.locked ? "Locked: kept on rebuild" : "Lock from regeneration"}
                    onClick={() => patchBlock(b.id, { locked: !b.locked })}
                    className={cn(
                      "p-0.5",
                      b.locked ? "text-replace" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {b.locked ? <Lock className="h-3 w-3" /> : <LockOpen className="h-3 w-3" />}
                  </button>
                  <button
                    aria-label="Regenerate this block"
                    title="Regenerate/reset this block"
                    onClick={() => {
                      const t = compileBlock(projectStore.get(), b.id);
                      patchBlock(b.id, {
                        text: t,
                        generated: t,
                        edited: false,
                        locked: false,
                      });
                    }}
                    className="p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                  <Switch
                    aria-label={`Enable ${meta.title}`}
                    checked={b.enabled}
                    onCheckedChange={(v) => patchBlock(b.id, { enabled: v })}
                    className="ml-1 scale-75"
                  />
                </div>
              </div>
              <textarea
                aria-label={`${meta.title} text`}
                value={b.text}
                rows={Math.max(
                  1,
                  Math.min(8, Math.ceil(b.text.length / 52) + (b.text.split("\n").length - 1)),
                )}
                placeholder="(empty — not applicable)"
                onChange={(e) =>
                  patchBlock(b.id, { text: e.target.value, edited: true, locked: true }, false)
                }
                className="block w-full resize-y border-t bg-transparent px-2 py-1 text-[11.5px] leading-snug placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
