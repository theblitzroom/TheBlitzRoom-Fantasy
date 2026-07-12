import { NextResponse } from "next/server";
import { getSleeperUser, getSleeperUserLeagues } from "@/lib/sleeper/client";

function getSeason(request: Request) {
  const { searchParams } = new URL(request.url);
  return searchParams.get("season") || String(new Date().getFullYear());
}

export async function GET(request: Request, { params }: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await params;
    const season = getSeason(request);
    const user = await getSleeperUser(username);

    if (!user.user_id) {
      return NextResponse.json({ error: "Sleeper user was found, but no user ID was returned." }, { status: 502 });
    }

    const leagues = await getSleeperUserLeagues(user.user_id, season);

    return NextResponse.json({
      user,
      season,
      leagues: leagues
        .filter((league) => league.sport === "nfl")
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sleeper league lookup failed" },
      { status: 502 }
    );
  }
}
