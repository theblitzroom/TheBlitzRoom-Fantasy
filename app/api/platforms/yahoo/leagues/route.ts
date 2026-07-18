import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuthedSupabaseClient, fetchYahooFantasyLeagues, hasYahooConfig } from "@/lib/platforms/yahoo";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "authorization,content-type"
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: Request) {
  if (!hasYahooConfig()) {
    return json({ leagues: [], connected: false, error: "Yahoo OAuth is not configured yet." }, 503);
  }

  const user = await getRequestUser(request);
  if (!user) {
    return json({ leagues: [], connected: false, error: "Sign in before loading Yahoo leagues." }, 401);
  }

  try {
    const leagues = await fetchYahooFantasyLeagues(user.id);
    return json({ connected: true, leagues }, 200);
  } catch (error) {
    return json({ leagues: [], connected: false, error: error instanceof Error ? error.message : "Yahoo leagues could not be loaded." }, 502);
  }
}

async function getRequestUser(request: Request) {
  const bearer = getBearerToken(request);
  if (bearer) {
    const supabase = createAuthedSupabaseClient(bearer);
    const { data } = await supabase.auth.getUser(bearer);
    return data.user ?? null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

function getBearerToken(request: Request) {
  const match = (request.headers.get("authorization") ?? "").match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: corsHeaders });
}
