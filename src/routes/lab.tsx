import { PageFrame } from "@/components/AppShell";
import { Field, NSelect } from "@/components/studio/ui-bits";
import { Button } from "@/components/ui/button";
import { compileBlock } from "@/lib/compiler";
import { BLOCK_META, DEFAULT_ORDER, WORDING_VARIANTS, type WordingVariant } from "@/lib/constants";
import { recommendWording, suggestExplorationPair, wordingEvidence } from "@/lib/learning-engine";
import { projectStore, uid, useProject } from "@/lib/project-store";
import { addPref, getLearning, getPrefs, type PrefEvent } from "@/lib/storage";
import type { BlockId, PromptLevel } from "@/lib/types";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/lab")({
  head: () => ({
    meta: [
      { title: "Prompt Laboratory — Qwen Image 2.1 Prompt Studio" },
      {
        name: "description",
        content: "A/B test Qwen prompt wording variants and record your local wording preferences.",
      },
      { property: "og:title", content: "Prompt Laboratory — Qwen Image 2.1" },
      { property: "og:description", content: "Compare compiler wording templates side by side." },
    ],
  }),
  component: Lab,
});

interface Variant {
  wording: WordingVariant;
  level: PromptLevel;
}

function Lab() {
  const p = useProject();
  const [block, setBlock] = useState<BlockId>("targets");
  const [va, setVa] = useState<Variant>({ wording: "Replace", level: "advanced" });
  const [vb, setVb] = useState<Variant>({ wording: "Dress", level: "expert" });
  const gen = (v: Variant) =>
    compileBlock(
      { ...p, promptLevel: v.level, metadata: { ...p.metadata, wordingVariant: v.wording } },
      block,
    );
  const [ta, setTa] = useState("");
  const [tb, setTb] = useState("");
  const [prefs, setPrefs] = useState<PrefEvent[]>([]);
  useEffect(() => setTa(gen(va)), [block, va, p.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setTb(gen(vb)), [block, vb, p.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setPrefs(getPrefs()), []);

  const choose = (which: "A" | "B") => {
    const win = which === "A" ? va : vb,
      lose = which === "A" ? vb : va;
    const text = which === "A" ? ta : tb;
    const loseText = which === "A" ? tb : ta;
    const ops = p.editSteps.map((e) => e.operation).join("+") || p.operation;
    const ev: PrefEvent = {
      id: uid(),
      timestamp: Date.now(),
      operation: p.operation,
      blockType: block,
      context: `${p.images.length} images · ${ops}`,
      chosen: `${win.wording}/${win.level}`,
      rejected: `${lose.wording}/${lose.level}`,
      chosenText: text,
      rejectedText: loseText,
      chosenTemplateId: `${block}.${ops}.${win.wording}.${win.level}`,
      rejectedTemplateId: `${block}.${ops}.${lose.wording}.${lose.level}`,
    };
    addPref(ev);
    setPrefs(getPrefs());
    projectStore.update((s) => {
      const next = {
        ...s,
        promptLevel: win.level,
        metadata: { ...s.metadata, wordingVariant: win.wording },
      };
      return {
        ...next,
        blocks: next.blocks.map((b) =>
          b.id === block
            ? {
                ...b,
                text,
                generated: gen(win),
                edited: text !== gen(win),
                locked: text !== gen(win),
              }
            : b,
        ),
      };
    });
    toast.success(`Using variant ${which} (${win.wording}, ${win.level}) in Studio`);
  };

  const table = useMemo(() => {
    const m = new Map<
      string,
      { op: string; block: string; variant: string; wins: number; losses: number }
    >();
    for (const e of prefs) {
      for (const [v, w] of [
        [e.chosen, 1],
        [e.rejected, 0],
      ] as const) {
        const k = `${e.operation}|${e.blockType}|${v}`;
        const r = m.get(k) ?? {
          op: e.operation,
          block: e.blockType,
          variant: v,
          wins: 0,
          losses: 0,
        };
        if (w) r.wins++;
        else r.losses++;
        m.set(k, r);
      }
    }
    return [...m.values()].sort((a, b) => b.wins - a.wins);
  }, [prefs]);

  const learning = getLearning();
  const evidence = wordingEvidence(p.operation, block, prefs, learning);
  const recommendation = recommendWording(p.operation, block, prefs, learning);
  const explore = () => {
    const [a, b] = suggestExplorationPair(p.operation, block, prefs, learning);
    setVa((v) => ({ ...v, wording: a }));
    setVb((v) => ({ ...v, wording: b }));
    toast.success(`Exploration pair: ${a} vs ${b}`);
  };
  const applyRecommendation = () => {
    if (!recommendation) return;
    projectStore.update((s) => ({
      ...s,
      metadata: { ...s.metadata, wordingVariant: recommendation.wording },
    }));
    setVa((v) => ({ ...v, wording: recommendation.wording }));
    toast.success(`Applied learned wording: ${recommendation.wording}`);
  };

  const VPick = ({ v, set, label }: { v: Variant; set: (v: Variant) => void; label: string }) => (
    <div className="flex gap-2">
      <Field label={`${label} wording`}>
        <NSelect
          value={v.wording}
          onChange={(e) => set({ ...v, wording: e.target.value as WordingVariant })}
        >
          {WORDING_VARIANTS.map((w) => (
            <option key={w}>{w}</option>
          ))}
        </NSelect>
      </Field>
      <Field label="Compiler template">
        <NSelect
          value={v.level}
          onChange={(e) => set({ ...v, level: e.target.value as PromptLevel })}
        >
          <option value="simple">simple</option>
          <option value="advanced">advanced</option>
          <option value="expert">expert</option>
        </NSelect>
      </Field>
    </div>
  );

  return (
    <PageFrame
      title="Prompt Laboratory"
      desc={`A/B wording against the current Studio project "${p.name}". Choices are stored locally as preference events.`}
    >
      <div className="mb-3 w-60">
        <Field label="Block type">
          <NSelect value={block} onChange={(e) => setBlock(e.target.value as BlockId)}>
            {DEFAULT_ORDER.map((b) => (
              <option key={b} value={b}>
                {BLOCK_META[b].title}
              </option>
            ))}
          </NSelect>
        </Field>
      </div>
      <div className="mb-3 rounded border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto">
            <h2 className="text-[12px] font-semibold">Active preference-learning loop</h2>
            <p className="text-[11px] text-muted-foreground">
              {recommendation
                ? `Current learned recommendation for ${p.operation} / ${BLOCK_META[block].title}: ${recommendation.wording} · score ${(recommendation.score * 100).toFixed(0)}% · confidence ${(recommendation.confidence * 100).toFixed(0)}% (${recommendation.evidence} evidence)`
                : "No evidence for this operation/block yet. Run an A/B choice to start learning."}
            </p>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={explore}>
            Learn next
          </Button>
          <Button
            size="sm"
            className="h-7 text-[11px]"
            onClick={applyRecommendation}
            disabled={!recommendation}
          >
            Apply learned wording
          </Button>
        </div>
        <div className="mt-2 grid grid-cols-5 gap-1">
          {evidence.map((e) => (
            <div key={e.wording} className="rounded border bg-background px-2 py-1 text-[10.5px]">
              <div className="font-medium">{e.wording}</div>
              <div className="font-mono text-muted-foreground">
                {(e.score * 100).toFixed(0)}% · n={e.evidence}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {(
          [
            ["A", va, setVa, ta, setTa],
            ["B", vb, setVb, tb, setTb],
          ] as const
        ).map(([n, v, sv, t, st]) => (
          <div key={n} className="rounded border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">Variant {n}</h2>
            </div>
            <VPick v={v} set={sv} label={n} />
            <textarea
              aria-label={`Variant ${n} text`}
              value={t}
              onChange={(e) => st(e.target.value)}
              rows={9}
              placeholder="(this block is empty for the current project)"
              className="mt-2 w-full rounded border bg-background p-2 font-mono text-[11.5px]"
            />
            <Button className="mt-2 h-7 w-full text-[11px]" onClick={() => choose(n)}>
              Use {n}
            </Button>
          </div>
        ))}
      </div>
      <h2 className="mb-2 mt-6 font-semibold">
        Learned wording preferences{" "}
        <span className="text-[11px] font-normal text-muted-foreground">(personal, local)</span>
      </h2>
      <div className="overflow-x-auto rounded border">
        <table className="w-full text-[12px]">
          <thead className="bg-panel-2 text-left text-[10.5px] uppercase text-muted-foreground">
            <tr>
              <th className="p-2">Operation</th>
              <th className="p-2">Block</th>
              <th className="p-2">Variant</th>
              <th className="p-2">Chosen</th>
              <th className="p-2">Rejected</th>
            </tr>
          </thead>
          <tbody>
            {!table.length && (
              <tr>
                <td colSpan={5} className="p-3 text-muted-foreground">
                  No preference events yet.
                </td>
              </tr>
            )}
            {table.map((r, i) => (
              <tr key={i} className="border-t">
                <td className="p-2">{r.op}</td>
                <td className="p-2">{BLOCK_META[r.block as BlockId]?.title ?? r.block}</td>
                <td className="p-2 font-mono">{r.variant}</td>
                <td className="p-2 text-ok">{r.wins}</td>
                <td className="p-2 text-destructive">{r.losses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageFrame>
  );
}
