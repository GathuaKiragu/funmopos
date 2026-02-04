import dotenv from 'dotenv';
import path from 'path';

// Load env vars from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
    console.log("Starting API-Football Pro Integration Verification (Fast Mode)...");

    const { enrichFixture } = await import('../src/lib/match-enrichment-service');

    // Mock Fixture based on logs we saw (San Diego vs Pumas)
    // ID: 1514129
    // We need to provide enough data for enrichment to work.
    const mockFixture: any = {
        id: 1514129,
        date: new Date().toISOString(), // Use today or the actual date if known, but enrichment uses 30 day history from 'today' usually
        homeTeam: { id: 0, name: "San Diego", logo: "" }, // IDs will be fetched or inferred if 0? Enricher uses fixture.id mostly.
        awayTeam: { id: 0, name: "U.N.A.M. - Pumas", logo: "" },
        league: { name: "Friendly", logo: "", flag: "" },
        status: { short: "NS" },
        goals: { home: null, away: null },
        prediction: null
    };

    console.log(`Enriching single fixture: [${mockFixture.id}] ${mockFixture.homeTeam.name} vs ${mockFixture.awayTeam.name}`);

    const start = Date.now();
    const enriched = await enrichFixture(mockFixture, true); // force refresh
    const duration = Date.now() - start;

    console.log(`\n--- Verification Results (${duration}ms) ---`);

    if (enriched.enrichedData) {
        const d = enriched.enrichedData;
        console.log(`✅ Enrichment Object Created`);

        // Stats
        if (d.teamStats?.home) {
            console.log(`✅ Stats Fetch Success: ${d.teamStats.home.team.name} has ${d.teamStats.home.statistics.length} stat points`);
        } else {
            console.warn(`⚠️ Stats missing or empty`);
        }

        // Lineups
        if (d.lineups?.home) {
            console.log(`✅ Lineups Fetch Success: ${d.lineups.home.formation} formation`);
        } else {
            console.warn(`⚠️ Lineups missing`);
        }

        // Injuries
        if (d.injuries) {
            const totalInjuries = (d.injuries.home?.length || 0) + (d.injuries.away?.length || 0);
            console.log(`✅ Injuries Fetch Success: ${totalInjuries} total reported`);
            if (d.injuries.home?.length > 0) console.log(`   Home: ${d.injuries.home[0].player.name} (${d.injuries.home[0].player.reason})`);
        } else {
            console.warn(`⚠️ Injuries missing (object is undefined)`);
        }

        // Odds
        if (d.odds?.homeWin) {
            console.log(`✅ Odds Fetch Success: Home @ ${d.odds.homeWin}`);
        } else {
            console.warn(`⚠️ Odds missing`);
        }

    } else {
        console.error("❌ Enrichment returned NO data object.");
    }

    console.log("\nVerification Complete.");
    process.exit(0);
}

main().catch(err => {
    console.error("Verification crashed:", err);
    process.exit(1);
});
