import { PageFrame } from "@/components/AppShell";
import { Field, NSelect, TInput } from "@/components/studio/ui-bits";
import { Button } from "@/components/ui/button";
import {
  defaultModelSettings,
  getModelSettings,
  saveModelSettings,
  testProvider,
  type ModelSettings,
  type ProviderKind,
} from "@/lib/providers";
import { cn } from "@/lib/utils";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/models")({
  head: () => ({
    meta: [
      { title: "Model & API Configuration — Qwen Image 2.1 Prompt Studio" },
      {
        name: "description",
        content:
          "Connect LM Studio or any OpenAI-compatible endpoint for optional image analysis and prompt refinement.",
      },
      { property: "og:title", content: "Models — Qwen Image 2.1 Prompt Studio" },
      {
        property: "og:description",
        content: "Optional local or remote models for analysis and wording refinement.",
      },
    ],
  }),
  component: Models,
});

const CARDS: {
  id: ProviderKind;
  name: string;
  desc: string;
  key?: boolean;
  models?: boolean;
}[] = [
  {
    id: "manual",
    name: "Manual mode",
    desc: "No model. You describe images and roles yourself; the deterministic compiler does the rest.",
  },
  {
    id: "lmstudio",
    name: "LM Studio (OpenAI-compatible)",
    desc: "Local server. No API key needed. Enable CORS in LM Studio's server settings.",
    models: true,
  },
  {
    id: "openai",
    name: "Generic OpenAI-compatible API",
    desc: "Any /v1 endpoint with chat completions and /models.",
    key: true,
    models: true,
  },
  {
    id: "qwen_pe",
    name: "Official Qwen Image Edit (Model Studio)",
    desc: "Direct Alibaba Cloud Model Studio image-edit endpoint. Configure your workspace URL, API key and image-edit model.",
    key: true,
  },
  {
    id: "custom_vision",
    name: "Custom local vision model",
    desc: "Any local vision server exposing an OpenAI-compatible API.",
    key: true,
    models: true,
  },
];

function Models() {
  const [s, setS] = useState<ModelSettings>(defaultModelSettings);
  const [busy, setBusy] = useState<ProviderKind | null>(null);
  useEffect(() => setS(getModelSettings()), []);
  const save = (n: ModelSettings) => {
    setS(n);
    saveModelSettings(n);
  };
  const patch = (id: ProviderKind, p: Partial<ModelSettings["providers"][ProviderKind]>) =>
    save({ ...s, providers: { ...s.providers, [id]: { ...s.providers[id], ...p } } });

  const test = async (id: ProviderKind) => {
    setBusy(id);
    try {
      const result = await testProvider(id, s.providers[id]);
      const c = s.providers[id];
      const models = result.models;
      patch(id, {
        ...(models
          ? {
              models,
              visionModel: c.visionModel || models[0],
              refineModel: c.refineModel || models[0],
            }
          : {}),
        status: "ok",
        message: result.message,
      });
      toast.success(result.message);
    } catch (e) {
      patch(id, { status: "error", message: (e as Error).message });
      toast.error("Connection failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <PageFrame
      title="Model / API Configuration"
      desc="The compiler always works offline. Optional providers add vision/refinement or connect directly to the official Qwen image-edit endpoint."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {CARDS.map((c) => {
          const cfg = s.providers[c.id];
          const active = s.active === c.id;
          return (
            <article
              key={c.id}
              className={cn("rounded border bg-card p-3", active && "border-primary/60")}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{c.name}</h2>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">{c.desc}</p>
                </div>
                <Button
                  size="sm"
                  variant={active ? "default" : "outline"}
                  className="h-7 shrink-0 text-[11px]"
                  onClick={() => {
                    save({ ...s, active: c.id });
                    toast.success(`${c.name} active`);
                  }}
                >
                  {active ? "Active" : "Use"}
                </Button>
              </div>
              {c.id !== "manual" && (
                <div className="mt-3 space-y-2">
                  <Field label="Base URL">
                    <TInput
                      value={cfg.baseUrl}
                      onChange={(e) => patch(c.id, { baseUrl: e.target.value, status: "untested" })}
                    />
                  </Field>
                  {c.key && (
                    <>
                      <Field label="API key">
                        <TInput
                          type="password"
                          autoComplete="off"
                          value={cfg.apiKey ?? ""}
                          onChange={(e) => patch(c.id, { apiKey: e.target.value })}
                          placeholder="optional for local servers"
                        />
                      </Field>
                      <p className="flex items-start gap-1 text-[11px] text-warn">
                        <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                        Keys are stored in this browser's local storage and sent directly from your
                        browser. Use only on a trusted device.
                      </p>
                    </>
                  )}
                  {c.id === "qwen_pe" && (
                    <Field label="Image edit model">
                      <TInput
                        value={cfg.imageModel ?? ""}
                        onChange={(e) =>
                          patch(c.id, { imageModel: e.target.value, status: "untested" })
                        }
                        placeholder="qwen-image-2.1 (or qwen-image-2.0-pro)"
                      />
                    </Field>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-[11px]"
                      onClick={() => test(c.id)}
                      disabled={busy === c.id}
                    >
                      {busy === c.id ? "Testing…" : "Test connection"}
                    </Button>
                    {cfg.status === "ok" && (
                      <span className="flex items-center gap-1 text-[11px] text-ok">
                        <CheckCircle2 className="h-3 w-3" />
                        {cfg.message}
                      </span>
                    )}
                    {cfg.status === "error" && (
                      <span className="flex items-center gap-1 text-[11px] text-destructive">
                        <XCircle className="h-3 w-3" />
                        Failed
                      </span>
                    )}
                  </div>
                  {cfg.status === "error" && (
                    <p className="rounded border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
                      {cfg.message}
                    </p>
                  )}
                  {c.models && (
                    <div className="grid grid-cols-2 gap-2">
                      {(["visionModel", "refineModel"] as const).map((k) => (
                        <Field
                          key={k}
                          label={
                            k === "visionModel"
                              ? "Vision Analyzer model"
                              : "Prompt Refinement model"
                          }
                        >
                          {cfg.models?.length ? (
                            <NSelect
                              value={cfg[k] ?? ""}
                              onChange={(e) => patch(c.id, { [k]: e.target.value })}
                            >
                              <option value="">— none —</option>
                              {cfg.models.map((m) => (
                                <option key={m}>{m}</option>
                              ))}
                            </NSelect>
                          ) : (
                            <TInput
                              value={cfg[k] ?? ""}
                              onChange={(e) => patch(c.id, { [k]: e.target.value })}
                              placeholder="test to list models"
                            />
                          )}
                        </Field>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </PageFrame>
  );
}
