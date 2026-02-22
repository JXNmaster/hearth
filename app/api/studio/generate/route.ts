import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { events } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { generateEventImage } from "@/lib/image-gen";
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
    const { eventId, template = "instagram_post" } = await request.json();

    if (!["instagram_post", "instagram_story", "flyer"].includes(template)) {
      return NextResponse.json(
        { error: "Invalid template type" },
        { status: 400 }
      );
    }

    const event = db.select().from(events).where(eq(events.id, eventId)).get();
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const png = await generateEventImage(event, template);

    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="hearth-${template}-${event.id.slice(0, 8)}.png"`,
      },
    });
  } catch (err) {
    console.error("Image generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}
