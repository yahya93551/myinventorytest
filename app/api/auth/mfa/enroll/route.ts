import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";

export async function POST(_req: NextRequest) {
  return jsonError("Use Supabase Auth native MFA enrollment", 410);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
