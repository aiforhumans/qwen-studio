import { WORDING_VARIANTS, type WordingVariant } from "./constants";
import type { LearningRecord, PrefEvent } from "./storage";
import type { BlockId, Operation } from "./types";

export interface WordingEvidence {
  wording: WordingVariant;
  wins: number;
  losses: number;
  ratings: number;
  averageCoherence?: number | undefined;
  score: number;
  confidence: number;
  evidence: number;
}

const variantOf = (label: string): WordingVariant | undefined => {
  const v = label.split("/")[0] as WordingVariant;
  return WORDING_VARIANTS.includes(v) ? v : undefined;
};

export function wordingEvidence(
  operation: Operation,
  block: BlockId,
  prefs: PrefEvent[],
  ratings: LearningRecord[],
): WordingEvidence[] {
  return WORDING_VARIANTS.map((wording) => {
    let wins = 0;
    let losses = 0;
    for (const p of prefs) {
      if (p.operation !== operation || p.blockType !== block) continue;
      if (variantOf(p.chosen) === wording) wins++;
      if (variantOf(p.rejected) === wording) losses++;
    }
    const matchingRatings = ratings.filter(
      (r) => r.wordingVariant === wording && r.editOperations.includes(operation),
    );
    const avg = matchingRatings.length
      ? matchingRatings.reduce((n, r) => n + r.ratings.coherence, 0) / matchingRatings.length
      : undefined;

    // Beta(1,1) smoothing prevents one A/B click from producing false certainty.
    const prefScore = (wins + 1) / (wins + losses + 2);
    const ratingScore = avg === undefined ? 0.5 : Math.max(0, Math.min(1, avg / 10));
    const prefWeight = wins + losses;
    const ratingWeight = matchingRatings.length;
    const evidence = prefWeight + ratingWeight;
    const score = evidence
      ? (prefScore * Math.max(1, prefWeight) + ratingScore * ratingWeight) /
        (Math.max(1, prefWeight) + ratingWeight)
      : 0.5;
    const confidence = 1 - Math.exp(-evidence / 6);
    return {
      wording,
      wins,
      losses,
      ratings: matchingRatings.length,
      averageCoherence: avg,
      score,
      confidence,
      evidence,
    };
  });
}

export function recommendWording(
  operation: Operation,
  block: BlockId,
  prefs: PrefEvent[],
  ratings: LearningRecord[],
): WordingEvidence | undefined {
  const evidence = wordingEvidence(operation, block, prefs, ratings);
  const tested = evidence.filter((x) => x.evidence > 0);
  if (!tested.length) return undefined;
  return tested.sort((a, b) => b.score - a.score || b.evidence - a.evidence)[0];
}

/**
 * Active-learning pair: prioritize under-tested wordings, then pair variants whose
 * estimated scores are close. This produces useful A/B comparisons instead of
 * repeatedly testing an already dominant option against an uninformative one.
 */
export function suggestExplorationPair(
  operation: Operation,
  block: BlockId,
  prefs: PrefEvent[],
  ratings: LearningRecord[],
): [WordingVariant, WordingVariant] {
  const ev = wordingEvidence(operation, block, prefs, ratings);
  const candidates = [...ev].sort(
    (a, b) => a.evidence - b.evidence || Math.abs(a.score - 0.5) - Math.abs(b.score - 0.5),
  );
  const a = candidates[0] ?? ev[0]!;
  const rest = candidates.filter((x) => x.wording !== a.wording);
  const b =
    [...rest].sort(
      (x, y) =>
        Math.abs(x.score - a.score) - Math.abs(y.score - a.score) || x.evidence - y.evidence,
    )[0] ?? rest[0]!;
  return [a.wording, b.wording];
}
