
import { db } from "@/lib/firebase";
import { collection, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { SourceIdentity, SourceReport, UnifiedFixture } from "./types";
import { ConflictResolver } from "./resolver";

export class MultiSourceIngestor {
    /**
     * Entry point: Synchronizes a single match or range of matches
     */
    static async ingestMatches(reports: SourceReport[]) {
        // 1. Group reports by Match Key
        const groups: Record<string, SourceReport[]> = {};

        reports.forEach(r => {
            const dateStr = r.kickoff.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
            const key = `${ConflictResolver.slugify(r.homeTeam)}-vs-${ConflictResolver.slugify(r.awayTeam)}-${dateStr}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(r);
        });

        // 2. Process each match
        for (const [matchId, matchReports] of Object.entries(groups)) {
            await this.processMatch(matchId, matchReports);
        }
    }

    private static async processMatch(id: string, reports: SourceReport[]) {
        const docRef = doc(db, "verified_fixtures", id);
        const existingSnap = await getDoc(docRef);
        const existingData = existingSnap.exists() ? (existingSnap.data() as UnifiedFixture) : null;

        // 1. Resolve Current State
        const resolved = ConflictResolver.resolve(reports);

        // 2. Build New State
        const newState: Partial<UnifiedFixture> = {
            ...resolved,
            id,
            homeTeam: {
                name: reports[0].homeTeam,
                logo: "" // Logo needs to be merged from sources
            },
            awayTeam: {
                name: reports[0].awayTeam,
                logo: ""
            },
            sourceBreakdown: reports.reduce((acc, r) => {
                acc[r.source] = `${r.status} ${r.scoreHome ?? ''}-${r.scoreAway ?? ''}`;
                return acc;
            }, {} as Record<string, string>)
        };

        // 3. Generate Hash for Change Detection
        const currentHash = ConflictResolver.generateHash({
            kickoff: newState.kickoff!,
            status: newState.status!,
            score: newState.score!
        });

        // 4. Selective Write
        if (!existingData || existingData.stateHash !== currentHash) {
            console.log(`[Reliability] Change detected for ${id}. Updating...`);
            await setDoc(docRef, {
                ...newState,
                stateHash: currentHash,
                nairobiDateKey: reports[0].kickoff.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" })
            }, { merge: true });
        } else {
            // Only update "last verified" if no data change
            await updateDoc(docRef, { lastVerifiedAt: new Date() });
        }
    }
}
