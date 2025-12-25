import { NextRequest, NextResponse } from "next/server";
import { createClient } from "v0-sdk";
import { auth } from "@clerk/nextjs/server";

const v0 = createClient(
  process.env.V0_API_URL ? { baseUrl: process.env.V0_API_URL } : {}
);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { userId } = await auth();
    const { chatId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    if (!chatId) {
      return NextResponse.json(
        { error: "Chat ID is required" },
        { status: 400 }
      );
    }

    const { privacy } = await request.json();

    if (
      !privacy ||
      !["public", "private", "team", "team-edit", "unlisted"].includes(privacy)
    ) {
      return NextResponse.json(
        { error: "Invalid privacy setting" },
        { status: 400 }
      );
    }

    const updatedChat = await v0.chats.update({
      chatId,
      privacy,
    });

    return NextResponse.json(updatedChat);
  } catch (error) {
    console.error("Change Chat Visibility Error:", error);
    return NextResponse.json(
      { error: "Failed to change chat visibility" },
      { status: 500 }
    );
  }
}
