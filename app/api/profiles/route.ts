import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { hashProfilePassword, setProfileSessionCookies } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

function normalizeName(value: unknown) {
  const name = typeof value === "string" ? value.trim() : "";
  return name || "Neues Profil";
}

function normalizePassword(value: unknown) {
  return typeof value === "string" ? value : "";
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

export async function GET() {
  try {
    const prisma = getPrisma();
    const profiles = await prisma.accountingProfile.findMany({
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { sheets: true } },
      },
    });

    return NextResponse.json({ ok: true, profiles: profiles.map(mapProfile) });
  } catch (error) {
    console.error("Profiles could not be loaded:", error);
    return NextResponse.json(
      { ok: false, error: "Profile konnten nicht geladen werden." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = normalizeName(body.name);
    const password = normalizePassword(body.password);

    if (!password) {
      return NextResponse.json(
        { ok: false, error: "Bitte lege ein Passwort fest." },
        { status: 400 }
      );
    }

    const prisma = getPrisma();
    const profile = await prisma.accountingProfile.create({
      data: {
        id: randomUUID(),
        name,
        passwordHash: hashProfilePassword(password),
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
    console.error("Profile could not be created:", error);
    return NextResponse.json(
      { ok: false, error: "Profil konnte nicht erstellt werden." },
      { status: 500 }
    );
  }
}
