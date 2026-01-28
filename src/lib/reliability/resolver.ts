
import { SourceReport, UnifiedFixture, SOURCE_WEIGHTS } from './types';
import crypto from 'crypto';

export class ConflictResolver {
    /**
     * Normalizes team names for stable joining
     */
    static slugify(name: string): string {
        return name
            .toLowerCase()
            .replace(/ fc| afc| sc| united| city| real| st | saint /g, '')
            .trim()
            .replace(/\s+/g, '-');
    }

    /**
     * Resolves multiple source reports into a single high-confidence fixture
     */
    static resolve(reports: SourceReport[]): Partial<UnifiedFixture> {
        if (reports.length === 0) return {};

        // 1. Kickoff Resolution (Weighted Mean)
        let totalWeight = 0;
        let weightedKickoffMs = 0;

        reports.forEach(r => {
            const weight = SOURCE_WEIGHTS[r.source] || 1;
            totalWeight += weight;
            weightedKickoffMs += r.kickoff.getTime() * weight;
        });

        const resolvedKickoff = new Date(weightedKickoffMs / totalWeight);

        // 2. Status Resolution (Winner via weighted vote)
        const statusVotes: Record<string, number> = {};
        reports.forEach(r => {
            const weight = SOURCE_WEIGHTS[r.source] || 1;
            statusVotes[r.status] = (statusVotes[r.status] || 0) + weight;
        });

        const resolvedStatus = Object.entries(statusVotes).reduce((a, b) => a[1] > b[1] ? a : b)[0];

        // 3. Score Resolution (Trust highest weighted source that has a score)
        const scoreReport = reports
            .filter(r => r.scoreHome !== undefined)
            .sort((a, b) => (SOURCE_WEIGHTS[b.source] || 0) - (SOURCE_WEIGHTS[a.source] || 0))[0];

        return {
            kickoff: resolvedKickoff,
            status: resolvedStatus,
            score: scoreReport ? { home: scoreReport.scoreHome!, away: scoreReport.scoreAway! } : { home: null, away: null },
            confidence: Math.min(100, (totalWeight / 20) * 100), // Arbitrary scaling
            lastVerifiedAt: new Date()
        };
    }

    /**
     * Generates a hash to detect meaningful data changes
     */
    static generateHash(data: { kickoff: Date, status: string, score: { home: number | null, away: number | null } }): string {
        const content = `${data.kickoff.toISOString()}|${data.status}|${data.score.home}-${data.score.away}`;
        return crypto.createHash('md5').update(content).digest('hex');
    }
}
