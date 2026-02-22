import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { events, rsvps, discordConfig } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createEventSchema } from "@/lib/validators";
import { sendDiscordWebhook, formatEventEmbed } from "@/lib/discord";
import { desc, gte, eq, like, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  if (!isFeatureEnabled("events_engine")) {
    return NextResponse.json(
      { error: "Events are currently disabled" },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const upcoming = searchParams.get("upcoming");
  const search = searchParams.get("search");

  let query = db.select().from(events);

  const conditions = [];
  if (category) {
    conditions.push(eq(events.category, category));
  }
  if (upcoming === "true") {
    conditions.push(gte(events.dateStart, new Date().toISOString()));
  }
  if (search) {
    conditions.push(like(events.title, `%${search}%`));
  }

  const results =
    conditions.length > 0
      ? query
          .where(
            conditions.length === 1
              ? conditions[0]
              : sql`${conditions.map((c) => sql`(${c})`).reduce((a, b) => sql`${a} AND ${b}`)}`
          )
          .orderBy(events.dateStart)
          .all()
      : query.orderBy(events.dateStart).all();

  // Attach RSVP counts
  const eventsWithCounts = results.map((event) => {
    const rsvpCounts = db
      .select({
        going: sql<number>`sum(case when status = 'going' then 1 else 0 end)`,
        interested: sql<number>`sum(case when status = 'interested' then 1 else 0 end)`,
      })
      .from(rsvps)
      .where(eq(rsvps.eventId, event.id))
      .get();

    return {
      ...event,
      goingCount: rsvpCounts?.going ?? 0,
      interestedCount: rsvpCounts?.interested ?? 0,
    };
  });

  return NextResponse.json({ data: eventsWithCounts });
}

export async function POST(request: NextRequest) {
  if (!isFeatureEnabled("events_engine")) {
    return NextResponse.json(
      { error: "Events are currently disabled" },
      { status: 503 }
    );
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const newEvent = db
      .insert(events)
      .values({
        ...parsed.data,
        creatorId: session.user.id,
      })
      .returning()
      .get();

    // Auto-post to Discord if configured
    if (isFeatureEnabled("discord_integration")) {
      const config = db.select().from(discordConfig).limit(1).get();
      if (config?.autoPostEvents && config.webhookUrl) {
        try {
          await sendDiscordWebhook(
            config.webhookUrl,
            formatEventEmbed(newEvent)
          );
          db.update(events)
            .set({ discordPosted: true })
            .where(eq(events.id, newEvent.id))
            .run();
        } catch (err) {
          console.error("Discord webhook failed:", err);
        }
      }
    }

    return NextResponse.json({ data: newEvent }, { status: 201 });
  } catch (err) {
    console.error("Create event error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
