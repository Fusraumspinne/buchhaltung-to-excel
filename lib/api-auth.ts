import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { readProfileSession } from "@/lib/auth";
import { getPrisma } from "@/lib/db";

export type AuthenticatedProfile = {
  id: string;
  name: string;
};

export function unauthorizedResponse() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function getAuthenticatedProfile(
  request: NextRequest
): Promise<AuthenticatedProfile | null> {
  const session = readProfileSession(request);
  if (!session) return null;

  const prisma = getPrisma();
  return prisma.accountingProfile.findUnique({
    where: { id: session.profileId },
    select: { id: true, name: true },
  });
}
