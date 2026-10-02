import { PageFrame } from "@/components/AppShell";
import { NSelect } from "@/components/studio/ui-bits";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { clearAllAssets, exportEmbeddedAssets, importEmbeddedAssets } from "@/lib/assets";
import { logger, useLogs } from "@/lib/logger";
import { demoProject, emptyProject, projectStore } from "@/lib/project-store";
import {
  defaultSettings,
  downloadJson,
  exportAll,
  getAllReferencedAssetIds,
  getSettings,
  importAll,
  KEYS,
  pickJson,
  resetAll,
  saveSettings,
  validateBackupData,
  type Settings,
} from "@/lib/storage";
import type { PromptLevel } from "@/lib/types";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Qwen Image 2.1 Prompt Studio" },
      {
        name: "description",
        content: "Theme, density, autosave, default prompt level and local data management.",
      },
      { property: "og:title", content: "Settings — Qwen Image 2.1 Prompt Studio" },
      {
        property: "og:description",
        content: "Application preferences and local data export/import.",
      },
    ],
  }),
  component: SettingsPage,
});

function Row({
  label,
  desc,
  children,
}: {
  label: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t px-4 py-3 first:border-t-0">
      <div>
        <div className="font-medium">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function SettingsPage() {
  const [s, setS] = useState<Settings>(defaultSettings);
  const [includeSecrets, setIncludeSecrets] = useState(false);
  const [includeAssets, setIncludeAssets] = useState(true);
  useEffect(() => setS(getSettings()), []);
  const u = (p: Partial<Settings>) => {
    const n = { ...s, ...p };
    setS(n);
    saveSettings(n);
  };
  return (
    <PageFrame title="Application Settings">
      <div className="max-w-2xl space-y-4">
        <div className="rounded border bg-card">
          <Row label="Theme">
            <NSelect
              value={s.theme}
              onChange={(e) => u({ theme: e.target.value as Settings["theme"] })}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </NSelect>
          </Row>
          <Row label="Density">
            <NSelect
              value={s.density}
              onChange={(e) => u({ density: e.target.value as Settings["density"] })}
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
            </NSelect>
          </Row>
          <Row label="Autosave" desc="Save the current project to this browser on every change.">
            <Switch
              checked={s.autosave}
              onCheckedChange={(v) => u({ autosave: v })}
              aria-label="Autosave"
            />
          </Row>
          <Row label="Default prompt level" desc="Used for new projects.">
            <NSelect
              value={s.defaultLevel}
              onChange={(e) => u({ defaultLevel: e.target.value as PromptLevel })}
            >
              <option value="simple">Simple</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </NSelect>
          </Row>
          <Row
            label="Default base rules"
            desc="Selecting a Base Canvas locks pose, body, hands, camera, background, lighting and composition (editable)."
          >
            <Switch
              checked={s.baseRules}
              onCheckedChange={(v) => u({ baseRules: v })}
              aria-label="Default base rules"
            />
          </Row>
        </div>
        <div className="rounded border bg-card">
          <Row label="New empty project">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => {
                projectStore.replace(emptyProject());
                toast.success("New project started");
              }}
            >
              New
            </Button>
          </Row>
          <Row label="Load demo project" desc="Base canvas + wardrobe + face identity slots.">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => {
                projectStore.replace(demoProject());
                toast.success("Demo loaded");
              }}
            >
              Load demo
            </Button>
          </Row>
          <Row
            label="Export local backup"
            desc="Portable backup of project/history/learning/settings. Image assets are included by default; API keys stay excluded unless explicitly enabled."
          >
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Switch
                  checked={includeAssets}
                  onCheckedChange={setIncludeAssets}
                  aria-label="Include image assets in backup"
                />
                Images
              </label>
              <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Switch
                  checked={includeSecrets}
                  onCheckedChange={setIncludeSecrets}
                  aria-label="Include API keys in backup"
                />
                API keys
              </label>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px]"
                onClick={async () => {
                  try {
                    const data = exportAll(includeSecrets);
                    data[KEYS.project] = projectStore.get();
                    const ids = getAllReferencedAssetIds(projectStore.get());
                    const assets = includeAssets ? await exportEmbeddedAssets(ids) : {};
                    downloadJson("qwen-prompt-studio-backup.json", {
                      format: "qps-backup",
                      version: 2,
                      data,
                      assets,
                    });
                    toast.success(
                      `Backup exported${includeAssets ? ` · ${Object.keys(assets).length} asset(s)` : ""}`,
                    );
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                Export
              </Button>
            </div>
          </Row>
          <Row label="Import all local data">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={async () => {
                try {
                  const picked = (await pickJson()) as Record<string, unknown>;
                  const wrapped =
                    picked?.["format"] === "qps-backup" &&
                    picked["data"] &&
                    typeof picked["data"] === "object";
                  const data = (wrapped ? picked["data"] : picked) as Record<string, unknown>;
                  validateBackupData(data);
                  const count = wrapped ? await importEmbeddedAssets(picked["assets"]) : 0;
                  importAll(data);
                  toast.success(`Imported${count ? ` · ${count} image asset(s)` : ""} — reloading`);
                  setTimeout(() => location.reload(), 600);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Import
            </Button>
          </Row>
          <Row
            label="Reset app data"
            desc="Deletes project, history, learning, preferences and model settings."
          >
            <Button
              size="sm"
              variant="destructive"
              className="h-7 text-[11px]"
              onClick={async () => {
                if (confirm("Delete all local app data and IndexedDB image assets?")) {
                  resetAll();
                  await clearAllAssets();
                  toast.success("Reset — reloading");
                  setTimeout(() => location.reload(), 600);
                }
              }}
            >
              Reset
            </Button>
          </Row>
        </div>

        <SystemLogsCard />
      </div>
    </PageFrame>
  );
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SystemLogsCard() {
  const logs = useLogs();
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return logs.filter(
      (entry) =>
        (levelFilter === "all" || entry.level === levelFilter) &&
        (catFilter === "all" || entry.category === catFilter) &&
        (!query ||
          entry.message.toLowerCase().includes(query) ||
          entry.category.toLowerCase().includes(query) ||
          JSON.stringify(entry.details ?? "")
            .toLowerCase()
            .includes(query)),
    );
  }, [logs, levelFilter, catFilter, search]);

  return (
    <div className="rounded border bg-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <div className="font-medium flex items-center gap-2">
            <span>System & Compiler Logs</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-mono font-normal text-muted-foreground">
              {logs.length} events
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            In-memory structured event stream tracking compilation, clipboard, assets, and state
            changes.
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => {
              downloadText("qwen-prompt-studio-logs.txt", logger.exportLogsText());
              toast.success("Exported text log file");
            }}
          >
            Export TXT
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={() => {
              downloadText("qwen-prompt-studio-logs.json", logger.exportLogsJson());
              toast.success("Exported JSON log file");
            }}
          >
            Export JSON
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
            onClick={() => {
              logger.clear();
              toast.success("Logs cleared");
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/20 px-4 py-2 text-[11px]">
        <input
          type="text"
          placeholder="Filter messages or details…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-7 flex-1 min-w-[140px] rounded border bg-background px-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="h-7 rounded border bg-background px-2 text-[11px] focus:outline-none"
        >
          <option value="all">All Levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <select
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value)}
          className="h-7 rounded border bg-background px-2 text-[11px] focus:outline-none"
        >
          <option value="all">All Categories</option>
          <option value="compiler">compiler</option>
          <option value="clipboard">clipboard</option>
          <option value="store">store</option>
          <option value="validator">validator</option>
          <option value="assets">assets</option>
          <option value="providers">providers</option>
          <option value="ui">ui</option>
        </select>
      </div>

      <div className="max-h-72 overflow-y-auto p-2 font-mono text-[11px] space-y-1">
        {!filtered.length ? (
          <div className="py-6 text-center text-muted-foreground font-sans text-[12px]">
            No logs match the current filters.
          </div>
        ) : (
          filtered.map((l) => {
            const time = new Date(l.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });
            const levelClass =
              l.level === "error"
                ? "text-destructive font-bold"
                : l.level === "warn"
                  ? "text-warn font-semibold"
                  : l.level === "info"
                    ? "text-primary"
                    : "text-muted-foreground";

            return (
              <div
                key={l.id}
                className="rounded border border-border/50 bg-background/80 px-2.5 py-1.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className={levelClass}>[{l.level.toUpperCase()}]</span>
                    <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-sans uppercase text-muted-foreground">
                      {l.category}
                    </span>
                  </div>
                  <span className="text-muted-foreground/70">{time}</span>
                </div>
                <div className="mt-0.5 font-sans text-foreground/90">{l.message}</div>
                {l.details !== undefined && (
                  <div className="mt-1 overflow-x-auto rounded bg-muted/50 p-1 text-[9.5px] text-muted-foreground">
                    {JSON.stringify(l.details)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
