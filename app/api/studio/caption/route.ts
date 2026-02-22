import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { events } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { generateCaption } from "@/lib/ai";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  if (!isFeatureEnabled("social_media_studio")) {
    return NextResponse.json(
      { error: "Social media studio is disabled" },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { eventId, tone = "friendly" } = await request.json();

    const event = db.select().from(events).where(eq(events.id, eventId)).get();
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const caption = await generateCaption(event, tone);
    return NextResponse.json({ data: { caption } });
  } catch (err) {
    console.error("Caption generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate caption" },
      { status: 500 }
    );
  }
}
