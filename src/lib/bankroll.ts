/**
 * Calculates the optimal stake using a conservative 1/4 Kelly Criterion
 * @param bankroll Total user bankroll
 * @param confidence Confidence percentage (0-100)
 * @param odds Decimal odds (e.g., 2.00). Defaults to 1.85 if minimal.
 * @returns Object with calculated amount and original percentage
 */
export function calculateStake(bankroll: number, confidence: number, odds: number = 1.85) {
    if (!bankroll || bankroll <= 0) return { amount: 0, percentage: 0 };
    if (confidence <= 50) return { amount: 0, percentage: 0 }; // Don't bet on low confidence

    // Kelly Criterion Formula: f = (bp - q) / b
    // b = decimal odds - 1
    // p = probability of winning (confidence / 100)
    // q = probability of losing (1 - p)

    const b = odds - 1;
    const p = confidence / 100;
    const q = 1 - p;

    const fullKellyFraction = (b * p - q) / b;

    // Use 1/4 Kelly for safety (standard practice in sports betting to avoid ruin)
    const safeFraction = fullKellyFraction / 4;

    if (safeFraction <= 0) return { amount: 0, percentage: 0 };

    // Max cap at 5% of bankroll for any single bet to prevent huge losses
    const cappedFraction = Math.min(safeFraction, 0.05);

    return {
        amount: Math.floor(bankroll * cappedFraction),
        percentage: Number((cappedFraction * 100).toFixed(1))
    };
}
