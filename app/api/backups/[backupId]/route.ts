import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile, unauthorizedResponse } from "@/lib/api-auth";
import { mapBackup, readBackupSnapshot } from "@/lib/backups";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ backupId: string }>;
}

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

export async function GET(request: NextRequest, context: RouteContext) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) {
    return unauthorizedResponse();
  }

  const { backupId } = await context.params;
  const decodedBackupId = decodeURIComponent(backupId);

  try {
    const prisma = getPrisma();
    const backup = await prisma.accountingBackup.findFirst({
      where: {
        id: decodedBackupId,
        profileId: profile.id,
      },
      select: {
        id: true,
        label: true,
        createdAt: true,
        sheetCount: true,
        rowCount: true,
        snapshot: true,
      },
    });

    if (!backup) {
      return NextResponse.json(
        { ok: false, error: "Backup nicht gefunden." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      backup: mapBackup(backup),
      snapshot: readBackupSnapshot(backup.snapshot),
    });
  } catch (error) {
    return errorResponse(error, "Backup konnte nicht geladen werden.");
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) {
    return unauthorizedResponse();
  }

  const { backupId } = await context.params;
  const decodedBackupId = decodeURIComponent(backupId);

  try {
    const prisma = getPrisma();
    const deleted = await prisma.accountingBackup.deleteMany({
      where: {
        id: decodedBackupId,
        profileId: profile.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { ok: false, error: "Backup nicht gefunden." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Backup konnte nicht gelöscht werden.");
  }
}
