import { NextResponse } from "next/server";
import { fetchSavedEspnLeagues } from "@/lib/platforms/espn";
import { getPlatformRequestUser } from "@/lib/platforms/supabaseAuth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "authorization,content-type"
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  const user = await getPlatformRequestUser(request);
  if (!user) {
    return json({ leagues: [], connected: false, error: "Sign in before loading ESPN leagues." }, 401);
  }

  try {
    const leagues = await fetchSavedEspnLeagues(user.id);
    return json({ connected: leagues.length > 0, leagues }, 200);
  } catch (error) {
    return json({ leagues: [], connected: false, error: error instanceof Error ? error.message : "ESPN leagues could not be loaded." }, 502);
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}
