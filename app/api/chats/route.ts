import { NextResponse } from "next/server";

export async function GET() {
  // Database removed - returning empty list of chats
  return NextResponse.json({ data: [] });
}
