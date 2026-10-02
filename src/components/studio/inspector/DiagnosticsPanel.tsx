import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { focusControl } from "@/lib/focus-control";
import { useProject } from "@/lib/project-store";
import { cn } from "@/lib/utils";
import { AlertTriangle, CircleX, Info } from "lucide-react";

import type { PromptInspectorModel } from "./use-prompt-inspector";
export function DiagnosticsPanel({ model }: { model: PromptInspectorModel }) {
  const { p, errors, warns } = model;
  return (
    <div className="space-y-3">
      <Diagnostics />

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="panel-title">Validator</h3>
          <span className="text-[11px]">
            <span className="text-destructive">{errors.length} errors</span> ·{" "}
            <span className="text-warn">{warns.length} warnings</span>
          </span>
        </div>
        {!p.issues.length && (
          <p className="rounded border border-ok/40 bg-ok/10 px-2 py-1 text-[11px] text-ok">
            No issues — all roles, targets and operations are unambiguous.
          </p>
        )}
        <ul className="space-y-1">
          {p.issues.map((i) => (
            <li key={i.id}>
              <button
                onClick={() => focusControl(i.focus)}
                className={cn(
                  "flex w-full items-start gap-1.5 rounded border px-2 py-1 text-left text-[11px] hover:bg-secondary",
                  i.severity === "error"
                    ? "border-destructive/40 text-destructive"
                    : i.severity === "warning"
                      ? "border-warn/40 text-warn"
                      : "border-border text-muted-foreground",
                )}
              >
                {i.severity === "error" ? (
                  <CircleX className="mt-px h-3 w-3 shrink-0" />
                ) : i.severity === "warning" ? (
                  <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                ) : (
                  <Info className="mt-px h-3 w-3 shrink-0" />
                )}
                <span>{i.message}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
function Diagnostics() {
  const p = useProject();
  const conflicts = p.issues.filter((i) => i.severity === "error").length;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="panel-title">Diagnostic readiness</h3>
        <span className={cn("text-[11px]", conflicts ? "text-destructive" : "text-ok")}>
          {conflicts} conflict{conflicts === 1 ? "" : "s"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {p.scores.map((s) => {
          const tone = s.value >= 80 ? "bg-ok" : s.value >= 50 ? "bg-warn" : "bg-destructive";
          return (
            <Popover key={s.key}>
              <PopoverTrigger asChild>
                <button
                  className="rounded border bg-card px-2 py-1 text-left hover:border-primary/50"
                  aria-label={`${s.label} ${s.value}. Show deductions`}
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10.5px] text-muted-foreground">{s.label}</span>
                    <span className="font-mono text-[12px] font-semibold">{s.value}</span>
                  </div>
                  <div className="mt-1 h-1 rounded bg-muted">
                    <div className={cn("h-1 rounded", tone)} style={{ width: `${s.value}%` }} />
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2 text-[11px]">
                <div className="mb-1 font-semibold">
                  {s.label}: {s.value}/100
                </div>
                {!s.deductions.length ? (
                  <p className="text-muted-foreground">No deductions.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {s.deductions.map((d, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{d.reason}</span>
                        <span className="font-mono text-destructive">−{d.points}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}
