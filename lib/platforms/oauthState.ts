import crypto from "node:crypto";

type OAuthStatePayload = {
  userId: string;
  next: string;
  nonce: string;
  createdAt: number;
};

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export function createOAuthState(payload: Omit<OAuthStatePayload, "createdAt">) {
  const body = base64UrlEncode(JSON.stringify({ ...payload, createdAt: Date.now() }));
  const signature = sign(body);
  return `${body}.${signature}`;
}

export function verifyOAuthState(value: string) {
  const [body, signature] = value.split(".");
  if (!body || !signature || !constantTimeEqual(signature, sign(body))) {
    throw new Error("Invalid OAuth state.");
  }

  const payload = JSON.parse(base64UrlDecode(body).toString("utf8")) as OAuthStatePayload;
  if (!payload.userId || !payload.nonce || Date.now() - Number(payload.createdAt) > STATE_MAX_AGE_MS) {
    throw new Error("Expired OAuth state.");
  }

  return payload;
}

export function createOAuthNonce() {
  return crypto.randomBytes(24).toString("base64url");
}

function sign(value: string) {
  return crypto.createHmac("sha256", getStateSecret()).update(value).digest("base64url");
}

function getStateSecret() {
  const secret = process.env.YAHOO_OAUTH_STATE_SECRET || process.env.PLATFORM_TOKEN_ENCRYPTION_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("Missing YAHOO_OAUTH_STATE_SECRET or PLATFORM_TOKEN_ENCRYPTION_KEY.");
  }
  return secret;
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url");
}
