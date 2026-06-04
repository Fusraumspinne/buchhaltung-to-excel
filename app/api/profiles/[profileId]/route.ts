import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile, unauthorizedResponse } from "@/lib/api-auth";
import { hashProfilePassword, setProfileSessionCookies, verifyProfilePassword } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ profileId: string }>;
}

function normalizeName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  return name || "Neues Profil";
}

function mapProfile(profile: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { sheets: number };
}) {
  return {
    id: profile.id,
    name: profile.name,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
    sheetCount: profile._count?.sheets ?? 0,
  };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const sessionProfile = await getAuthenticatedProfile(request);
  if (!sessionProfile) {
    return unauthorizedResponse();
  }

  const { profileId } = await context.params;
  const decodedProfileId = decodeURIComponent(profileId);
  if (decodedProfileId !== sessionProfile.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const name = normalizeName(body.name);
    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

    const prisma = getPrisma();
    const existing = await prisma.accountingProfile.findUnique({
      where: { id: sessionProfile.id },
      select: { id: true, passwordHash: true },
    });

    if (!existing) {
      return unauthorizedResponse();
    }

    if (newPassword) {
      if (!verifyProfilePassword(currentPassword, existing.passwordHash)) {
        return NextResponse.json(
          { ok: false, error: "Aktuelles Passwort ist falsch." },
          { status: 400 }
        );
      }
    }

    const profile = await prisma.accountingProfile.update({
      where: { id: sessionProfile.id },
      data: {
        name,
        ...(newPassword ? { passwordHash: hashProfilePassword(newPassword) } : {}),
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { sheets: true } },
      },
    });

    const response = NextResponse.json({ ok: true, profile: mapProfile(profile) });
    setProfileSessionCookies(response, profile.id);
    return response;
  } catch (error) {
    console.error("Profile could not be updated:", error);
    return NextResponse.json(
      { ok: false, error: "Profil konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
