import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile, unauthorizedResponse } from "@/lib/api-auth";
import { createStoredBackup, mapBackup } from "@/lib/backups";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

function errorResponse(error: unknown, fallback: string) {
  console.error(fallback, error);
  return NextResponse.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : fallback,
    },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) {
    return unauthorizedResponse();
  }

  try {
    const prisma = getPrisma();
    const backups = await prisma.accountingBackup.findMany({
      where: { profileId: profile.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 25,
      select: {
        id: true,
        label: true,
        createdAt: true,
        sheetCount: true,
        rowCount: true,
      },
    });

    return NextResponse.json({ ok: true, backups: backups.map(mapBackup) });
  } catch (error) {
    return errorResponse(error, "Backups konnten nicht geladen werden.");
  }
}

export async function POST(request: NextRequest) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const label = body && typeof body === "object" ? body.label : null;
    const prisma = getPrisma();

    const backup = await prisma.$transaction((tx) =>
      createStoredBackup(tx, profile, typeof label === "string" ? label : null)
    );

    return NextResponse.json({ ok: true, backup });
  } catch (error) {
    return errorResponse(error, "Backup konnte nicht erstellt werden.");
  }
}
