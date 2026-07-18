import { NextResponse } from "next/server";
import { buildYahooAuthorizationUrl, hasYahooConfig } from "@/lib/platforms/yahoo";
import { createOAuthNonce, createOAuthState } from "@/lib/platforms/oauthState";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = safeNextPath(requestUrl.searchParams.get("next") || "/account");

  if (!hasYahooConfig()) {
    return NextResponse.redirect(new URL(`/account?yahoo=setup-required&next=${encodeURIComponent(next)}`, requestUrl.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/platforms/yahoo/connect?next=${next}`)}`, requestUrl.origin));
  }

  const nonce = createOAuthNonce();
  const state = createOAuthState({ userId: user.id, next, nonce });
  const yahooUrl = buildYahooAuthorizationUrl(requestUrl.origin, state);
  const response = NextResponse.redirect(yahooUrl);
  response.cookies.set("tbr_yahoo_oauth_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: requestUrl.protocol === "https:",
    path: "/",
    maxAge: 10 * 60
  });
  return response;
}

function safeNextPath(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}
