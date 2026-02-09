import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { syncAllFixtures } from "./src/lib/api-football";

async function run() {
    console.log("Firebase API Key:", process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "Found" : "NOT FOUND");
    console.log("Starting historical backfill...");
    // 10 days, starting 8 days ago
    await syncAllFixtures(10, -8, false);
    console.log("Backfill complete!");
    process.exit(0);
}

run();
