import { db } from './firebase';
import { collection, addDoc, doc, updateDoc, query, where, getDocs, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { PredictionResult } from './types/stats';
import { Fixture } from './api-football';

/**
 * Store a prediction result for tracking
 */
export async function storePredictionResult(
    fixture: Fixture,
    dataQuality: {
        hadTeamStats: boolean;
        hadH2H: boolean;
        hadInjuries: boolean;
        hadLineups: boolean;
        hadOdds: boolean;
    }
): Promise<string | null> {
    try {
        if (!fixture.prediction) {
            console.warn('[Prediction Tracker] No prediction to store for fixture', fixture.id);
            return null;
        }

        const predictionResult: Omit<PredictionResult, 'createdAt' | 'resolvedAt'> & {
            createdAt: Date;
            resolvedAt: Date | null;
        } = {
            fixtureId: fixture.id,
            date: fixture.date,
            homeTeam: fixture.homeTeam.name,
            awayTeam: fixture.awayTeam.name,
            league: fixture.league.name,

            prediction: {
                picked: fixture.prediction.picked,
                confidence: fixture.prediction.confidence,
                type: fixture.prediction.type,
                requiresTier: fixture.prediction.requiresTier
            },

            actualResult: 'PENDING',
            finalScore: {
                home: fixture.goals?.home || null,
                away: fixture.goals?.away || null
            },

            dataQuality,

            createdAt: new Date(),
            resolvedAt: null
        };

        const docRef = await addDoc(collection(db, 'prediction_results'), predictionResult);
        console.log(`[Prediction Tracker] Stored prediction for fixture ${fixture.id}`);

        return docRef.id;

    } catch (error) {
        console.error('[Prediction Tracker] Error storing prediction:', error);
        return null;
    }
}

/**
 * Update prediction result when match finishes
 */
export async function updatePredictionResult(
    fixtureId: number,
    actualResult: 'WON' | 'LOST' | 'VOID',
    finalScore: { home: number; away: number }
): Promise<void> {
    try {
        // Find the prediction document
        const q = query(
            collection(db, 'prediction_results'),
            where('fixtureId', '==', fixtureId),
            firestoreLimit(1)
        );

        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            console.warn(`[Prediction Tracker] No prediction found for fixture ${fixtureId}`);
            return;
        }

        const docRef = querySnapshot.docs[0].ref;

        await updateDoc(docRef, {
            actualResult,
            finalScore,
            resolvedAt: new Date()
        });

        console.log(`[Prediction Tracker] Updated result for fixture ${fixtureId}: ${actualResult}`);

    } catch (error) {
        console.error('[Prediction Tracker] Error updating prediction:', error);
    }
}

/**
 * Get prediction statistics
 */
export async function getPredictionStats(days: number = 7): Promise<{
    total: number;
    won: number;
    lost: number;
    pending: number;
    winRate: number;
    byDataQuality: {
        complete: { total: number; won: number; winRate: number };
        partial: { total: number; won: number; winRate: number };
        minimal: { total: number; won: number; winRate: number };
    };
    byConfidence: {
        high: { total: number; won: number; winRate: number }; // 85+
        medium: { total: number; won: number; winRate: number }; // 75-84
        low: { total: number; won: number; winRate: number }; // <75
    };
}> {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);

        const q = query(
            collection(db, 'prediction_results'),
            where('createdAt', '>=', cutoffDate),
            orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        const predictions = querySnapshot.docs.map(doc => doc.data() as PredictionResult);

        // Overall stats
        const total = predictions.length;
        const won = predictions.filter(p => p.actualResult === 'WON').length;
        const lost = predictions.filter(p => p.actualResult === 'LOST').length;
        const pending = predictions.filter(p => p.actualResult === 'PENDING').length;
        const winRate = total > 0 ? (won / (won + lost)) * 100 : 0;

        // By data quality
        const complete = predictions.filter(p =>
            p.dataQuality.hadTeamStats && p.dataQuality.hadH2H
        );
        const partial = predictions.filter(p =>
            (p.dataQuality.hadTeamStats || p.dataQuality.hadH2H) &&
            !(p.dataQuality.hadTeamStats && p.dataQuality.hadH2H)
        );
        const minimal = predictions.filter(p =>
            !p.dataQuality.hadTeamStats && !p.dataQuality.hadH2H
        );

        const calcWinRate = (preds: PredictionResult[]) => {
            const w = preds.filter(p => p.actualResult === 'WON').length;
            const l = preds.filter(p => p.actualResult === 'LOST').length;
            return w + l > 0 ? (w / (w + l)) * 100 : 0;
        };

        // By confidence
        const high = predictions.filter(p => p.prediction.confidence >= 85);
        const medium = predictions.filter(p => p.prediction.confidence >= 75 && p.prediction.confidence < 85);
        const low = predictions.filter(p => p.prediction.confidence < 75);

        return {
            total,
            won,
            lost,
            pending,
            winRate: Math.round(winRate * 10) / 10,

            byDataQuality: {
                complete: {
                    total: complete.length,
                    won: complete.filter(p => p.actualResult === 'WON').length,
                    winRate: Math.round(calcWinRate(complete) * 10) / 10
                },
                partial: {
                    total: partial.length,
                    won: partial.filter(p => p.actualResult === 'WON').length,
                    winRate: Math.round(calcWinRate(partial) * 10) / 10
                },
                minimal: {
                    total: minimal.length,
                    won: minimal.filter(p => p.actualResult === 'WON').length,
                    winRate: Math.round(calcWinRate(minimal) * 10) / 10
                }
            },

            byConfidence: {
                high: {
                    total: high.length,
                    won: high.filter(p => p.actualResult === 'WON').length,
                    winRate: Math.round(calcWinRate(high) * 10) / 10
                },
                medium: {
                    total: medium.length,
                    won: medium.filter(p => p.actualResult === 'WON').length,
                    winRate: Math.round(calcWinRate(medium) * 10) / 10
                },
                low: {
                    total: low.length,
                    won: low.filter(p => p.actualResult === 'WON').length,
                    winRate: Math.round(calcWinRate(low) * 10) / 10
                }
            }
        };

    } catch (error) {
        console.error('[Prediction Tracker] Error getting stats:', error);
        return {
            total: 0,
            won: 0,
            lost: 0,
            pending: 0,
            winRate: 0,
            byDataQuality: {
                complete: { total: 0, won: 0, winRate: 0 },
                partial: { total: 0, won: 0, winRate: 0 },
                minimal: { total: 0, won: 0, winRate: 0 }
            },
            byConfidence: {
                high: { total: 0, won: 0, winRate: 0 },
                medium: { total: 0, won: 0, winRate: 0 },
                low: { total: 0, won: 0, winRate: 0 }
            }
        };
    }
}
