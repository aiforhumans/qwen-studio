import { COMPILER_VERSION, compileBlocks, compilerInputHash } from "./compiler";
import { logger } from "./logger";
import type { ProjectState } from "./types";
import { PROJECT_SCHEMA_VERSION } from "./types";
import { diagnose, validate } from "./validator";
export function analyze(p: ProjectState): ProjectState {
  const hash = compilerInputHash(p);
  const isPromptDirty =
    !p.blocks.length ||
    p.lastCompiledHash !== hash ||
    p.metadata.compilerVersion !== COMPILER_VERSION;
  // A refined prompt is derived output. Never expose it when the structured state or
  // compiler version no longer matches the last deterministic build.
  const clean = isPromptDirty && p.refinedPrompt ? { ...p, refinedPrompt: undefined } : p;
  const issues = validate({ ...clean, isPromptDirty });
  const next = { ...clean, isPromptDirty, issues };
  return { ...next, scores: diagnose(next, issues) };
}

export function builtState(p: ProjectState): ProjectState {
  const hash = compilerInputHash(p);
  logger.info("compiler", `Synchronized deterministic blocks for "${p.name}" (hash: ${hash})`);
  return {
    ...p,
    blocks: compileBlocks(p),
    refinedPrompt: undefined,
    lastCompiledHash: hash,
    isPromptDirty: false,
    metadata: { ...p.metadata, compilerVersion: COMPILER_VERSION },
  };
}

export function applyUpdate(prev: ProjectState, raw: ProjectState): ProjectState {
  const signature = (p: ProjectState) =>
    JSON.stringify(p.blocks.map((b) => [b.id, b.text, b.enabled]));
  if (
    (compilerInputHash(prev) !== compilerInputHash(raw) || signature(prev) !== signature(raw)) &&
    raw.refinedPrompt
  )
    raw = { ...raw, refinedPrompt: undefined };
  return analyze({ ...raw, updatedAt: Date.now(), schemaVersion: PROJECT_SCHEMA_VERSION });
}
