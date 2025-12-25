import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;

  // Return a mock chat object so the UI doesn't crash
  return NextResponse.json({
    id: chatId,
    title: "New Chat",
    messages: [],
    createdAt: new Date().toISOString(),
    isMock: true,
  });
}
