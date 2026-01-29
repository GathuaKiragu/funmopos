// Team Statistics Types
export interface TeamStatistics {
    teamId: number;
    teamName: string;
    leagueId: number;
    season: number;
    lastUpdated: Date;

    // Overall stats
    matchesPlayed: number;
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;

    // Home/Away split
    home: {
        played: number;
        wins: number;
        draws: number;
        losses: number;
        goalsFor: number;
        goalsAgainst: number;
    };
    away: {
        played: number;
        wins: number;
        draws: number;
        losses: number;
        goalsFor: number;
        goalsAgainst: number;
    };

    // Form (last 5 matches)
    form: string; // e.g., "WWDLW"
    last5Matches: {
        date: string;
        opponent: string;
        homeAway: 'H' | 'A';
        result: 'W' | 'D' | 'L';
        goalsFor: number;
        goalsAgainst: number;
    }[];

    // Advanced stats
    avgGoalsScored: number;
    avgGoalsConceded: number;
    cleanSheets: number;
    failedToScore: number;
}

// Head-to-Head Types
export interface HeadToHead {
    id: string; // "teamId1-teamId2" (sorted)
    team1Id: number;
    team2Id: number;
    team1Name: string;
    team2Name: string;
    lastUpdated: Date;

    totalMeetings: number;
    team1Wins: number;
    draws: number;
    team2Wins: number;

    last5Meetings: {
        date: string;
        homeTeamId: number;
        awayTeamId: number;
        homeScore: number;
        awayScore: number;
        winner: number | null; // teamId or null for draw
    }[];

    avgGoalsPerGame: number;
}

// Prediction Result Tracking
export interface PredictionResult {
    fixtureId: number;
    date: string;
    homeTeam: string;
    awayTeam: string;
    league: string;

    prediction: {
        picked: string;
        confidence: number;
        type: string;
        requiresTier: string;
    };

    actualResult: 'WON' | 'LOST' | 'VOID' | 'PENDING';
    finalScore: {
        home: number | null;
        away: number | null;
    };

    dataQuality: {
        hadTeamStats: boolean;
        hadH2H: boolean;
        hadInjuries: boolean;
        hadLineups: boolean;
        hadOdds: boolean;
    };

    createdAt: Date;
    resolvedAt: Date | null;
}

// Enriched Fixture (for AI analysis)
export interface FixtureEnrichment {
    homeStats: TeamStatistics | null;
    awayStats: TeamStatistics | null;
    h2h: HeadToHead | null;
    hasCompleteData: boolean;
}
