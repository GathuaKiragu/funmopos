import type { Fixture } from "./api-football";

type TeamStats = NonNullable<Fixture["stats"]>["home"];
const stat = (team: TeamStats | undefined, name: string) => Number(team?.statistics.find(s => s.type.toLowerCase() === name.toLowerCase())?.value) || 0;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Explainable baseline model. It deliberately abstains when the fixture lacks usable evidence. */
export function createStatisticalPrediction(fixture: Fixture): Fixture["prediction"] {
  const homeShots = stat(fixture.stats?.home, "Total Shots");
  const awayShots = stat(fixture.stats?.away, "Total Shots");
  const homeOnTarget = stat(fixture.stats?.home, "Shots on Goal");
  const awayOnTarget = stat(fixture.stats?.away, "Shots on Goal");
  const evidence = homeShots + awayShots + homeOnTarget + awayOnTarget;
  if (evidence < 4) return null;

  // Recent, supplied match statistics only; no inferred injuries, odds, or future results.
  const homeStrength = homeShots + 1.5 * homeOnTarget + 1.2;
  const awayStrength = awayShots + 1.5 * awayOnTarget + 1;
  const homeProbability = clamp(0.34 + (homeStrength - awayStrength) / 80, 0.18, 0.68);
  const awayProbability = clamp(0.30 + (awayStrength - homeStrength) / 80, 0.15, 0.62);
  const drawProbability = clamp(1 - homeProbability - awayProbability, 0.16, 0.36);
  const total = homeProbability + awayProbability + drawProbability;
  const probabilities = { home: Math.round(homeProbability / total * 100), draw: Math.round(drawProbability / total * 100), away: Math.round(awayProbability / total * 100) };
  const winner = probabilities.home >= probabilities.away && probabilities.home >= probabilities.draw ? "home" : probabilities.away >= probabilities.draw ? "away" : "draw";
  const picked = winner === "home" ? `${fixture.homeTeam.name} Win` : winner === "away" ? `${fixture.awayTeam.name} Win` : "Draw";
  const confidence = clamp(probabilities[winner] - 8, 40, 60);
  return {
    picked, confidence, type: "result", isRisky: true, requiresTier: "free", probabilities,
    reasoning: ["Baseline estimate from supplied match statistics.", "Insufficient historical evidence for a high-confidence selection."],
    analysis: "Statistical baseline only. This fixture needs more historical and team-context data before a stronger recommendation can be made."
  };
}
