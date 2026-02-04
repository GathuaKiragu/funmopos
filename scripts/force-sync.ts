import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
    console.log("Starting Manual Force Sync...");

    // Import after dotenv
    const { syncAllFixtures, getNairobiNow } = await import('../src/lib/api-football');

    // Sync today and tomorrow (most critical for users)
    console.log("Syncing Today and Tomorrow...");

    // Default syncAllFixtures(7, 0) syncs 7 days starting from today.
    // Let's just do that, it handles the loop.
    try {
        await syncAllFixtures(3, 0); // Sync 3 days starting today
        console.log("✅ Sync Complete.");
    } catch (error) {
        console.error("❌ Sync Failed:", error);
    }

    process.exit(0);
}

main();
