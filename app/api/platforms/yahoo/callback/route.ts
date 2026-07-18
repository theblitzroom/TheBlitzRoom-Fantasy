import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeYahooCodeForToken, upsertYahooConnection } from "@/lib/platforms/yahoo";
import { verifyOAuthState } from "@/lib/platforms/oauthState";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const stateValue = requestUrl.searchParams.get("state");
  const error = requestUrl.searchParams.get("error");

  if (error) {
    return redirectWithStatus(requestUrl, "/account", `error:${error}`);
  }

  if (!code || !stateValue) {
    return redirectWithStatus(requestUrl, "/account", "missing-code");
  }

  try {
    const state = verifyOAuthState(stateValue);
    const cookieStore = await cookies();
    const nonce = cookieStore.get("tbr_yahoo_oauth_nonce")?.value;
    if (!nonce || nonce !== state.nonce) {
      throw new Error("Yahoo OAuth state cookie did not match.");
    }

    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user || user.id !== state.userId) {
      throw new Error("Sign in again before connecting Yahoo.");
    }

    const token = await exchangeYahooCodeForToken(code, requestUrl.origin);
    await upsertYahooConnection(user, token);

    const response = NextResponse.redirect(new URL(`${state.next}?yahoo=connected`, requestUrl.origin));
    response.cookies.delete("tbr_yahoo_oauth_nonce");
    return response;
  } catch (callbackError) {
    console.error("Yahoo OAuth callback failed", callbackError);
    const message = callbackError instanceof Error ? callbackError.message : "Yahoo connection failed.";
    return redirectWithStatus(requestUrl, "/account", `callback-failed:${message}`);
  }
}

function redirectWithStatus(requestUrl: URL, next: string, status: string) {
  const url = new URL(next, requestUrl.origin);
  url.searchParams.set("yahoo", status);
  return NextResponse.redirect(url);
}
