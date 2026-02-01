import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Fixture } from "@/lib/api-football";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getResult = (prediction: any, fixture: Fixture): 'WON' | 'LOST' | 'VOID' | null => {
  if (!prediction || !fixture.goals || fixture.goals.home === null || fixture.goals.away === null) return null;
  const h = fixture.goals.home;
  const a = fixture.goals.away;
  const total = h + a;
  const p = prediction.picked.toLowerCase();
  const type = prediction.type;

  if (type === "result") {
    // Clean prediction string (remove common betting terms to isolate team name)
    const cleanP = p.replace(/(win|to win|fc|cf)/g, "").trim();
    const cleanHome = fixture.homeTeam.name.toLowerCase().replace(/(fc|cf)/g, "").trim();
    const cleanAway = fixture.awayTeam.name.toLowerCase().replace(/(fc|cf)/g, "").trim();

    // Check Home Win
    if (
      p.includes("home") ||
      p.includes("1") ||
      cleanHome.includes(cleanP) ||
      cleanP.includes(cleanHome)
    ) return h > a ? 'WON' : 'LOST';

    // Check Away Win
    if (
      p.includes("away") ||
      p.includes("2") ||
      cleanAway.includes(cleanP) ||
      cleanP.includes(cleanAway)
    ) return a > h ? 'WON' : 'LOST';

    // Check Draw
    if (p.includes("draw") || p.includes("x")) return h === a ? 'WON' : 'LOST';
  }
  if (p.includes("over") || p.includes("under")) {
    const match = p.match(/(over|under)\s+(\d+\.\d+|\d+)/);
    if (match) {
      const threshold = parseFloat(match[2]);
      return (p.includes("over") ? total > threshold : total < threshold) ? 'WON' : 'LOST';
    }
  }
  if (p.includes("btts")) return (h > 0 && a > 0) === (!p.includes("no")) ? 'WON' : 'LOST';
  if (p.includes("1x")) return h >= a ? 'WON' : 'LOST';
  if (p.includes("x2")) return a >= h ? 'WON' : 'LOST';
  if (p.includes("12")) return h !== a ? 'WON' : 'LOST';
  return null;
};
