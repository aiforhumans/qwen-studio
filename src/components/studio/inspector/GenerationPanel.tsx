import { Button } from "@/components/ui/button";
import { projectStore } from "@/lib/project-store";
import { getModelSettings } from "@/lib/providers";
import { Play, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";

import type { PromptInspectorModel } from "./use-prompt-inspector";
export function GenerationPanel({ model }: { model: PromptInspectorModel }) {
  const { p, refining, qwenBusy, qwenResults, setView, refine, runQwen } = model;
  return (
    <div className="space-y-3">
      <div className="rounded border bg-card p-2.5 space-y-2">
        <h4 className="text-[11px] font-semibold flex items-center gap-1.5">
          <Wand2 className="h-3.5 w-3.5 text-primary" />
          AI Prompt Refinement
        </h4>
        <p className="text-[10.5px] text-muted-foreground">
          Polishes wording for maximum fluency using your configured language model.
          Relationship-bearing blocks stay verbatim.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px] flex-1"
            onClick={refine}
            disabled={refining}
          >
            <Sparkles className="h-3 w-3" />
            {refining ? "Refining…" : "Refine Wording"}
          </Button>
          {p.refinedPrompt && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px]"
              onClick={() => {
                projectStore.update((s) => ({ ...s, refinedPrompt: undefined }), {
                  history: false,
                });
                setView("det");
                toast.success("Discarded refined prompt; reverted to deterministic compiler.");
              }}
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {getModelSettings().active === "qwen_pe" ? (
        <div className="rounded border p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold flex items-center gap-1.5">
              <Play className="h-3.5 w-3.5 text-primary" />
              Official Model Studio Direct Run
            </h4>
            <Button
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => void runQwen()}
              disabled={qwenBusy}
            >
              {qwenBusy ? "Generating…" : "Generate Now"}
            </Button>
          </div>
          <p className="text-[10.5px] text-muted-foreground">
            Sends ordered reference images and your compiled prompt to Alibaba Cloud Model Studio.
          </p>
          {!!qwenResults.length && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              {qwenResults.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded border bg-background"
                >
                  <img
                    src={url}
                    alt={`Qwen result ${i + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                  <span className="block truncate px-1.5 py-1 text-[10px] text-muted-foreground">
                    Result {i + 1}
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded border border-dashed p-2.5 text-[11px] text-muted-foreground">
          <p>
            To run image edits directly within the app, connect Official Qwen Image Edit in{" "}
            <a href="/models" className="text-primary underline">
              Model Settings
            </a>
            . Otherwise, use the copy button above to paste into ComfyUI or your preferred WebUI!
          </p>
        </div>
      )}
    </div>
  );
}
