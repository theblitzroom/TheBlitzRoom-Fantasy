import { NextResponse } from "next/server";
import { upsertEspnConnection, verifyEspnPublicLeague } from "@/lib/platforms/espn";
import { getPlatformRequestUser } from "@/lib/platforms/supabaseAuth";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "authorization,content-type"
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  const user = await getPlatformRequestUser(request);
  if (!user) {
    return json({ connected: false, error: "Sign in before connecting ESPN." }, 401);
  }

  try {
    const body = await request.json() as { leagueId?: string; season?: string };
    const league = await verifyEspnPublicLeague(body.leagueId ?? "", body.season ?? "");
    await upsertEspnConnection({ id: user.id }, league);
    return json({ connected: true, league }, 200);
  } catch (error) {
    return json({ connected: false, error: error instanceof Error ? error.message : "ESPN league could not be connected." }, 400);
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}
