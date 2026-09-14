import { NextResponse } from "next/server";
import { getBusinessProfile } from "@/src/lib/authz";

export async function GET() {
  const profile = await getBusinessProfile();
  if (!profile)
    return NextResponse.json({ message: "Permission denied" }, { status: 401 });

  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json(
      { message: "Push notifications are not configured on this server." },
      { status: 503 },
    );
  }

  return NextResponse.json({ key }, { status: 200 });
}
