import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { events, discordConfig } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { sendDiscordWebhook, formatEventEmbed } from "@/lib/discord";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  if (!isFeatureEnabled("discord_integration")) {
    return NextResponse.json(
      { error: "Discord integration is disabled" },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { eventId } = await request.json();

    const event = db.select().from(events).where(eq(events.id, eventId)).get();
    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const config = db.select().from(discordConfig).limit(1).get();
    if (!config?.webhookUrl) {
      return NextResponse.json(
        { error: "Discord webhook not configured. Go to Settings > Discord to set it up." },
        { status: 400 }
      );
    }

    const result = await sendDiscordWebhook(
      config.webhookUrl,
      formatEventEmbed(event)
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error ?? "Failed to send webhook" },
        { status: 500 }
      );
    }

    db.update(events)
      .set({ discordPosted: true })
      .where(eq(events.id, eventId))
      .run();

    return NextResponse.json({ data: { success: true } });
  } catch (err) {
    console.error("Discord push error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
