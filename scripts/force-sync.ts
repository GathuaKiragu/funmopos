import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
    console.log("Starting Manual Force Sync (Including Past Matches)...");

    // Import after dotenv
    const { syncAllFixtures, getNairobiNow } = await import('../src/lib/api-football');

    // Sync Yesterday, Today, Tomorrow (3 days starting from -1)
    console.log("Syncing Yesterday (-1), Today (0), and Tomorrow (1)...");

    try {
        await syncAllFixtures(3, -1); // 3 days starting from -1 means: -1, 0, 1
        console.log("✅ Sync Complete.");
    } catch (error) {
        console.error("❌ Sync Failed:", error);
    }

    process.exit(0);
}

main();
