import { NextRequest, NextResponse } from "next/server";
import { setProfileSessionCookies, verifyProfilePassword } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ profileId: string }>;
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

export async function POST(request: NextRequest, context: RouteContext) {
  const { profileId } = await context.params;
  const decodedProfileId = decodeURIComponent(profileId);

  try {
    const body = await request.json().catch(() => ({}));
    const password = typeof body.password === "string" ? body.password : "";
    const prisma = getPrisma();
    const profile = await prisma.accountingProfile.findUnique({
      where: { id: decodedProfileId },
      select: {
        id: true,
        name: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { sheets: true } },
      },
    });

    if (!profile || !verifyProfilePassword(password, profile.passwordHash)) {
      return NextResponse.json(
        { ok: false, error: "Falsches Passwort." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true, profile: mapProfile(profile) });
    setProfileSessionCookies(response, profile.id);
    return response;
  } catch (error) {
    console.error("Profile login failed:", error);
    return NextResponse.json(
      { ok: false, error: "Profil konnte nicht geöffnet werden." },
      { status: 500 }
    );
  }
}
