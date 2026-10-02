/**
 * Computes live word count, character count, estimated BPE tokens, and context readiness for Qwen 2.1.
 */
export function qwenTokenStats(text: string): {
  words: number;
  characters: number;
  estimatedTokens: number;
  statusText: string;
  isSafe: boolean;
} {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const characters = text.length;
  // Qwen BPE tokenizer estimates ~1.35 tokens per word on average in English
  const estimatedTokens = Math.max(1, Math.ceil(words * 1.35));
  let statusText = "Ready for Qwen 2.1";
  let isSafe = true;

  if (estimatedTokens < 200) {
    statusText = "Compact & High Precision · Perfect for Qwen 2.1";
  } else if (estimatedTokens <= 450) {
    statusText = "Optimal Detail & Guidance · Great Coherence";
  } else if (estimatedTokens <= 1024) {
    statusText = "Rich Multi-Reference Context · Within 2K Window";
  } else {
    statusText = "Very Long · Consider condensing secondary instructions";
    isSafe = false;
  }

  return { words, characters, estimatedTokens, statusText, isSafe };
}
