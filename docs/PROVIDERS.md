# Providers, configuration, and logging

## Optional providers

Manual is the default and requires no inference endpoint. Existing provider kinds remain manual, lmstudio, openai, qwen_pe, and custom_vision. Provider settings persist through storage.ts and the Models route.

OpenAI-compatible adapters use /models and /chat/completions. Configure base URL, optional key, vision model, and refinement model. LM Studio and custom local endpoints are supported as existing options; development does not require running them or deploying Qwen locally.

The Qwen adapter implements POST /services/aigc/multimodal-generation/generation relative to its configured base URL. Its request contains model, ordered image content followed by prompt text, and generation parameters. The implementation enforces 1–3 input images and requires a key and model. A workspace placeholder URL must be replaced before requests. These are application adapter contracts, not a claim that every provider deployment supports identical model capabilities.

Provider calls execute in the browser and require endpoint CORS support. There is no bundled proxy. API keys saved in browser storage are accessible to the application; backup exports omit them by default. Do not embed deployment secrets in VITE variables.

## Refinement and failure behavior

refinement.ts preserves roles, targets, spatial, transfer, and preservation blocks verbatim. Other enabled blocks may be polished only while retaining the ordered image references. Empty results and changed references are rejected. Studio workflows also reject responses when project identity, compiler inputs, or blocks changed during the request.

fetchWithTimeout handles request timeout and caller cancellation. Provider errors surface in the existing UI. Mocked tests verify these contracts; live endpoints, credentials, output image quality, and current provider availability are not validated by the rewrite.

## Application settings

Settings control theme (dark/light), density (compact/comfortable), autosave, default prompt level, and base rules. Changes dispatch qps-settings for the application shell to update document classes. Provider configuration is separate from these presentation/project defaults.

## Logging and error reporting

logger.ts retains the latest 500 in-memory events across compiler, store, validator, clipboard, assets, providers, and ui categories. Levels are debug, info, warn, and error. Logs mirror to the console and can be viewed or exported from Studio and Settings. They do not persist across reload.

Route errors render retry/home controls. Browser errors and rejected promises can be forwarded to an existing Lovable browser hook. The application does not install a telemetry transport, but it cannot promise zero telemetry when hosted inside an environment providing those hooks.
