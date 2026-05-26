import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";
import { db } from "@/src/db";
import { users } from "@/src/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/src/lib/constants";

type GmGroup =
  | "MAINTENANCE_GM"
  | "FACILITY_SUPPORT_GM"
  | "SUBSEA_CONTROL_GM"
  | "PRODUCTION_GM";

export type BusinessProfile = {
  id: string;
  email: string;
  name: string;
  department: string;
  position: string;
  role: UserRole;
  gmGroup: GmGroup | null;
  signatureUrl: string | null;
  signatureUploadedAt: Date | null;
};

export async function getBusinessProfile(): Promise<BusinessProfile | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return null;

  const rows = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  return (rows[0] as BusinessProfile | undefined) ?? null;
}

export function requireRole(profile: BusinessProfile, roles: UserRole[]) {
  if (!roles.includes(profile.role)) {
    const err = new Error("Permission denied") as Error & { status: number };
    err.status = 403;
    throw err;
  }
}
