import { PageFrame } from "@/components/AppShell";
import { TInput } from "@/components/studio/ui-bits";
import { Button } from "@/components/ui/button";
import { importImageFile } from "@/lib/assets";
import { compileQwen21Prompt, compilerInputHash } from "@/lib/compiler";
import { actions, uid, useProject } from "@/lib/project-store";
import { activeLabel } from "@/lib/providers";
import {
  addLearning,
  db,
  getLearning,
  KEYS,
  type GenerationMetadata,
  type LearningRecord,
} from "@/lib/storage";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/learning")({
  head: () => ({
    meta: [
      { title: "Preference Learning — Qwen Image 2.1 Prompt Studio" },
      {
        name: "description",
        content:
          "Rate Qwen edit results locally with exact prompt, compiler and generation context.",
      },
      { property: "og:title", content: "Preference Learning — Qwen Image 2.1" },
      {
        property: "og:description",
        content: "Personal, local ratings tied to exact prompt versions and generation context.",
      },
    ],
  }),
  component: Learning,
});

const DIMS = [
  ["identity", "Identity"],
  ["clothing", "Clothing"],
  ["pose", "Pose"],
  ["background", "Background"],
  ["spatial", "Spatial Accuracy"],
  ["coherence", "Overall Coherence"],
] as const;
type Dim = (typeof DIMS)[number][0];

function Learning() {
  const p = useProject();
  const [recs, setRecs] = useState<LearningRecord[]>([]);
  const [verdict, setVerdict] = useState<"good" | "bad">("good");
  const [r, setR] = useState<Record<Dim, number>>({
    identity: 7,
    clothing: 7,
    pose: 7,
    background: 7,
    spatial: 7,
    coherence: 7,
  });
  const [generation, setGeneration] = useState<GenerationMetadata>({
    model: "",
    seed: "",
    steps: undefined,
    cfg: undefined,
    width: undefined,
    height: undefined,
    sampler: "",
  });
  const [resultAssetId, setResultAssetId] = useState<string>();
  const resultInput = useRef<HTMLInputElement>(null);
  useEffect(() => setRecs(getLearning()), []);
  const submit = () => {
    const fresh = actions.ensureBuilt();
    const activeFormat = fresh.metadata.promptFormat || "natural";
    const prompt = fresh.refinedPrompt ?? compileQwen21Prompt(fresh, activeFormat);
    if (!prompt) {
      toast.error("Build a prompt in Studio first.");
      return;
    }
    addLearning({
      id: uid(),
      timestamp: Date.now(),
      verdict,
      ratings: r,
      prompt,
      projectId: fresh.projectId,
      projectStateHash: compilerInputHash(fresh),
      compilerVersion: fresh.metadata.compilerVersion,
      editOperations: fresh.editSteps.map((e) => e.operation),
      roles: fresh.images.map((i) => `${i.tag}:${i.role}`),
      references: fresh.images.map((i) => ({
        imageId: i.id,
        tag: i.tag,
        role: i.role,
        assetId: i.assetId,
      })),
      model: activeLabel(),
      templateId: fresh.metadata.templateId ?? "custom",
      wordingVariant: fresh.metadata.wordingVariant ?? "Replace",
      settings: { level: fresh.promptLevel },
      generation: Object.values(generation).some((v) => v !== undefined && v !== "")
        ? generation
        : undefined,
      resultAssetId,
    });
    setRecs(getLearning());
    toast.success("Rating recorded with exact project/prompt context");
  };

  const stats = useMemo(() => {
    const by = (selector: (x: LearningRecord) => string) => {
      const map = new Map<string, number[]>();
      for (const x of recs)
        map.set(selector(x), [...(map.get(selector(x)) ?? []), x.ratings.coherence]);
      return [...map.entries()]
        .map(([key, xs]) => ({ key, avg: xs.reduce((a, b) => a + b, 0) / xs.length, n: xs.length }))
        .sort((a, b) => b.avg - a.avg);
    };
    return { templates: by((x) => x.templateId), wording: by((x) => x.wordingVariant) };
  }, [recs]);

  return (
    <PageFrame
      title="Preference Learning"
      desc="Personal local data only. Each rating is tied to the exact prompt, structured-state hash, compiler version, operations, roles, source asset identities and optional generation settings."
      actions={
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-[11px]"
          onClick={() => {
            if (confirm("Delete all learning data?")) {
              db.remove(KEYS.learning);
              setRecs([]);
              toast.success("Learning data reset");
            }
          }}
        >
          Reset learning data
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <div className="rounded border bg-card p-3">
          <h2 className="mb-1 font-semibold">Rate current result</h2>
          <p className="mb-3 text-[11px] text-muted-foreground">
            Project “{p.name}” · {p.editSteps.map((e) => e.operation).join(" + ") || p.operation} ·{" "}
            {p.promptLevel}
          </p>
          <div className="mb-3 flex gap-2">
            {(["good", "bad"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVerdict(v)}
                aria-pressed={verdict === v}
                className={cn(
                  "flex-1 rounded border py-1.5 text-[12px] capitalize",
                  verdict === v
                    ? v === "good"
                      ? "border-ok bg-ok/15 text-ok"
                      : "border-destructive bg-destructive/15 text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {v}
              </button>
            ))}
          </div>
          {DIMS.map(([k, label]) => (
            <label key={k} className="mb-2 flex items-center gap-2 text-[12px]">
              <span className="w-32">{label}</span>
              <input
                type="range"
                min={1}
                max={10}
                value={r[k]}
                onChange={(e) => setR({ ...r, [k]: +e.target.value })}
                className="flex-1 accent-[var(--color-primary)]"
              />
              <span className="w-5 text-right font-mono">{r[k]}</span>
            </label>
          ))}

          <div className="mt-4 border-t pt-3">
            <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              Generation context (optional)
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TInput
                placeholder="model/checkpoint"
                value={generation.model ?? ""}
                onChange={(e) => setGeneration({ ...generation, model: e.target.value })}
              />
              <TInput
                placeholder="sampler"
                value={generation.sampler ?? ""}
                onChange={(e) => setGeneration({ ...generation, sampler: e.target.value })}
              />
              <TInput
                placeholder="seed"
                value={generation.seed ?? ""}
                onChange={(e) => setGeneration({ ...generation, seed: e.target.value })}
              />
              <TInput
                type="number"
                placeholder="steps"
                value={generation.steps ?? ""}
                onChange={(e) =>
                  setGeneration({
                    ...generation,
                    steps: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
              <TInput
                type="number"
                step="0.1"
                placeholder="CFG"
                value={generation.cfg ?? ""}
                onChange={(e) =>
                  setGeneration({
                    ...generation,
                    cfg: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
              <div className="grid grid-cols-2 gap-1">
                <TInput
                  type="number"
                  placeholder="W"
                  value={generation.width ?? ""}
                  onChange={(e) =>
                    setGeneration({
                      ...generation,
                      width: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
                <TInput
                  type="number"
                  placeholder="H"
                  value={generation.height ?? ""}
                  onChange={(e) =>
                    setGeneration({
                      ...generation,
                      height: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                />
              </div>
            </div>
            <input
              ref={resultInput}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const asset = await importImageFile(f);
                  setResultAssetId(asset.assetId);
                  toast.success("Result image attached to this rating");
                } catch (err) {
                  toast.error((err as Error).message);
                }
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-7 w-full text-[11px]"
              onClick={() => resultInput.current?.click()}
            >
              {resultAssetId ? "Result image attached" : "Attach generated result image"}
            </Button>
          </div>

          <Button className="mt-3 h-7 w-full text-[11px]" onClick={submit}>
            Record rating
          </Button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Total ratings", recs.length],
              ["Good", recs.filter((x) => x.verdict === "good").length],
              ["Bad", recs.filter((x) => x.verdict === "bad").length],
            ].map(([l, n]) => (
              <div key={String(l)} className="rounded border bg-card p-3">
                <div className="text-[11px] text-muted-foreground">{l}</div>
                <div className="font-mono text-xl">{n}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Stats title="Template performance" rows={stats.templates} />
            <Stats title="Wording performance" rows={stats.wording} />
          </div>
          <div className="rounded border">
            <div className="border-b bg-panel-2 px-3 py-2 text-[11px] font-semibold uppercase text-muted-foreground">
              Recent ratings
            </div>
            {recs
              .slice(-10)
              .reverse()
              .map((x) => (
                <div
                  key={x.id}
                  className="grid grid-cols-[60px_1fr_1fr_auto] gap-2 border-t px-3 py-1.5 text-[12px]"
                >
                  <span className={x.verdict === "good" ? "text-ok" : "text-destructive"}>
                    {x.verdict}
                  </span>
                  <span className="truncate">{x.editOperations?.join("+") || "legacy"}</span>
                  <span className="truncate font-mono text-muted-foreground">
                    {x.templateId ?? "legacy"} · {x.wordingVariant ?? "legacy"}
                  </span>
                  <span className="text-muted-foreground">
                    {new Date(x.timestamp).toLocaleDateString()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </PageFrame>
  );
}

function Stats({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; avg: number; n: number }[];
}) {
  return (
    <div className="rounded border">
      <div className="border-b bg-panel-2 px-3 py-2 text-[11px] font-semibold uppercase text-muted-foreground">
        {title}
      </div>
      {!rows.length && (
        <p className="p-3 text-[12px] text-muted-foreground">Not enough local data yet.</p>
      )}
      {rows.slice(0, 8).map((b) => (
        <div key={b.key} className="flex justify-between border-t px-3 py-1.5 text-[12px]">
          <span>{b.key}</span>
          <span className="font-mono">
            {b.avg.toFixed(1)} (n={b.n})
          </span>
        </div>
      ))}
    </div>
  );
}
