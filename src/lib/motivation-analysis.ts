import { StandingsData } from './football-highlights-api';

/**
 * Motivation levels for teams based on league position
 */
export enum MotivationLevel {
    CRITICAL = 'CRITICAL',      // Relegation battle, must win
    HIGH = 'HIGH',              // European qualification, title race
    MEDIUM = 'MEDIUM',          // Mid-table with something to play for
    LOW = 'LOW',                // Safe mid-table, nothing to play for
    VERY_LOW = 'VERY_LOW'       // Already relegated/champions, season over
}

export interface TeamMotivation {
    level: MotivationLevel;
    reason: string;
    impactScore: number; // 0-100, higher = more motivated
}

export interface MotivationAnalysis {
    home: TeamMotivation;
    away: TeamMotivation;
    motivationDifferential: number; // Positive = home more motivated
    context: string; // Human-readable summary
}

/**
 * Analyze team motivation based on league position and context
 */
export function analyzeMotivation(
    standings: StandingsData,
    homeTeamId: number,
    awayTeamId: number
): MotivationAnalysis | null {
    if (!standings || !standings.standings || standings.standings.length === 0) {
        return null;
    }

    const homeTeam = standings.standings.find(s => s.team.id === homeTeamId);
    const awayTeam = standings.standings.find(s => s.team.id === awayTeamId);

    if (!homeTeam || !awayTeam) {
        return null;
    }

    const totalTeams = standings.standings.length;
    const homeMotivation = calculateTeamMotivation(homeTeam, totalTeams, standings);
    const awayMotivation = calculateTeamMotivation(awayTeam, totalTeams, standings);

    const differential = homeMotivation.impactScore - awayMotivation.impactScore;

    // Generate context summary
    let context = '';
    if (Math.abs(differential) > 30) {
        const moreMotivated = differential > 0 ? 'Home' : 'Away';
        const lessMotivated = differential > 0 ? 'Away' : 'Home';
        context = `${moreMotivated} team has SIGNIFICANTLY higher motivation (${Math.abs(differential).toFixed(0)} points). ${differential > 0 ? homeMotivation.reason : awayMotivation.reason}. ${lessMotivated} team: ${differential > 0 ? awayMotivation.reason : homeMotivation.reason}.`;
    } else if (Math.abs(differential) > 15) {
        const moreMotivated = differential > 0 ? 'Home' : 'Away';
        context = `${moreMotivated} team more motivated. ${differential > 0 ? homeMotivation.reason : awayMotivation.reason}.`;
    } else {
        context = `Both teams have similar motivation levels. Home: ${homeMotivation.reason}. Away: ${awayMotivation.reason}.`;
    }

    return {
        home: homeMotivation,
        away: awayMotivation,
        motivationDifferential: differential,
        context
    };
}

/**
 * Calculate motivation for a single team
 */
function calculateTeamMotivation(
    team: StandingsData['standings'][0],
    totalTeams: number,
    standings: StandingsData
): TeamMotivation {
    const position = team.position;
    const points = team.points;
    const form = team.form || '';

    // Determine league size category
    const isTopLeague = totalTeams >= 18; // Premier League, La Liga, etc.
    const relegationZone = isTopLeague ? 3 : 2; // Bottom 3 or 2 teams
    const europeanSpots = isTopLeague ? 7 : 4; // Top 7 or 4 get Europe
    const titleRace = 3; // Top 3 in title race

    // Calculate points from relegation
    const relegationPosition = totalTeams - relegationZone + 1;
    const relegationTeam = totalTeams >= relegationPosition ? totalTeams - relegationZone : null;

    // Recent form analysis
    const recentWins = (form.match(/W/g) || []).length;
    const recentLosses = (form.match(/L/g) || []).length;
    const formScore = (recentWins * 2) - recentLosses; // -5 to +10

    // CRITICAL: Relegation Battle
    if (position >= relegationPosition) {
        return {
            level: MotivationLevel.CRITICAL,
            reason: `RELEGATION BATTLE - Position ${position}/${totalTeams}, fighting for survival`,
            impactScore: 95 + formScore
        };
    }

    // CRITICAL: 1-2 points above relegation
    if (relegationTeam && position >= relegationPosition - 2) {
        const relegationTeamData = standings.standings.find((s: any) => s.position === relegationPosition);
        const pointsAboveRelegation = points - (relegationTeamData?.points || 0);
        if (pointsAboveRelegation <= 3) {
            return {
                level: MotivationLevel.CRITICAL,
                reason: `Danger zone - Only ${pointsAboveRelegation} points above relegation`,
                impactScore: 90 + formScore
            };
        }
    }

    // HIGH: Title Race
    if (position <= titleRace) {
        const topTeam = standings.standings[0];
        const pointsFromTop = (topTeam?.points || 0) - points;
        if (pointsFromTop <= 5) {
            return {
                level: MotivationLevel.HIGH,
                reason: `TITLE RACE - ${pointsFromTop} points from 1st place`,
                impactScore: 85 + formScore
            };
        }
    }

    // HIGH: European Qualification Race
    if (position <= europeanSpots + 2) {
        const europeanSpotTeam = standings.standings.find((s: any) => s.position === europeanSpots);
        const pointsFromEurope = (europeanSpotTeam?.points || 0) - points;

        if (position <= europeanSpots) {
            return {
                level: MotivationLevel.HIGH,
                reason: `Securing European spot - Position ${position}`,
                impactScore: 75 + formScore
            };
        } else if (pointsFromEurope <= 4) {
            return {
                level: MotivationLevel.HIGH,
                reason: `Chasing European qualification - ${Math.abs(pointsFromEurope)} points away`,
                impactScore: 70 + formScore
            };
        }
    }

    // MEDIUM: Mid-table with decent form
    if (recentWins >= 2) {
        return {
            level: MotivationLevel.MEDIUM,
            reason: `Mid-table with good form (${form})`,
            impactScore: 55 + formScore
        };
    }

    // LOW: Safe mid-table
    const pointsAboveRelegation = relegationTeam
        ? points - (standings.standings.find((s: any) => s.position === relegationPosition)?.points || 0)
        : 20;

    if (pointsAboveRelegation > 10 && position > europeanSpots + 3) {
        return {
            level: MotivationLevel.LOW,
            reason: `Safe mid-table - Nothing to play for`,
            impactScore: 40 + formScore
        };
    }

    // VERY_LOW: Already relegated or champions (season over)
    if (position === totalTeams && pointsAboveRelegation < -10) {
        return {
            level: MotivationLevel.VERY_LOW,
            reason: `Already relegated - Season effectively over`,
            impactScore: 20 + formScore
        };
    }

    if (position === 1 && (standings.standings[1]?.points || 0) < points - 10) {
        return {
            level: MotivationLevel.VERY_LOW,
            reason: `Already champions - Title secured`,
            impactScore: 30 + formScore
        };
    }

    // Default: MEDIUM
    return {
        level: MotivationLevel.MEDIUM,
        reason: `Mid-table position ${position}/${totalTeams}`,
        impactScore: 50 + formScore
    };
}
