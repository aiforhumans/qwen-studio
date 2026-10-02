import { Button } from "@/components/ui/button";
import { Download, Hammer, Save, Upload } from "lucide-react";

import { doBuild, doSave } from "@/lib/studio-workflows";
import type { PromptInspectorModel } from "./use-prompt-inspector";
export function InspectorToolbar({ model }: { model: PromptInspectorModel }) {
  const { exportJson, importJson } = model;
  return (
    <div className="flex flex-wrap gap-1 border-y py-1.5">
      <Button
        size="sm"
        variant="secondary"
        className="h-6 text-[10.5px]"
        onClick={doSave}
        title="Ctrl/Cmd+S"
      >
        <Save className="h-3 w-3" /> Save Version
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-6 text-[10.5px]"
        onClick={doBuild}
        title="Ctrl/Cmd+B"
      >
        <Hammer className="h-3 w-3" /> Sync Blocks
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 text-[10.5px]"
        onClick={() => void exportJson()}
      >
        <Download className="h-3 w-3" /> Export
      </Button>
      <Button size="sm" variant="ghost" className="h-6 text-[10.5px]" onClick={importJson}>
        <Upload className="h-3 w-3" /> Import
      </Button>
    </div>
  );
}
