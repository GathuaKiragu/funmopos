/**
 * Diagnostic script to analyze prediction accuracy
 * Run with: npx tsx scripts/analyze-accuracy.ts
 */

import { getAdminDb } from '../src/lib/firebase-admin';

const db = getAdminDb();
import { getResult } from '../src/lib/utils';
import { Fixture } from '../src/lib/api-football';
import { subDays, format } from 'date-fns';

async function analyzePredictionAccuracy() {
    console.log('🔍 Analyzing Prediction Accuracy...\n');

    // Get last 7 days of data
    const dateKeys: string[] = [];
    for (let i = 0; i < 7; i++) {
        const d = subDays(new Date(), i);
        dateKeys.push(format(d, 'yyyy-MM-dd'));
    }

    console.log(`📅 Analyzing dates: ${dateKeys.join(', ')}\n`);

    const allFixtures: Fixture[] = [];

    // Fetch fixtures from Firestore
    for (const dateKey of dateKeys) {
        const snapshot = await db.collection('fixtures')
            .where('dateKey', '==', dateKey)
            .where('sport', '==', 'football')
            .get();

        snapshot.docs.forEach(doc => {
            allFixtures.push(doc.data() as Fixture);
        });
    }

    console.log(`📊 Total fixtures found: ${allFixtures.length}`);

    // Filter for finished matches with predictions
    const finishedWithPredictions = allFixtures.filter(f => {
        const isFinished = ['FT', 'AET', 'PEN'].includes(f.status.short);
        const hasPrediction = !!f.prediction;
        return isFinished && hasPrediction;
    });

    console.log(`✅ Finished matches with predictions: ${finishedWithPredictions.length}\n`);

    // Analyze by confidence levels
    const vipPicks = finishedWithPredictions.filter(f => {
        const confidence = f.prediction?.confidence || 0;
        const isRisky = f.prediction?.isRisky || false;
        return confidence > 85 && !isRisky;
    });

    const allPicks = finishedWithPredictions;

    console.log('═══════════════════════════════════════════════════════');
    console.log('📈 VIP PICKS (>85% confidence, non-risky)');
    console.log('═══════════════════════════════════════════════════════');
    analyzeGroup(vipPicks, 'VIP');

    console.log('\n═══════════════════════════════════════════════════════');
    console.log('📊 ALL PICKS');
    console.log('═══════════════════════════════════════════════════════');
    analyzeGroup(allPicks, 'ALL');

    // Detailed breakdown of failed predictions
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('🔍 DETAILED ANALYSIS OF VIP LOSSES');
    console.log('═══════════════════════════════════════════════════════\n');

    const vipLosses = vipPicks.filter(f => getResult(f.prediction, f) === 'LOST');
    vipLosses.slice(0, 10).forEach((f, idx) => {
        console.log(`${idx + 1}. ${f.homeTeam.name} vs ${f.awayTeam.name}`);
        console.log(`   Score: ${f.goals?.home}-${f.goals?.away}`);
        console.log(`   Prediction: ${f.prediction?.picked} (${f.prediction?.confidence}%)`);
        console.log(`   Reasoning: ${Array.isArray(f.prediction?.reasoning) ? f.prediction.reasoning[0] : f.prediction?.reasoning}`);
        console.log('');
    });

    // Check for null results (unparseable predictions)
    console.log('═══════════════════════════════════════════════════════');
    console.log('⚠️  UNPARSEABLE PREDICTIONS (returning null)');
    console.log('═══════════════════════════════════════════════════════\n');

    const nullResults = finishedWithPredictions.filter(f => getResult(f.prediction, f) === null);
    console.log(`Total unparseable: ${nullResults.length}`);

    nullResults.slice(0, 5).forEach((f, idx) => {
        console.log(`${idx + 1}. ${f.homeTeam.name} vs ${f.awayTeam.name}`);
        console.log(`   Prediction: "${f.prediction?.picked}"`);
        console.log(`   Type: ${f.prediction?.type}`);
        console.log('');
    });
}

function analyzeGroup(fixtures: Fixture[], label: string) {
    const total = fixtures.length;
    const won = fixtures.filter(f => getResult(f.prediction, f) === 'WON').length;
    const lost = fixtures.filter(f => getResult(f.prediction, f) === 'LOST').length;
    const nullResults = fixtures.filter(f => getResult(f.prediction, f) === null).length;

    const accuracy = total > 0 ? ((won / total) * 100).toFixed(2) : '0.00';

    console.log(`Total Matches: ${total}`);
    console.log(`Won: ${won} (${((won / total) * 100).toFixed(1)}%)`);
    console.log(`Lost: ${lost} (${((lost / total) * 100).toFixed(1)}%)`);
    console.log(`Null/Unparseable: ${nullResults} (${((nullResults / total) * 100).toFixed(1)}%)`);
    console.log(`\n🎯 Accuracy: ${accuracy}%`);

    // Confidence distribution
    const confidenceBuckets = {
        '85-90': 0,
        '90-95': 0,
        '95-100': 0
    };

    fixtures.forEach(f => {
        const conf = f.prediction?.confidence || 0;
        if (conf >= 85 && conf < 90) confidenceBuckets['85-90']++;
        else if (conf >= 90 && conf < 95) confidenceBuckets['90-95']++;
        else if (conf >= 95) confidenceBuckets['95-100']++;
    });

    console.log('\n📊 Confidence Distribution:');
    console.log(`  85-90%: ${confidenceBuckets['85-90']}`);
    console.log(`  90-95%: ${confidenceBuckets['90-95']}`);
    console.log(`  95-100%: ${confidenceBuckets['95-100']}`);
}

// Run the analysis
analyzePredictionAccuracy()
    .then(() => {
        console.log('\n✅ Analysis complete!');
        process.exit(0);
    })
    .catch(error => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
