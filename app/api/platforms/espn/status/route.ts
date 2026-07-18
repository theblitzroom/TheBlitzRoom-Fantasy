import { NextResponse } from "next/server";
import { getEspnConnection } from "@/lib/platforms/espn";
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
  try {
    const user = await getPlatformRequestUser(request);
    if (!user) {
      return json({ signedIn: false, connected: false, configured: true }, 200);
    }

    const connection = await getEspnConnection(user.id);
    return json({
      signedIn: true,
      configured: true,
      connected: Boolean(connection),
      platform: "espn",
      league: connection?.metadata?.league ?? null,
      updatedAt: connection?.updated_at ?? null
    }, 200);
  } catch (error) {
    return json({ signedIn: false, connected: false, configured: true, error: error instanceof Error ? error.message : "ESPN status failed." }, 500);
  }
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}
