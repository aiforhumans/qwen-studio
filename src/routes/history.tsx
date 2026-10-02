import { PageFrame } from "@/components/AppShell";
import { NSelect } from "@/components/studio/ui-bits";
import { Button } from "@/components/ui/button";
import { getImageAsset } from "@/lib/assets";
import { BLOCK_META } from "@/lib/constants";
import { projectStore } from "@/lib/project-store";
import { deleteVersion, getHistory, type HistoryVersion } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Generation History — Qwen Image 2.1 Prompt Studio" },
      {
        name: "description",
        content:
          "Browse saved prompt versions, diff blocks and restore earlier Qwen edit configurations.",
      },
      { property: "og:title", content: "Generation History — Qwen Image 2.1" },
      { property: "og:description", content: "Versioned prompt history with block-level diffs." },
    ],
  }),
  component: History,
});

function History() {
  const [all, setAll] = useState<HistoryVersion[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [cmp, setCmp] = useState<string>("");
  const nav = useNavigate();
  useEffect(() => setAll(getHistory()), []);
  const groups = useMemo(() => {
    const m = new Map<string, HistoryVersion[]>();
    for (const v of all) m.set(v.projectId, [...(m.get(v.projectId) ?? []), v]);
    return [...m.values()].map((vs) => vs.sort((a, b) => a.version - b.version));
  }, [all]);
  const cur = all.find((v) => v.id === sel);
  const other = all.find((v) => v.id === cmp);

  const restore = async (v: HistoryVersion) => {
    projectStore.importUnknown(v.state);
    const refs = v.state.images.filter((im) => im.assetId);
    const found = await Promise.all(refs.map((im) => getImageAsset(im.assetId)));
    const missing = found.filter((x) => !x).length;
    toast.success(
      `Restored ${v.projectName} V${v.version}${missing ? ` · ${missing} local image asset(s) are missing` : ""}`,
    );
    nav({ to: "/" });
  };

  return (
    <PageFrame
      title="Generation History"
      desc="Each version stores the complete structured state and asset IDs. Image bytes remain deduplicated in IndexedDB."
    >
      {!groups.length && (
        <p className="text-muted-foreground">
          No saved versions yet. Use Save Version (Ctrl/Cmd+S) in Studio.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          {groups.map((vs) => (
            <div key={vs[0]!.projectId} className="rounded border bg-card">
              <div className="border-b px-3 py-2 font-semibold">
                {vs[vs.length - 1]!.projectName}
              </div>
              <ul>
                {vs.map((v) => (
                  <li key={v.id}>
                    <button
                      onClick={() => {
                        setSel(v.id);
                        setCmp(vs.find((x) => x.version === v.version - 1)?.id ?? "");
                      }}
                      className={cn(
                        "flex w-full justify-between px-3 py-1.5 text-left text-[12px] hover:bg-secondary",
                        sel === v.id && "bg-secondary",
                      )}
                    >
                      <span>Prompt V{v.version}</span>
                      <span className="text-muted-foreground">
                        {new Date(v.timestamp).toLocaleString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {cur && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold">
                {cur.projectName} · V{cur.version}
              </h2>
              <span className="text-[11px] text-muted-foreground">model: {cur.model}</span>
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 text-[11px]"
                  onClick={async () => {
                    await navigator.clipboard.writeText(cur.prompt);
                    toast.success(`Copied Prompt V${cur.version} to clipboard!`);
                  }}
                >
                  Copy Prompt
                </Button>
                <Button size="sm" className="h-7 text-[11px]" onClick={() => void restore(cur)}>
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    deleteVersion(cur.id);
                    setAll(getHistory());
                    setSel(null);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 text-[11px]">
              {cur.images.map((i) => (
                <span key={i.id} className="tag-chip">
                  {i.tag} {i.role}
                </span>
              ))}
            </div>
            <pre className="whitespace-pre-wrap rounded border bg-background p-3 font-mono text-[11px]">
              {cur.prompt}
            </pre>
            <div className="flex items-center gap-2">
              <span className="panel-title">Diff against</span>
              <NSelect value={cmp} onChange={(e) => setCmp(e.target.value)}>
                <option value="">— none —</option>
                {all
                  .filter((v) => v.id !== cur.id && v.projectId === cur.projectId)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      V{v.version}
                    </option>
                  ))}
              </NSelect>
            </div>
            {other && <Diff a={other} b={cur} />}
          </div>
        )}
      </div>
    </PageFrame>
  );
}

function Diff({ a, b }: { a: HistoryVersion; b: HistoryVersion }) {
  const ids = Array.from(new Set([...a.blocks.map((x) => x.id), ...b.blocks.map((x) => x.id)]));
  const rows = ids
    .map((id) => {
      const x = a.blocks.find((k) => k.id === id),
        y = b.blocks.find((k) => k.id === id);
      const tx = x?.enabled ? x.text.trim() : "",
        ty = y?.enabled ? y.text.trim() : "";
      const kind = !tx && ty ? "added" : tx && !ty ? "removed" : tx !== ty ? "changed" : "same";
      return { id, tx, ty, kind };
    })
    .filter((r) => r.kind !== "same");
  if (!rows.length)
    return (
      <p className="text-[12px] text-muted-foreground">
        No block-level differences between V{a.version} and V{b.version}.
      </p>
    );
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded border bg-card p-2 text-[11.5px]">
          <div className="mb-1 flex gap-2">
            <span className="font-semibold">{BLOCK_META[r.id].title}</span>
            <span
              className={cn(
                "rounded px-1 text-[10px] uppercase",
                r.kind === "added"
                  ? "bg-ok/20 text-ok"
                  : r.kind === "removed"
                    ? "bg-destructive/20 text-destructive"
                    : "bg-warn/20 text-warn",
              )}
            >
              {r.kind}
            </span>
          </div>
          {r.tx && (
            <div className="whitespace-pre-wrap border-l-2 border-destructive/60 pl-2 text-destructive/90">
              − {r.tx}
            </div>
          )}
          {r.ty && (
            <div className="mt-1 whitespace-pre-wrap border-l-2 border-ok/60 pl-2 text-ok">
              + {r.ty}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
