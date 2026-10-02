import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Edit3,
  Info,
  RotateCcw,
  Sliders,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { FORMAT_OPTIONS } from "./formats";
import type { PromptInspectorModel } from "./use-prompt-inspector";
export function PromptOutputCard({ model }: { model: PromptInspectorModel }) {
  const {
    p,
    format,
    copiedPrompt,
    copiedNeg,
    copiedBundle,
    showNegative,
    setShowNegative,
    showParams,
    setShowParams,
    isEditingPrompt,
    setIsEditingPrompt,
    setCustomPromptText,
    setCustomNegativeText,
    displayedPrompt,
    displayedNegative,
    stats,
    onFormatChange,
    copyPrompt,
    copyNegative,
    copyBundle,
  } = model;
  return (
    <div className="rounded-lg prompt-hero-card p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-[12px] font-bold tracking-tight text-foreground">
            Ready-to-Copy Text Prompt
          </h2>
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-primary">
            Qwen-Image-2.1
          </span>
          <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground">
            ~{stats.estimatedTokens} tokens
          </span>
        </div>
      </div>

      {/* Format selection pills */}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Prompt format">
        {FORMAT_OPTIONS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={format === f.id}
            onClick={() => onFormatChange(f.id)}
            title={f.desc}
            className={cn(
              "relative rounded px-2 py-1 text-[11px] font-medium transition-all copy-btn-active",
              format === f.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
            )}
          >
            {f.label}
            {f.badge && format !== f.id && (
              <span className="ml-1 text-[9px] text-primary/80">★</span>
            )}
          </button>
        ))}
      </div>

      {/* Quick reference image chips */}
      {p.images.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
          <span className="font-medium">Slots:</span>
          {p.images.map((im) => (
            <span
              key={im.id}
              className={cn(
                "rounded px-1.5 py-0.5 font-mono",
                im.id === p.selectedBaseImageId
                  ? "border border-lock/50 bg-lock/15 text-lock font-medium"
                  : "border border-border bg-secondary text-foreground",
              )}
            >
              {im.tag} {im.role}
            </span>
          ))}
        </div>
      )}

      {/* Prompt output box */}
      <div className="relative rounded border bg-background/90 p-2 shadow-inner">
        <div className="mb-1.5 flex items-center justify-between border-b pb-1 text-[10px] text-muted-foreground">
          <span className="font-mono">
            {stats.words} words · {stats.characters} chars · {stats.statusText}
          </span>
          <div className="flex items-center gap-1">
            {isEditingPrompt ? (
              <button
                onClick={() => {
                  setCustomPromptText(null);
                  setIsEditingPrompt(false);
                  toast.success("Reset prompt to live compiler output.");
                }}
                className="flex items-center gap-1 text-warn hover:underline"
              >
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            ) : (
              <button
                onClick={() => {
                  setCustomPromptText(displayedPrompt);
                  setIsEditingPrompt(true);
                }}
                className="flex items-center gap-1 hover:text-foreground"
                title="Edit prompt text directly before copying"
              >
                <Edit3 className="h-3 w-3" /> Edit text
              </button>
            )}
          </div>
        </div>

        <textarea
          aria-label="Ready-to-copy Qwen 2.1 text prompt"
          value={displayedPrompt}
          rows={Math.max(6, Math.min(14, displayedPrompt.split("\n").length + 2))}
          onChange={(e) => {
            setCustomPromptText(e.target.value);
            setIsEditingPrompt(true);
          }}
          readOnly={!isEditingPrompt}
          className={cn(
            "w-full resize-y bg-transparent font-mono text-[11.5px] leading-relaxed focus:outline-none",
            isEditingPrompt ? "text-foreground" : "text-foreground/90 selection:bg-primary/25",
          )}
        />
      </div>

      {/* Main Action Buttons */}
      <div className="space-y-1.5 pt-0.5">
        <Button
          size="default"
          className={cn(
            "w-full h-9 font-semibold text-[12px] gap-1.5 shadow transition-all copy-btn-active",
            copiedPrompt
              ? "bg-ok text-ok-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          onClick={() => void copyPrompt()}
          title="Copy Qwen 2.1 prompt to clipboard (Ctrl+Shift+C)"
        >
          {copiedPrompt ? (
            <>
              <Check className="h-4 w-4" />
              Copied to Clipboard!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              Copy Ready Prompt for Qwen 2.1
            </>
          )}
        </Button>

        <div className="grid grid-cols-2 gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-[11px] copy-btn-active"
            onClick={() => void copyNegative()}
            title="Copy edit-specific negative prompt"
          >
            {copiedNeg ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
            Copy Negative
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-[11px] copy-btn-active"
            onClick={() => void copyBundle()}
            title="Copy Positive Prompt + Negative Prompt + Recommended Parameters"
          >
            {copiedBundle ? <Check className="h-3 w-3 text-ok" /> : <Copy className="h-3 w-3" />}
            Copy Full Bundle
          </Button>
        </div>
      </div>

      {/* Collapsible Negative Prompt drawer */}
      <div className="rounded border bg-card/60">
        <button
          onClick={() => setShowNegative((v) => !v)}
          className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11px] font-medium hover:bg-secondary/40"
        >
          <span className="flex items-center gap-1.5">
            <Sliders className="h-3 w-3 text-muted-foreground" />
            Negative Prompt for Qwen 2.1
          </span>
          {showNegative ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showNegative && (
          <div className="border-t p-2 space-y-1.5">
            <textarea
              aria-label="Negative prompt text"
              value={displayedNegative}
              rows={3}
              onChange={(e) => setCustomNegativeText(e.target.value)}
              className="w-full rounded border bg-background p-1.5 font-mono text-[10.5px] leading-snug"
            />
            <div className="flex justify-between items-center text-[10.5px] text-muted-foreground">
              <span>Filtered for active operations and attributes.</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px]"
                onClick={() => void copyNegative()}
              >
                Copy Negative
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Recommended Qwen Parameters */}
      <div className="rounded border bg-card/60">
        <button
          onClick={() => setShowParams((v) => !v)}
          className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[11px] font-medium hover:bg-secondary/40"
        >
          <span className="flex items-center gap-1.5">
            <Info className="h-3 w-3 text-muted-foreground" />
            Recommended Qwen 2.1 Parameters
          </span>
          {showParams ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {showParams && (
          <div className="border-t p-2 space-y-1 text-[11px] font-mono text-muted-foreground">
            <div className="flex justify-between">
              <span>Model Architecture:</span>
              <span className="text-foreground">Qwen-Image-2.1 (7B Unified)</span>
            </div>
            <div className="flex justify-between">
              <span>Inference Steps:</span>
              <span className="text-foreground">40 (28–50)</span>
            </div>
            <div className="flex justify-between">
              <span>CFG Scale:</span>
              <span className="text-foreground">4.0 (3.5–4.5)</span>
            </div>
            <div className="flex justify-between">
              <span>Recommended Sampler:</span>
              <span className="text-foreground">DPM++ 2M or Euler</span>
            </div>
            <div className="flex justify-between">
              <span>Native Aspect Ratio:</span>
              <span className="text-foreground">Match &lt;image1&gt;</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
