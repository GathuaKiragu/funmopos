
import { config } from 'dotenv';
import path from 'path';

// Load env vars FIRST
config({ path: path.resolve(process.cwd(), '.env.local') });

async function run() {
    console.log("Starting Manual Sync...");

    // Dynamic import to ensure env vars are loaded before Firebase init
    const { syncAllFixtures } = await import('../src/lib/api-football');

    try {
        // Sync today (0) and tomorrow (1)
        await syncAllFixtures(2, 0);
        console.log("Sync Complete!");
    } catch (error) {
        console.error("Sync Failed:", error);
    }
    process.exit(0);
}

run();
