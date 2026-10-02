/** Optional AI provider service layer. Deterministic compilation never depends on these services. */
import { KEYS, db } from "./storage";
import type { ImageAnalysis } from "./types";

export type ProviderKind = "manual" | "lmstudio" | "openai" | "qwen_pe" | "custom_vision";
export interface ProviderConfig {
  baseUrl: string;
  apiKey?: string | undefined;
  visionModel?: string | undefined;
  refineModel?: string | undefined;
  imageModel?: string | undefined;
  models?: string[] | undefined;
  status?: "untested" | "ok" | "error" | undefined;
  message?: string | undefined;
}
export interface ModelSettings {
  active: ProviderKind;
  providers: Record<ProviderKind, ProviderConfig>;
}
export const defaultModelSettings: ModelSettings = {
  active: "manual",
  providers: {
    manual: { baseUrl: "" },
    lmstudio: { baseUrl: "http://127.0.0.1:1234/v1", status: "untested" },
    openai: { baseUrl: "https://api.openai.com/v1", status: "untested" },
    qwen_pe: {
      baseUrl: "https://{WorkspaceId}.eu-central-1.maas.aliyuncs.com/api/v1",
      apiKey: "",
      imageModel: "qwen-image-2.1",
      status: "untested",
    },
    custom_vision: { baseUrl: "http://127.0.0.1:8000/v1", status: "untested" },
  },
};
export function getModelSettings(): ModelSettings {
  const raw = db.get<Partial<ModelSettings>>(KEYS.models, {});
  const validKinds: ProviderKind[] = ["manual", "lmstudio", "openai", "qwen_pe", "custom_vision"];
  const active = validKinds.includes(raw.active as ProviderKind)
    ? (raw.active as ProviderKind)
    : defaultModelSettings.active;
  const providers = Object.fromEntries(
    validKinds.map((k) => {
      const candidate = raw.providers?.[k];
      const saved =
        candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : {};
      return [k, { ...defaultModelSettings.providers[k], ...saved }];
    }),
  ) as ModelSettings["providers"];
  return { active, providers };
}
export const saveModelSettings = (s: ModelSettings) => db.set(KEYS.models, s);

export function activeLabel(): string {
  const s = getModelSettings();
  if (s.active === "manual") return "Manual";
  const c = s.providers[s.active];
  return `${s.active}:${c.imageModel || c.refineModel || c.visionModel || "unset"}`;
}

function explain(err: unknown, url: string): string {
  const msg = err instanceof Error ? err.message : String(err);
  const local = /127\.0\.0\.1|localhost/.test(url);
  if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
    return local
      ? `Could not reach ${url}. Make sure the server is running, CORS is enabled, and the browser is allowed to call the local HTTP endpoint.`
      : `Could not reach ${url}. Check the URL, internet connection and CORS policy.`;
  }
  return msg;
}

function headers(c: ProviderConfig) {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (c.apiKey) h["Authorization"] = `Bearer ${c.apiKey}`;
  return h;
}

export interface RequestOptions {
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
}

const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_IMAGE_EDIT_TIMEOUT_MS = 120000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`));
  }, timeoutMs);

  const onAbort = () => {
    controller.abort(externalSignal?.reason);
  };
  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw externalSignal.reason ?? new Error("Request aborted");
    }
    externalSignal.addEventListener("abort", onAbort, { once: true });
  }

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onAbort);
    }
  }
}

export async function listModels(c: ProviderConfig, options?: RequestOptions): Promise<string[]> {
  const url = c.baseUrl.replace(/\/$/, "") + "/models";
  let r: Response;
  try {
    r = await fetchWithTimeout(
      url,
      { headers: headers(c) },
      options?.timeoutMs ?? 15000,
      options?.signal,
    );
  } catch (e) {
    throw new Error(explain(e, url));
  }
  if (!r.ok)
    throw new Error(
      `Server responded ${r.status} ${r.statusText}${r.status === 401 ? " — check the API key." : ""}`,
    );
  const j = await r.json().catch(() => null);
  const ids = Array.isArray(j?.data)
    ? j.data.map((m: { id?: string }) => m.id).filter(Boolean)
    : [];
  if (!ids.length) throw new Error("Connected, but no models were returned.");
  return ids;
}

async function chat(
  c: ProviderConfig,
  model: string,
  messages: unknown[],
  options?: RequestOptions,
): Promise<string> {
  const url = c.baseUrl.replace(/\/$/, "") + "/chat/completions";
  let r: Response;
  try {
    r = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: headers(c),
        body: JSON.stringify({ model, messages, temperature: 0.2 }),
      },
      options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      options?.signal,
    );
  } catch (e) {
    throw new Error(explain(e, url));
  }
  if (!r.ok)
    throw new Error(
      `Model call failed: ${r.status} ${await r.text().catch(() => "")}`.slice(0, 300),
    );
  const j = await r.json();
  const t = j?.choices?.[0]?.message?.content;
  if (typeof t !== "string") throw new Error("Unexpected response shape from model.");
  return t;
}

const ANALYSIS_INSTRUCTION = `Analyze this image for an image-editing workflow. Respond with ONLY strict JSON, no prose, matching:
{"subjects":[{"id":"s1","type":"person|object|animal","position":"left|center|right ...","pose":"","clothing":[]}],"camera":{"shot":"close-up|medium|full|wide","angle":"eye-level|high|low"},"environment":"","lighting":"","objects":[],"suggestedTargets":[]}`;

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const strArr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

export function parseAnalysis(raw: string): ImageAnalysis {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Model did not return JSON.");
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(m[0]);
  } catch {
    throw new Error("Model returned malformed JSON.");
  }
  const subs = Array.isArray(j["subjects"]) ? j["subjects"] : [];
  const camRaw = j["camera"];
  const cam = (camRaw && typeof camRaw === "object" ? camRaw : {}) as Record<string, unknown>;
  return {
    subjects: subs.slice(0, 10).map((s: Record<string, unknown>, i: number) => ({
      id: str(s?.["id"]) ?? `s${i + 1}`,
      type: str(s?.["type"]) ?? "subject",
      position: str(s?.["position"]),
      pose: str(s?.["pose"]),
      clothing: strArr(s?.["clothing"]),
    })),
    camera: { shot: str(cam["shot"]), angle: str(cam["angle"]) },
    environment: str(j["environment"]),
    lighting: str(j["lighting"]),
    objects: strArr(j["objects"]).slice(0, 20),
    suggestedTargets: strArr(j["suggestedTargets"]).slice(0, 20),
  };
}

export interface Analyzer {
  analyze(dataUrl: string): Promise<ImageAnalysis>;
}
export function getAnalyzer(): Analyzer | null {
  const s = getModelSettings();
  if (s.active === "manual" || s.active === "qwen_pe") return null;
  const c = s.providers[s.active];
  if (!c.visionModel) return null;
  return {
    async analyze(dataUrl) {
      const t = await chat(c, c.visionModel!, [
        {
          role: "user",
          content: [
            { type: "text", text: ANALYSIS_INSTRUCTION },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ]);
      return parseAnalysis(t);
    },
  };
}

export async function refineWording(prompt: string, options?: RequestOptions): Promise<string> {
  const s = getModelSettings();
  if (s.active === "manual" || s.active === "qwen_pe")
    throw new Error(
      "No prompt refinement model configured. Select LM Studio, OpenAI-compatible, or Custom Vision on the Models page.",
    );
  const c = s.providers[s.active];
  if (!c.refineModel) throw new Error("Select a Prompt Refinement model on the Models page.");
  return chat(
    c,
    c.refineModel,
    [
      {
        role: "system",
        content:
          "Polish this single image-editing prompt block for fluency and precision only. Do not add, remove, reorder or change any <imageN> tag. Do not invent sources, targets, attributes, locks or exclusions. Output only the rewritten block.",
      },
      { role: "user", content: prompt },
    ],
    options,
  );
}

export interface QwenEditOptions {
  n?: number | undefined;
  size?: string | undefined;
  negativePrompt?: string | undefined;
  promptExtend?: boolean | undefined;
  watermark?: boolean | undefined;
  seed?: number | undefined;
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
}

/** Official Alibaba Cloud Model Studio Qwen Image Edit HTTP integration. */
export async function generateQwenImageEdit(
  c: ProviderConfig,
  imageDataUrls: string[],
  prompt: string,
  options: QwenEditOptions = {},
): Promise<string[]> {
  if (!c.apiKey) throw new Error("Qwen API key is required.");
  if (!c.imageModel) throw new Error("Qwen image edit model is required.");
  if (imageDataUrls.length < 1 || imageDataUrls.length > 3)
    throw new Error("Official Qwen Image Edit currently accepts 1–3 input images per request.");
  const base = c.baseUrl.replace(/\/$/, "");
  if (!base || base.includes("{WorkspaceId}"))
    throw new Error("Replace {WorkspaceId} in the Qwen Model Studio base URL.");
  const url = `${base}/services/aigc/multimodal-generation/generation`;
  const content = [...imageDataUrls.map((image) => ({ image })), { text: prompt }];
  let r: Response;
  try {
    r = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: headers(c),
        body: JSON.stringify({
          model: c.imageModel,
          input: { messages: [{ role: "user", content }] },
          parameters: {
            n: options.n ?? 1,
            negative_prompt: options.negativePrompt ?? " ",
            prompt_extend: options.promptExtend ?? false,
            watermark: options.watermark ?? false,
            ...(options.size ? { size: options.size } : {}),
            ...(options.seed !== undefined ? { seed: options.seed } : {}),
          },
        }),
      },
      options.timeoutMs ?? DEFAULT_IMAGE_EDIT_TIMEOUT_MS,
      options.signal,
    );
  } catch (e) {
    throw new Error(explain(e, url));
  }
  const j = await r.json().catch(() => null);
  if (!r.ok || j?.code)
    throw new Error(j?.message || `Qwen Image Edit failed: ${r.status} ${r.statusText}`);
  const contentOut = j?.output?.choices?.[0]?.message?.content;
  const urls: string[] = Array.isArray(contentOut)
    ? contentOut
        .map((x: { image?: string }) => x?.image)
        .filter((x: string | undefined): x is string => typeof x === "string" && x.length > 0)
    : [];
  if (!urls.length) throw new Error("Qwen Image Edit returned no output image URL.");
  return urls;
}

export async function testProvider(
  kind: ProviderKind,
  c: ProviderConfig,
  options?: RequestOptions,
): Promise<{ models?: string[]; message: string }> {
  if (kind === "manual") return { message: "Manual mode is ready." };
  if (kind !== "qwen_pe") {
    const models = await listModels(c, options);
    return { models, message: `Connected · ${models.length} model(s)` };
  }
  if (!c.apiKey) throw new Error("Enter a Qwen Model Studio API key.");
  if (!c.imageModel) throw new Error("Enter a Qwen image edit model.");
  const base = c.baseUrl.replace(/\/$/, "");
  if (!base || base.includes("{WorkspaceId}"))
    throw new Error("Replace {WorkspaceId} in the Model Studio base URL.");
  const url = `${base}/services/aigc/multimodal-generation/generation`;
  let r: Response;
  try {
    r = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: headers(c),
        body: JSON.stringify({ model: c.imageModel, input: { messages: [] } }),
      },
      options?.timeoutMs ?? 15000,
      options?.signal,
    );
  } catch (e) {
    throw new Error(explain(e, url));
  }
  if (r.status === 401 || r.status === 403)
    throw new Error("Qwen endpoint reached, but authentication failed.");
  if (r.status === 404)
    throw new Error("Qwen endpoint was not found. Check workspace region and base URL.");
  return { message: `Qwen endpoint reachable · ${c.imageModel}` };
}
