import { cn } from "@/lib/utils";

import type { PromptInspectorModel } from "./use-prompt-inspector";
export function InspectorTabs({ model }: { model: PromptInspectorModel }) {
  const { logs, subTab, setSubTab, errors } = model;
  return (
    <div className="flex border-b text-[11px]" role="tablist">
      <button
        role="tab"
        aria-selected={subTab === "blocks"}
        onClick={() => setSubTab("blocks")}
        className={cn(
          "flex-1 pb-1.5 font-medium border-b-2 transition-colors",
          subTab === "blocks"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        10 Modular Blocks
      </button>
      <button
        role="tab"
        aria-selected={subTab === "diagnostics"}
        onClick={() => setSubTab("diagnostics")}
        className={cn(
          "flex-1 pb-1.5 font-medium border-b-2 transition-colors",
          subTab === "diagnostics"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        Diagnostics ({errors.length ? `${errors.length} err` : "0 err"})
      </button>
      <button
        role="tab"
        aria-selected={subTab === "qwen_api"}
        onClick={() => setSubTab("qwen_api")}
        className={cn(
          "flex-1 pb-1.5 font-medium border-b-2 transition-colors",
          subTab === "qwen_api"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        Refine & Generate
      </button>
      <button
        role="tab"
        aria-selected={subTab === "logs"}
        onClick={() => setSubTab("logs")}
        className={cn(
          "flex-1 pb-1.5 font-medium border-b-2 transition-colors",
          subTab === "logs"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        Logs ({logs.length})
      </button>
    </div>
  );
}
