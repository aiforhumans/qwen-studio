import { copyText } from "@/lib/studio-workflows";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

import type { PromptInspectorModel } from "./use-prompt-inspector";
export function LogsPanel({ model }: { model: PromptInspectorModel }) {
  const { logs } = model;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-muted-foreground">Recent Event Stream</span>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10.5px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              const text = logger.exportLogsText();
              void copyText(text, "Logs copied to clipboard as text");
            }}
          >
            Copy Text
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[10.5px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              logger.clear();
              toast.success("Logs cleared");
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto space-y-1 rounded border bg-card/50 p-1.5 text-[11px] font-mono">
        {!logs.length ? (
          <p className="p-3 text-center text-muted-foreground font-sans">No logged events yet.</p>
        ) : (
          logs.slice(0, 50).map((l) => {
            const levelClass =
              l.level === "error"
                ? "text-destructive font-semibold"
                : l.level === "warn"
                  ? "text-warn font-semibold"
                  : l.level === "info"
                    ? "text-primary"
                    : "text-muted-foreground";
            const time = new Date(l.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            return (
              <div
                key={l.id}
                className="rounded border border-border/40 bg-background/60 px-2 py-1 leading-snug hover:bg-muted/30"
              >
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className={levelClass}>[{l.level.toUpperCase()}]</span>
                    <span className="rounded bg-muted px-1 py-0.2 text-[9.5px] uppercase font-sans text-muted-foreground">
                      {l.category}
                    </span>
                  </div>
                  <span className="text-muted-foreground/70">{time}</span>
                </div>
                <div className="mt-0.5 text-foreground/90 font-sans">{l.message}</div>
                {l.details !== undefined && (
                  <div className="mt-1 max-h-16 overflow-x-auto rounded bg-muted/40 p-1 text-[9.5px] text-muted-foreground">
                    {JSON.stringify(l.details)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
