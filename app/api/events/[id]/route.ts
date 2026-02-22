import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { events, rsvps, users } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { updateEventSchema } from "@/lib/validators";
import { eq, sql } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

  const event = db.select().from(events).where(eq(events.id, id)).get();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const creator = db
    .select({ displayName: users.displayName, pronouns: users.pronouns })
    .from(users)
    .where(eq(users.id, event.creatorId))
    .get();

  const rsvpCounts = db
    .select({
      going: sql<number>`sum(case when status = 'going' then 1 else 0 end)`,
      interested: sql<number>`sum(case when status = 'interested' then 1 else 0 end)`,
    })
    .from(rsvps)
    .where(eq(rsvps.eventId, id))
    .get();

  const userRsvp = db
    .select()
    .from(rsvps)
    .where(
      sql`${rsvps.eventId} = ${id} AND ${rsvps.userId} = ${session.user.id}`
    )
    .get();

  const attendees = db
    .select({
      displayName: users.displayName,
      pronouns: users.pronouns,
      status: rsvps.status,
    })
    .from(rsvps)
    .innerJoin(users, eq(rsvps.userId, users.id))
    .where(eq(rsvps.eventId, id))
    .all();

  return NextResponse.json({
    data: {
      ...event,
      creator,
      goingCount: rsvpCounts?.going ?? 0,
      interestedCount: rsvpCounts?.interested ?? 0,
      userRsvp: userRsvp?.status ?? null,
      attendees,
    },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = db.select().from(events).where(eq(events.id, id)).get();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.creatorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = updateEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = db
      .update(events)
      .set({ ...parsed.data, updatedAt: new Date().toISOString() })
      .where(eq(events.id, id))
      .returning()
      .get();

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("Update event error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const event = db.select().from(events).where(eq(events.id, id)).get();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const user = db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .get();

  if (event.creatorId !== session.user.id && !user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  db.delete(events).where(eq(events.id, id)).run();

  return NextResponse.json({ data: { deleted: true } });
}
