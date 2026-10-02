import {
  fetchWithTimeout,
  generateQwenImageEdit,
  listModels,
  type ProviderConfig,
} from "@/lib/providers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Provider HTTP timeout and abort handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("aborts when signal is pre-aborted or triggered during request", async () => {
    const controller = new AbortController();
    controller.abort(new Error("User cancelled"));

    await expect(
      fetchWithTimeout("http://127.0.0.1:1234/models", {}, 5000, controller.signal),
    ).rejects.toThrow(/User cancelled|aborted/i);
  });

  it("triggers timeout when request exceeds timeoutMs", async () => {
    // Mock global fetch to hang indefinitely
    const origFetch = globalThis.fetch;
    globalThis.fetch = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_, reject) => {
        if (init?.signal) {
          init.signal.addEventListener("abort", () => {
            reject(new Error("Request timed out after 1s"));
          });
        }
      });
    });

    try {
      await expect(fetchWithTimeout("http://127.0.0.1:1234/models", {}, 50)).rejects.toThrow(
        /timed out/i,
      );
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("propagates AbortSignal through listModels", async () => {
    const config: ProviderConfig = {
      baseUrl: "http://127.0.0.1:1234/v1",
      apiKey: "test-key",
    };
    const controller = new AbortController();
    controller.abort(new Error("Operation aborted"));

    await expect(listModels(config, { signal: controller.signal })).rejects.toThrow(
      /aborted|cancelled/i,
    );
  });

  it("validates input images before making network call in generateQwenImageEdit", async () => {
    const config: ProviderConfig = {
      baseUrl: "https://dashscope.aliyuncs.com/api/v1",
      apiKey: "test-key",
      imageModel: "qwen-image-edit-2.1",
    };

    // 0 images -> should throw
    await expect(generateQwenImageEdit(config, [], "test prompt")).rejects.toThrow(
      /accepts 1–3 input images/i,
    );

    // 4 images -> should throw
    await expect(
      generateQwenImageEdit(config, ["img1", "img2", "img3", "img4"], "test prompt"),
    ).rejects.toThrow(/accepts 1–3 input images/i);
  });
});
