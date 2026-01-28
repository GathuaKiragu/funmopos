
export enum SourceIdentity {
    BASELINE_API = "baseline_api", // football-data.org
    BESOCCER = "besoccer",
    FLASHSCORE = "flashscore",
    BBC_SPORT = "bbc_sport"
}

export const SOURCE_WEIGHTS: Record<SourceIdentity, number> = {
    [SourceIdentity.BBC_SPORT]: 10,  // High authority
    [SourceIdentity.FLASHSCORE]: 8,   // High accuracy for status/kickoff
    [SourceIdentity.BESOCCER]: 5,    // Good coverage
    [SourceIdentity.BASELINE_API]: 1 // Minimum trust for metadata only
};

export interface SourceReport {
    source: SourceIdentity;
    timestamp: Date;
    homeTeam: string;
    awayTeam: string;
    kickoff: Date;
    status: string; // NS, FT, PST, LIVE, etc.
    scoreHome?: number;
    scoreAway?: number;
    rawId?: string;
}

export interface UnifiedFixture {
    id: string; // Stable slug: home-away-date
    nairobiDateKey: string;
    kickoff: Date;
    status: string;
    homeTeam: { name: string; logo: string };
    awayTeam: { name: string; logo: string };
    league: string;
    score: { home: number | null; away: number | null };
    confidence: number; // 0-100
    stateHash: string; // MD5 of {kickoff, status, score}
    lastVerifiedAt: Date;
    sourceBreakdown: Record<string, string>; // Source -> ReportedValue
}
