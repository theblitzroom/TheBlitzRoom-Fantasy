const adminEmailPattern = /[\s,;]+/;

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(adminEmailPattern)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function hasAdminConfig() {
  return getAdminEmails().length > 0;
}

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return getAdminEmails().includes(email.trim().toLowerCase());
}
