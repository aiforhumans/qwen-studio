import {
  compileQwen21Bundle,
  compileQwen21NegativePrompt,
  compileQwen21Prompt,
  qwenTokenStats,
} from "@/lib/compiler";
import { logger, useLogs } from "@/lib/logger";
import { projectStore, useProject } from "@/lib/project-store";
import type { BlockId, ProjectState, QwenPromptFormat } from "@/lib/types";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useCopyFeedback } from "@/hooks/use-copy-feedback";
import {
  copyText,
  exportProject,
  importProject,
  refineProjectPrompt,
  runQwenEdit,
} from "@/lib/studio-workflows";
export function usePromptInspector() {
  const p = useProject();
  const logs = useLogs();
  const format = p.metadata.promptFormat || "natural";
  const [copiedPrompt, flashCopiedPrompt] = useCopyFeedback();
  const [copiedNeg, flashCopiedNeg] = useCopyFeedback();
  const [copiedBundle, flashCopiedBundle] = useCopyFeedback();
  const [showNegative, setShowNegative] = useState(false);
  const [showParams, setShowParams] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [customPromptText, setCustomPromptText] = useState<string | null>(null);
  const [customNegativeText, setCustomNegativeText] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<"blocks" | "diagnostics" | "qwen_api" | "logs">("blocks");

  const [dragId, setDragId] = useState<BlockId | null>(null);
  const [refining, setRefining] = useState(false);
  const [qwenBusy, setQwenBusy] = useState(false);
  const [qwenResults, setQwenResults] = useState<string[]>([]);
  const [view, setView] = useState<"det" | "ref">("det");

  const compiledPrompt = useMemo(() => {
    if (view === "ref" && p.refinedPrompt) return p.refinedPrompt;
    return compileQwen21Prompt(p, format);
  }, [p, format, view]);

  const displayedPrompt = customPromptText !== null ? customPromptText : compiledPrompt;

  const compiledNegative = useMemo(() => {
    return compileQwen21NegativePrompt(p);
  }, [p]);

  const displayedNegative = customNegativeText !== null ? customNegativeText : compiledNegative;

  const stats = useMemo(() => qwenTokenStats(displayedPrompt), [displayedPrompt]);

  const onFormatChange = (newFormat: QwenPromptFormat) => {
    setCustomPromptText(null);
    logger.info("ui", `Changed Qwen prompt format to '${newFormat}'`);
    projectStore.update(
      (s) => ({
        ...s,
        metadata: { ...s.metadata, promptFormat: newFormat },
      }),
      { history: false },
    );
  };

  const copyPrompt = async () => {
    if (
      await copyText(displayedPrompt, "Ready-to-copy Qwen 2.1 prompt copied!", { format, ...stats })
    )
      flashCopiedPrompt();
  };
  const copyNegative = async () => {
    if (await copyText(displayedNegative, "Qwen 2.1 negative prompt copied!")) flashCopiedNeg();
  };
  const copyBundle = async () => {
    if (await copyText(compileQwen21Bundle(p, format), "Qwen 2.1 full prompt bundle copied!"))
      flashCopiedBundle();
  };
  const patchBlock = (
    id: BlockId,
    patch: Partial<ProjectState["blocks"][number]>,
    history = true,
  ) =>
    projectStore.update(
      (s) => ({ ...s, blocks: s.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }),
      { history },
    );

  const reorder = (from: BlockId, to: BlockId) =>
    projectStore.update((s) => {
      const ids = s.blocks.map((b) => b.id);
      const i = ids.indexOf(from),
        j = ids.indexOf(to);
      if (i < 0 || j < 0 || i === j) return s;
      const arr = [...s.blocks];
      const [x] = arr.splice(i, 1);
      if (x) arr.splice(j, 0, x);
      return { ...s, blocks: arr, blockOrder: arr.map((b) => b.id) };
    });

  const exportJson = exportProject;
  const importJson = importProject;
  const refine = async () => {
    setRefining(true);
    try {
      await refineProjectPrompt();
      setView("ref");
      toast.success("Refined wording ready. Relationship-bearing blocks were kept verbatim.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setRefining(false);
    }
  };
  const runQwen = async () => {
    setQwenBusy(true);
    try {
      const urls = await runQwenEdit(displayedPrompt);
      setQwenResults(urls);
      toast.success(`Qwen returned ${urls.length} image(s).`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setQwenBusy(false);
    }
  };
  const errors = p.issues.filter((i) => i.severity === "error");
  const warns = p.issues.filter((i) => i.severity === "warning");

  return {
    p,
    logs,
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
    subTab,
    setSubTab,
    dragId,
    setDragId,
    refining,
    qwenBusy,
    qwenResults,
    setView,
    displayedPrompt,
    displayedNegative,
    stats,
    onFormatChange,
    copyPrompt,
    copyNegative,
    copyBundle,
    patchBlock,
    reorder,
    exportJson,
    importJson,
    refine,
    runQwen,
    errors,
    warns,
  };
}
export type PromptInspectorModel = ReturnType<typeof usePromptInspector>;
