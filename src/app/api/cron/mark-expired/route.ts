import { NextResponse } from "next/server";
import {
  getCronAuthError,
  parseJobDateInput,
  runMarkExpired,
} from "@/src/lib/expiry-jobs";

async function handle(request: Request) {
  const authError = getCronAuthError(request);
  if (authError) {
    return NextResponse.json({ message: authError }, { status: 401 });
  }

  const url = new URL(request.url);
  const nowResult = parseJobDateInput(url.searchParams.get("at"), new Date());
  if (nowResult.error) {
    return NextResponse.json({ message: nowResult.error }, { status: 400 });
  }

  const result = await runMarkExpired({ now: nowResult.value });
  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
