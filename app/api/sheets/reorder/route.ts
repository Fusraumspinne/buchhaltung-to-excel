import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile, unauthorizedResponse } from "@/lib/api-auth";
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

function normalizeSheetIds(value: unknown) {
  if (!Array.isArray(value)) return null;

  const ids = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter(Boolean);
  const uniqueIds = new Set(ids);

  return uniqueIds.size === ids.length ? ids : null;
}

export async function PATCH(request: NextRequest) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) {
    return unauthorizedResponse();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const sheetIds = normalizeSheetIds(body?.sheetIds);
    if (!sheetIds) throw new Error("Ungültige Sheet-Reihenfolge.");

    const prisma = getPrisma();
    await prisma.$transaction(async (tx) => {
      const existingSheets = await tx.accountingSheet.findMany({
        where: { profileId: profile.id },
        select: { id: true },
      });
      const existingIds = new Set(existingSheets.map((sheet) => sheet.id));

      if (
        existingIds.size !== sheetIds.length ||
        sheetIds.some((sheetId) => !existingIds.has(sheetId))
      ) {
        throw new Error("Sheet-Reihenfolge passt nicht zum aktuellen Profil.");
      }

      await Promise.all(
        sheetIds.map((sheetId, index) =>
          tx.accountingSheet.update({
            where: {
              profileId_id: {
                profileId: profile.id,
                id: sheetId,
              },
            },
            data: { sortOrder: index },
          })
        )
      );

      await tx.accountingProfile.update({
        where: { id: profile.id },
        data: { updatedAt: new Date() },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Sheet-Reihenfolge konnte nicht gespeichert werden.");
  }
}
