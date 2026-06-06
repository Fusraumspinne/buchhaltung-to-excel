import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedProfile, unauthorizedResponse } from "@/lib/api-auth";
import {
  createStoredBackup,
  pruneBackups,
  readBackupSnapshot,
  restoreBackupSnapshot,
} from "@/lib/backups";
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

export async function POST(request: NextRequest, context: RouteContext) {
  const profile = await getAuthenticatedProfile(request);
  if (!profile) {
    return unauthorizedResponse();
  }

  const { backupId } = await context.params;
  const decodedBackupId = decodeURIComponent(backupId);

  try {
    const prisma = getPrisma();
    const result = await prisma.$transaction(async (tx) => {
      const backup = await tx.accountingBackup.findFirst({
        where: {
          id: decodedBackupId,
          profileId: profile.id,
        },
        select: {
          snapshot: true,
        },
      });

      if (!backup) throw new Error("Backup nicht gefunden.");

      const snapshot = readBackupSnapshot(backup.snapshot);
      const safetyBackup = await createStoredBackup(
        tx,
        profile,
        "Vor Wiederherstellung"
      );

      await restoreBackupSnapshot(tx, profile.id, snapshot);
      await pruneBackups(tx, profile.id);

      return {
        safetyBackup,
        state: {
          profile,
          sheets: snapshot.sheets,
          data: snapshot.data,
          updatedAt: new Date().toISOString(),
        },
      };
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error, "Backup konnte nicht wiederhergestellt werden.");
  }
}
