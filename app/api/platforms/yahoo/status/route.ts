import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAuthedSupabaseClient, getYahooConnection, hasYahooConfig } from "@/lib/platforms/yahoo";

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
    const user = await getRequestUser(request);
    if (!user) {
      return json({ signedIn: false, connected: false, configured: hasYahooConfig() }, 200);
    }

    const connection = await getYahooConnection(user.id);
    return json({
      signedIn: true,
      configured: hasYahooConfig(),
      connected: Boolean(connection),
      platform: "yahoo",
      expiresAt: connection?.token_expires_at ?? null,
      updatedAt: connection?.updated_at ?? null
    }, 200);
  } catch (error) {
    return json({ signedIn: false, connected: false, configured: hasYahooConfig(), error: error instanceof Error ? error.message : "Yahoo status failed." }, 500);
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
