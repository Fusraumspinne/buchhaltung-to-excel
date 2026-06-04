import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest, NextResponse } from "next/server";
import {
  ACTIVE_PROFILE_COOKIE_NAME,
  PROFILE_SESSION_COOKIE_NAME,
  PROFILE_SESSION_MAX_AGE,
} from "@/lib/session";

const PASSWORD_HASH_ITERATIONS = 310_000;
const PASSWORD_HASH_KEY_LENGTH = 32;
const PASSWORD_HASH_DIGEST = "sha256";
const PASSWORD_HASH_PREFIX = "pbkdf2_sha256";

type ProfileSessionPayload = {
  profileId: string;
  exp: number;
};

function base64UrlEncode(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, "base64");
}

function getSessionSecret() {
  const secret =
    process.env.PROFILE_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.DATABASE_URL;

  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "development-profile-session-secret";

  throw new Error("PROFILE_SESSION_SECRET fehlt.");
}

function signPayload(payload: string) {
  return base64UrlEncode(createHmac("sha256", getSessionSecret()).update(payload).digest());
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function hashProfilePassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(
    password,
    salt,
    PASSWORD_HASH_ITERATIONS,
    PASSWORD_HASH_KEY_LENGTH,
    PASSWORD_HASH_DIGEST
  ).toString("hex");

  return `${PASSWORD_HASH_PREFIX}$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash}`;
}

export function verifyProfilePassword(password: string, storedHash: string) {
  if (!password || !storedHash) return false;

  const [prefix, iterationsRaw, salt, hash] = storedHash.split("$");
  const iterations = Number(iterationsRaw);
  if (
    prefix !== PASSWORD_HASH_PREFIX ||
    !Number.isInteger(iterations) ||
    iterations <= 0 ||
    !salt ||
    !hash
  ) {
    return false;
  }

  const candidate = pbkdf2Sync(
    password,
    salt,
    iterations,
    PASSWORD_HASH_KEY_LENGTH,
    PASSWORD_HASH_DIGEST
  ).toString("hex");

  return safeEqual(candidate, hash);
}

export function createProfileSessionToken(profileId: string) {
  const payload = base64UrlEncode(
    JSON.stringify({
      profileId,
      exp: Math.floor(Date.now() / 1000) + PROFILE_SESSION_MAX_AGE,
    } satisfies ProfileSessionPayload)
  );

  return `${payload}.${signPayload(payload)}`;
}

export function readProfileSession(request: NextRequest) {
  const token = request.cookies.get(PROFILE_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signPayload(payload), signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload).toString("utf8")) as Partial<ProfileSessionPayload>;
    if (
      typeof parsed.profileId !== "string" ||
      !parsed.profileId ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return { profileId: parsed.profileId };
  } catch {
    return null;
  }
}

export function setProfileSessionCookies(response: NextResponse, profileId: string) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PROFILE_SESSION_MAX_AGE,
  };

  response.cookies.set({
    ...cookieOptions,
    name: PROFILE_SESSION_COOKIE_NAME,
    value: createProfileSessionToken(profileId),
  });
  response.cookies.set({
    ...cookieOptions,
    name: ACTIVE_PROFILE_COOKIE_NAME,
    value: profileId,
  });
}

export function clearProfileSessionCookies(response: NextResponse) {
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };

  response.cookies.set({
    ...cookieOptions,
    name: PROFILE_SESSION_COOKIE_NAME,
    value: "",
  });
  response.cookies.set({
    ...cookieOptions,
    name: ACTIVE_PROFILE_COOKIE_NAME,
    value: "",
  });
}
