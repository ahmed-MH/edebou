export type IntentStrength = "HIGH" | "MEDIUM" | "LOW";

export interface IntentScore {
  readonly score: number;
  readonly strength: IntentStrength;
  readonly label: string;
  readonly explanation: string;
}

export function calculateIntentScore(intent: {
  readonly address: string | null;
  readonly customerName: string | null;
  readonly governorate: string | null;
  readonly items: unknown;
  readonly lastSeenAt: Date;
}): IntentScore {
  let score = 30;
  if ((intent.customerName?.trim().length ?? 0) >= 2) score += 20;
  if ((intent.address?.trim().length ?? 0) >= 8) score += 20;
  if (intent.governorate) score += 10;
  if (Array.isArray(intent.items) && intent.items.length > 0) score += 10;

  const ageMinutes = (Date.now() - intent.lastSeenAt.getTime()) / 60_000;
  if (ageMinutes <= 30) score += 10;
  else if (ageMinutes <= 24 * 60) score += 5;

  const boundedScore = Math.min(100, Math.max(0, score));
  if (boundedScore >= 80) {
    return {
      score: boundedScore,
      strength: "HIGH",
      label: "Intention forte",
      explanation: "Coordonnées avancées et activité récente.",
    };
  }
  if (boundedScore >= 55) {
    return {
      score: boundedScore,
      strength: "MEDIUM",
      label: "À qualifier",
      explanation: "Plusieurs signaux sont présents, mais le formulaire reste incomplet.",
    };
  }
  return {
    score: boundedScore,
    strength: "LOW",
    label: "Intention faible",
    explanation: "Peu de données ou activité ancienne.",
  };
}
