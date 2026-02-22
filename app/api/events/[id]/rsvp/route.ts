import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { rsvps, events } from "@/db/schema";
import { rsvpSchema } from "@/lib/validators";
import { eq, and } from "drizzle-orm";

export async function POST(
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

  try {
    const body = await request.json();
    const parsed = rsvpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { status } = parsed.data;

    // Remove RSVP if "not_going"
    if (status === "not_going") {
      db.delete(rsvps)
        .where(and(eq(rsvps.eventId, id), eq(rsvps.userId, session.user.id)))
        .run();
      return NextResponse.json({ data: { status: null } });
    }

    // Upsert RSVP
    const existing = db
      .select()
      .from(rsvps)
      .where(and(eq(rsvps.eventId, id), eq(rsvps.userId, session.user.id)))
      .get();

    if (existing) {
      db.update(rsvps)
        .set({ status, updatedAt: new Date().toISOString() })
        .where(eq(rsvps.id, existing.id))
        .run();
    } else {
      db.insert(rsvps)
        .values({
          eventId: id,
          userId: session.user.id,
          status,
        })
        .run();
    }

    return NextResponse.json({ data: { status } });
  } catch (err) {
    console.error("RSVP error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
