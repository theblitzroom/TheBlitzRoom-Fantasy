import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function safeInternalRedirect(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/account";
  }

  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeInternalRedirect(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      const loginUrl = new URL("/login", requestUrl.origin);
      loginUrl.searchParams.set("auth_error", "The account link expired or could not be verified. Please request a new link.");
      loginUrl.searchParams.set("next", next);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
