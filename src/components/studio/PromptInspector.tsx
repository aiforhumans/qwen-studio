import { BlocksPanel } from "./inspector/BlocksPanel";
import { DiagnosticsPanel } from "./inspector/DiagnosticsPanel";
import { GenerationPanel } from "./inspector/GenerationPanel";
import { InspectorTabs } from "./inspector/InspectorTabs";
import { InspectorToolbar } from "./inspector/InspectorToolbar";
import { LogsPanel } from "./inspector/LogsPanel";
import { PromptOutputCard } from "./inspector/PromptOutputCard";
import { usePromptInspector } from "./inspector/use-prompt-inspector";
import { SectionHeader } from "./ui-bits";
export function PromptInspector() {
  const model = usePromptInspector();
  const { p, subTab } = model;
  return (
    <section aria-label="Prompt inspector" className="flex h-full min-h-0 flex-col">
      <SectionHeader title="Qwen 2.1 Prompt Engine">
        <div className="flex items-center gap-1.5">
          <span className="flex items-center gap-1 font-mono text-[10px] text-ok">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-ok animate-pulse" />
            LIVE
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {p.metadata.compilerVersion}
          </span>
        </div>
      </SectionHeader>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        {/* HERO READY-TO-COPY PROMPT CARD */}
        <PromptOutputCard model={model} />

        {/* Global studio actions */}
        <InspectorToolbar model={model} />

        {/* Sub-panel navigation tabs */}
        <InspectorTabs model={model} />

        {/* SUBTAB 1: 10 MODULAR BLOCKS */}
        {subTab === "blocks" && <BlocksPanel model={model} />}

        {/* SUBTAB 2: DIAGNOSTICS & VALIDATOR */}
        {subTab === "diagnostics" && <DiagnosticsPanel model={model} />}

        {/* SUBTAB 3: AI REFINE & DIRECT GENERATE */}
        {subTab === "qwen_api" && <GenerationPanel model={model} />}

        {/* SUBTAB 4: SYSTEM & COMPILER LOGS */}
        {subTab === "logs" && <LogsPanel model={model} />}
      </div>
    </section>
  );
}
