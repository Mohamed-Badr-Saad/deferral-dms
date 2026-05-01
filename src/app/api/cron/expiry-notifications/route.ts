import { NextResponse } from "next/server";
import {
  getCronAuthError,
  parseJobDateInput,
  parsePositiveIntInput,
  runExpiryNotifications,
} from "@/src/lib/expiry-jobs";

async function handle(request: Request) {
  const authError = getCronAuthError(request);
  if (authError) {
    return NextResponse.json({ message: authError }, { status: 401 });
  }

  const url = new URL(request.url);
  const nowResult = parseJobDateInput(url.searchParams.get("at"), new Date());
  const windowDaysResult = parsePositiveIntInput(
    url.searchParams.get("windowDays"),
    15,
    "windowDays",
  );
  const cooldownDaysResult = parsePositiveIntInput(
    url.searchParams.get("cooldownDays"),
    7,
    "cooldownDays",
  );

  const error =
    nowResult.error ?? windowDaysResult.error ?? cooldownDaysResult.error;
  if (error) {
    return NextResponse.json({ message: error }, { status: 400 });
  }

  const result = await runExpiryNotifications({
    now: nowResult.value,
    windowDays: windowDaysResult.value,
    cooldownDays: cooldownDaysResult.value,
  });

  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
