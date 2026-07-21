function hasRealValue(value?: string) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().replace(/^["']|["']$/g, "").toLowerCase();
  return Boolean(normalized) && normalized !== "encrypted" && normalized !== "\"\"";
}

function hasValidHttpUrl(value?: string) {
  if (!hasRealValue(value)) {
    return false;
  }

  try {
    const url = new URL(value as string);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function hasSupabaseBrowserConfig() {
  return hasValidHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) && hasRealValue(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function hasSupabaseAdminConfig() {
  return hasValidHttpUrl(process.env.NEXT_PUBLIC_SUPABASE_URL) && hasRealValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
}
